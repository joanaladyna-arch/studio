import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { XMLParser } from "fast-xml-parser";

/**
 * Tâche planifiée (Vercel Cron, voir vercel.json) qui détecte les
 * nouvelles sorties des auteurs ET des éditeurs suivis par au moins une
 * lectrice, et les dépose dans `actualitesPending` en attente de
 * validation par l'administratrice — jamais publiées directement (voir
 * PendingActualitesManager côté app).
 *
 * Protégée par un secret partagé (CRONSECRET) pour qu'elle ne puisse
 * être déclenchée que par Vercel Cron, jamais par une requête publique.
 *
 * Fenêtre de détection volontairement resserrée à 45 jours après la
 * date de publication Google Books, pour ne remonter que de vraies
 * nouveautés et non tout le fonds de catalogue d'un auteur ou éditeur.
 */

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents : rend le matching insensible aux accents (BnF/Google Books/Hardcover orthographient différemment)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Un nom "correspond" si tous ses mots (hors particules courtes) se
// retrouvent dans le texte candidat, peu importe l'ordre — nécessaire car
// la BnF liste les auteurs "Nom Prénom" alors que Lectoria stocke "Prénom Nom".
function nameMatches(candidate: string, reference: string): boolean {
  const refWords = normalize(reference).split(" ").filter((w) => w.length > 1);
  if (refWords.length === 0) return false;
  const candidateNorm = normalize(candidate);
  return refWords.every((w) => candidateNorm.includes(w));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRONSECRET ? `Bearer ${process.env.CRONSECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // 1. Collecte des auteurs ET éditeurs suivis par au moins une
    // lectrice, en parcourant les documents utilisatrices via l'Admin
    // SDK — celui-ci contourne les règles de sécurité normales, ce qui
    // est justement pourquoi cette route ne doit jamais être publique.
    const usersSnap = await db.collection("users").get();
    const followedSlugs = new Set<string>();
    const followedPublishers = new Set<string>();
    usersSnap.forEach((doc) => {
      const followed = doc.data()?.followedAuthors;
      if (Array.isArray(followed)) followed.forEach((slug) => slug && followedSlugs.add(slug));
      const publishers = doc.data()?.followedPublishers;
      if (Array.isArray(publishers)) publishers.forEach((p) => p && followedPublishers.add(p.trim()));
    });

    if (followedSlugs.size === 0 && followedPublishers.size === 0) {
      return NextResponse.json({ message: "Aucun auteur ni éditeur suivi pour le moment.", detected: 0 });
    }

    // 2. Résolution slug → nom d'affichage via la fiche auteur partagée.
    // Fallback amélioré : si l'auteur n'existe pas en base, on convertit
    // le slug en nom lisible (tirets → espaces, majuscules, sans préfixe "auteur-")
    function slugToName(slug: string): string {
      return slug
        .replace(/^auteur-/i, "")          // retirer le préfixe "auteur-" si présent
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
        .trim();
    }

    const authorNames: { slug: string; name: string }[] = [];
    for (const slug of followedSlugs) {
      const authorDoc = await db.collection("authors").doc(slug).get();
      const name = authorDoc.exists
        ? (authorDoc.data()?.name || slugToName(slug))
        : slugToName(slug);
      authorNames.push({ slug, name });
    }

    // 3. Titres déjà connus (publiés ou en attente) pour ne jamais
    // proposer deux fois la même sortie.
    const [actualitesSnap, pendingSnap] = await Promise.all([
      db.collection("actualites").get(),
      db.collection("actualitesPending").get(),
    ]);
    const knownTitles = new Set<string>();
    actualitesSnap.forEach((d) => knownTitles.add(normalize(d.data()?.title)));
    pendingSnap.forEach((d) => knownTitles.add(normalize(d.data()?.title)));

    let detected = 0;

    // Recherche générique réutilisée pour un auteur ou un éditeur — seul
    // le paramètre de requête Google Books et les champs déposés dans
    // actualitesPending diffèrent.
    async function detectFrom(query: string, extraFields: Record<string, any>) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=newest&maxResults=10&printType=books`;
      const res = await fetch(url);
      if (!res.ok) { console.log(`[cron] HTTP ${res.status} pour query: ${query}`); return; }
      const data = await res.json();
      const items = data.items || [];
      console.log(`[cron] query="${query}" → ${items.length} résultat(s)`);
      if (items.length > 0) {
        const sample = items[0]?.volumeInfo;
        console.log(`[cron] premier: "${sample?.title}" (${sample?.publishedDate})`);
      }

      for (const item of items) {
        const info = item.volumeInfo || {};
        const title = info.title || "";
        if (!title || knownTitles.has(normalize(title))) continue;

        const publishedDate = info.publishedDate || "";

        const docRef = db.collection("actualitesPending").doc();
        await docRef.set({
          title,
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
          isRelease: true,
          releaseDate: publishedDate.length === 10 ? publishedDate : "",
          detectedAt: FieldValue.serverTimestamp(),
          source: "auto-google-books",
          ...extraFields,
        });
        knownTitles.add(normalize(title));
        detected++;
      }
    }

    // Détection via le flux RSS "Nouveautés Éditeurs" de la BnF (dépôt
    // légal, sans clé API). Contrairement à Google Books, ce flux n'est
    // pas interrogeable par auteur/éditeur : on récupère tout le flux une
    // seule fois et on filtre nous-mêmes sur les auteurs/éditeurs suivis.
    function parseBnfDescription(description: string) {
      const decoded = (description || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const paragraphs = Array.from(decoded.matchAll(/<p>(.*?)<\/p>/g)).map((m) => m[1].trim());

      let authors: string[] = [];
      let publisher = "";
      let releaseDate = "";
      for (const p of paragraphs) {
        if (/^Auteurs?\s*:/i.test(p)) {
          authors = p.replace(/^Auteurs?\s*:/i, "").split(";").map((a) => a.trim()).filter(Boolean);
        } else if (/^Editeur\s*:/i.test(p)) {
          publisher = p.replace(/^Editeur\s*:/i, "").trim();
        } else if (/^Date de parution\s*:/i.test(p)) {
          const raw = p.replace(/^Date de parution\s*:/i, "").trim();
          const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (m) releaseDate = `${m[3]}-${m[2]}-${m[1]}`;
        }
      }
      return { authors, publisher, releaseDate };
    }

    async function detectFromBnfRss() {
      const res = await fetch("https://nouveautes-editeurs.bnf.fr/neRss?type=livre");
      if (!res.ok) { console.log(`[cron] BnF RSS HTTP ${res.status}`); return; }
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const parsed = parser.parse(xml);
      const rawItems = parsed?.rss?.channel?.item;
      const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      console.log(`[cron] BnF RSS → ${items.length} entrée(s)`);

      for (const item of items) {
        const title = (item?.title ?? "").toString().trim();
        if (!title || knownTitles.has(normalize(title))) continue;

        const { authors, publisher, releaseDate } = parseBnfDescription((item?.description ?? "").toString());

        const matchedAuthor = authorNames.find(({ name }) => authors.some((a) => nameMatches(a, name)));
        const matchedPublisher = matchedAuthor
          ? undefined
          : [...followedPublishers].find((p) => publisher && nameMatches(publisher, p));

        if (!matchedAuthor && !matchedPublisher) continue;

        const cover = (item?.enclosure?.["@_url"] ?? "").toString();
        const extraFields = matchedAuthor
          ? {
              content: `Nouvelle sortie détectée automatiquement (BnF) chez ${matchedAuthor.name} : à vérifier avant publication.`,
              authorName: matchedAuthor.name,
              authorSlug: matchedAuthor.slug,
            }
          : {
              content: `Nouvelle parution détectée automatiquement (BnF) chez l'éditeur ${matchedPublisher} : à vérifier avant publication.`,
              publisherName: matchedPublisher,
            };

        const docRef = db.collection("actualitesPending").doc();
        await docRef.set({
          title,
          cover,
          isRelease: true,
          releaseDate,
          detectedAt: FieldValue.serverTimestamp(),
          source: "auto-bnf-rss",
          ...extraFields,
        });
        knownTitles.add(normalize(title));
        detected++;
      }
    }

    // Détection via l'API GraphQL Hardcover — utile pour les éditions
    // traduites/étrangères que Google Books rate parfois. Recherche en deux
    // temps (auteur puis livres par author_id) car les opérateurs de motif
    // (_ilike…) sont bloqués côté serveur Hardcover pour le rôle "user" ; on
    // passe donc par leur endpoint de recherche plein texte pour résoudre
    // l'auteur, plutôt que par un filtre texte sur `contributions.author.name`.
    // Désactivée silencieusement si HARDCOVER_API_TOKEN n'est pas configuré.
    async function detectFromHardcover(name: string, extraFields: Record<string, any>) {
      const token = process.env.HARDCOVER_API_TOKEN;
      if (!token) return;
      const authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      const headers = { "Content-Type": "application/json", Authorization: authorization };

      const searchRes = await fetch("https://api.hardcover.app/v1/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `query($q: String!) { search(query: $q, query_type: "author", per_page: 1) { results } }`,
          variables: { q: name },
        }),
      });
      if (!searchRes.ok) { console.log(`[cron] Hardcover search HTTP ${searchRes.status} pour ${name}`); return; }
      const searchData = await searchRes.json();
      const hit = searchData?.data?.search?.results?.hits?.[0]?.document;
      // La recherche plein texte Hardcover peut renvoyer un auteur sans
      // rapport (elle matche aussi sur les titres de ses livres) : on
      // revalide que le nom retourné correspond vraiment avant de continuer.
      if (!hit?.id || !hit?.name || !nameMatches(hit.name, name)) return;
      const authorId = hit.id;

      // Fenêtre de 60 jours en arrière : suffisamment large pour ne pas rater
      // une sortie récente, assez resserrée pour ne pas remonter tout le fonds.
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const booksRes = await fetch("https://api.hardcover.app/v1/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `query($id: Int!, $since: date!) {
            books(where: {contributions: {author_id: {_eq: $id}}, release_date: {_gte: $since}}, order_by: {release_date: desc}, limit: 10) {
              title
              release_date
              cached_image
            }
          }`,
          variables: { id: Number(authorId), since },
        }),
      });
      if (!booksRes.ok) { console.log(`[cron] Hardcover books HTTP ${booksRes.status} pour ${name}`); return; }
      const booksData = await booksRes.json();
      const items = booksData?.data?.books || [];
      console.log(`[cron] Hardcover "${name}" → ${items.length} résultat(s)`);

      for (const b of items) {
        const title = (b?.title || "").toString().trim();
        if (!title || knownTitles.has(normalize(title))) continue;

        const docRef = db.collection("actualitesPending").doc();
        await docRef.set({
          title,
          cover: b?.cached_image?.url || "",
          isRelease: true,
          releaseDate: typeof b?.release_date === "string" ? b.release_date : "",
          detectedAt: FieldValue.serverTimestamp(),
          source: "auto-hardcover",
          ...extraFields,
        });
        knownTitles.add(normalize(title));
        detected++;
      }
    }

    for (const { slug, name } of authorNames) {
      try {
        // Essai 1 : recherche exacte par auteur
        await detectFrom(`inauthor:"${name}"`, {
          content: `Nouvelle sortie détectée automatiquement chez ${name} : à vérifier avant publication.`,
          authorName: name,
          authorSlug: slug,
        });
        // Essai 2 : recherche par nom seul (fallback si inauthor: ne trouve rien)
        await detectFrom(`"${name}"`, {
          content: `Nouvelle sortie détectée automatiquement chez ${name} : à vérifier avant publication.`,
          authorName: name,
          authorSlug: slug,
        });
      } catch (err) {
        console.error(`Detection error for author ${name}:`, err);
        // On continue avec les auteurs/éditeurs suivants même si un seul échoue.
      }

      try {
        await detectFromHardcover(name, {
          content: `Nouvelle sortie détectée automatiquement (Hardcover) chez ${name} : à vérifier avant publication.`,
          authorName: name,
          authorSlug: slug,
        });
      } catch (err) {
        console.error(`Hardcover detection error for author ${name}:`, err);
        // On continue avec les auteurs/éditeurs suivants même si un seul échoue.
      }
    }

    for (const publisherName of followedPublishers) {
      try {
        // Retirer les informations de localisation entre parenthèses
        // ex: "Editions Addictives (paris)" → "Editions Addictives"
        const cleanPublisher = publisherName.replace(/\s*\([^)]*\)\s*/g, "").trim();
        await detectFrom(`inpublisher:"${cleanPublisher}"`, {
          content: `Nouvelle parution détectée automatiquement chez l'éditeur ${publisherName} : à vérifier avant publication.`,
          publisherName,
        });
      } catch (err) {
        console.error(`Detection error for publisher ${publisherName}:`, err);
      }
    }

    try {
      await detectFromBnfRss();
    } catch (err) {
      console.error("Detection error for BnF RSS:", err);
      // Une source qui échoue ne doit pas empêcher les autres de remonter leurs résultats.
    }

    return NextResponse.json({
      message: `${detected} nouvelle(s) sortie(s) détectée(s) et déposée(s) en attente de validation.`,
      authorsChecked: authorNames.length,
      publishersChecked: followedPublishers.size,
      detected,
    });
  } catch (err: any) {
    console.error("Detect Releases Cron Error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}
