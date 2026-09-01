import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { GENRES_LIST, TROPES_LIST } from "@/lib/taxonomy";

/**
 * Route API serveur qui utilise Claude (Anthropic) pour proposer les
 * genres et tropes d'un livre nouvellement découvert (Google Books,
 * Apple Books, Open Library...), à partir de son résumé — ces sources
 * externes ne connaissent pas notre taxonomie et renvoient les fiches
 * sans genres/tropes, ce qui laissait jusqu'ici les nouvelles fiches
 * entièrement vides tant qu'une administratrice ne les curait pas à la
 * main (voir master-book-editor.tsx).
 *
 * Protégée par vérification du token Firebase (n'importe quelle
 * utilisatrice connectée, pas seulement l'admin) car c'est déclenché à
 * chaque ajout de livre externe depuis /add — mais bien authentifiée
 * quand même, jamais ouverte au public, vu le coût par appel.
 *
 * Ne renvoie QUE des valeurs prises dans GENRES_LIST/TROPES_LIST — un
 * filtrage strict après coup élimine toute proposition hors-liste,
 * même si le modèle en invente une malgré la consigne.
 */

function buildPrompt(title: string, author: string, description: string): string {
  return `Voici un livre francophone (souvent romance/dark romance/young adult) :
Titre : ${title}
Auteur : ${author}
Résumé : ${description}

Parmi cette liste de genres :
${GENRES_LIST.join(", ")}

Et cette liste de tropes narratifs :
${TROPES_LIST.join(", ")}

Choisis UNIQUEMENT les genres et tropes qui correspondent vraiment à ce résumé (1 à 3 genres, 0 à 5 tropes — n'en force aucun si le résumé ne le justifie pas clairement). N'invente jamais de valeur en dehors de ces deux listes, reprends les libellés exactement tels qu'écrits.

Réponds UNIQUEMENT avec un objet JSON brut de la forme {"genres": [...], "tropes": [...]}, sans texte autour, sans balises markdown.`;
}

function parseResponse(text: string): { genres: string[]; tropes: string[] } {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      genres: Array.isArray(parsed?.genres) ? parsed.genres : [],
      tropes: Array.isArray(parsed?.tropes) ? parsed.tropes : [],
    };
  } catch {
    return { genres: [], tropes: [] };
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!idToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const adminAuth = await getAdminAuth();
    await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error("[enrich-book-taxonomy] Token verification failed:", err);
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée côté serveur" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const title = (body?.title || "").toString().trim();
  const author = (body?.author || "").toString().trim();
  const description = (body?.description || "").toString().trim();

  // Sans résumé, le modèle n'a rien de fiable sur quoi se baser — mieux
  // vaut ne rien proposer que deviner à partir du seul titre.
  if (!description) {
    return NextResponse.json({ genres: [], tropes: [] });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: buildPrompt(title, author, description) }],
      }),
    });

    if (!res.ok) {
      console.error(`[enrich-book-taxonomy] Anthropic HTTP ${res.status}`);
      return NextResponse.json({ genres: [], tropes: [] });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    const { genres, tropes } = parseResponse(text);

    // Filtrage défensif : uniquement des valeurs réellement dans nos
    // listes, au cas où le modèle s'écarte malgré la consigne.
    const genreSet = new Set(GENRES_LIST);
    const tropeSet = new Set(TROPES_LIST);

    return NextResponse.json({
      genres: genres.filter((g) => genreSet.has(g)),
      tropes: tropes.filter((t) => tropeSet.has(t)),
    });
  } catch (err) {
    console.error("[enrich-book-taxonomy] Error:", err);
    return NextResponse.json({ genres: [], tropes: [] });
  }
}
