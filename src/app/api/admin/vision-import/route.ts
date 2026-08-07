import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { ADMIN_EMAILS } from "@/lib/utils";

/**
 * Route API serveur qui utilise l'API vision de Claude (Anthropic) pour
 * extraire les annonces de sorties de livres (titre, auteur, éditeur,
 * date) contenues dans une capture d'écran — posts Instagram d'éditeurs,
 * pages catalogue, etc.
 *
 * Ne renvoie JAMAIS de couverture : c'est un choix produit volontaire,
 * l'administratrice ajoute elle-même l'image lors de la validation
 * (voir AdminActualitesQueue) plutôt que de faire confiance à un rognage
 * automatique de la capture, peu fiable et parfois hors-sujet (visuel de
 * fond du post plutôt que la vraie couverture du livre).
 *
 * Protégée par vérification du token Firebase de l'utilisatrice
 * connectée (et non par un simple secret partagé comme le cron) car
 * cette route est appelée depuis le navigateur admin, pas par un
 * déclencheur serveur-à-serveur — et elle a un coût réel par appel
 * (facturation Anthropic à l'usage), donc ne doit jamais être ouverte au
 * public.
 */

const EXTRACTION_PROMPT = `Cette image est une capture d'écran d'un post/page annonçant la sortie d'un ou plusieurs livres (souvent romance/dark romance/young adult, éditeurs francophones).

Extrais chaque livre annoncé sous forme de tableau JSON, avec ces champs exacts pour chaque livre :
- title (titre du livre, avec le numéro de tome s'il est indissociable du titre)
- author (nom de l'auteur, tel qu'affiché ; chaîne vide si non lisible — ne jamais deviner)
- publisher (nom de l'éditeur si visible, ex: "Éditions Addictives", "BMR", "&H", "Hugo Poche" — sinon chaîne vide)
- releaseDate (date de sortie au format YYYY-MM-DD)
- content (une phrase courte en français décrivant l'annonce)

IMPORTANT sur les dates : les dates affichées dans ces captures sont TOUJOURS au format français JOUR.MOIS (ex: "12.11" = 12 novembre, PAS le 12 décembre). Ne jamais interpréter au format américain mois/jour. Si seul JJ.MM est visible sans année, utilise l'année 2026. Si aucune date n'est visible, laisse une chaîne vide.

Si l'image ne contient AUCUNE annonce de livre exploitable (capture non pertinente), renvoie un tableau vide [].

Réponds UNIQUEMENT avec le JSON brut (un tableau, même pour un seul livre), sans texte autour, sans balises markdown.`;

interface ExtractedBook {
  title: string;
  author: string;
  publisher: string;
  releaseDate: string;
  content: string;
}

function parseJsonResponse(text: string): ExtractedBook[] {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function extractFromImage(base64: string, mediaType: string, apiKey: string): Promise<ExtractedBook[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`[vision-import] Anthropic HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  return parseJsonResponse(text);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!idToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const adminAuth = await getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
      return NextResponse.json({ error: "Accès réservé à l'administratrice" }, { status: 403 });
    }
  } catch (err) {
    console.error("[vision-import] Token verification failed:", err);
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée côté serveur" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const images: { base64: string; mediaType: string }[] = body?.images || [];
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Aucune image fournie" }, { status: 400 });
  }
  if (images.length > 20) {
    return NextResponse.json({ error: "Maximum 20 images par lot" }, { status: 400 });
  }

  const results: (ExtractedBook & { sourceImageIndex: number })[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const books = await extractFromImage(images[i].base64, images[i].mediaType, apiKey);
      for (const b of books) {
        results.push({ ...b, sourceImageIndex: i });
      }
    } catch (err) {
      console.error(`[vision-import] Error on image ${i}:`, err);
      // Une image qui échoue ne doit pas faire tomber tout le lot.
    }
  }

  return NextResponse.json({ results, imagesProcessed: images.length });
}
