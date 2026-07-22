import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
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
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=newest&maxResults=10`;
      const res = await fetch(url);
      if (!res.ok) { console.log(`[cron] HTTP ${res.status} pour query: ${query}`); return; }
      const data = await res.json();
      const items = data.items || [];
      console.log(`[cron] query="${query}" → ${items.length} résultat(s)`);
      if (items.length > 0) {
        const sample = items[0]?.volumeInfo;
        console.log(`[cron] premier résultat: "${sample?.title}" (${sample?.publishedDate})`);
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

    for (const { slug, name } of authorNames) {
      try {
        await detectFrom(`inauthor:"${name}"`, {
          content: `Nouvelle sortie détectée automatiquement chez ${name} : à vérifier avant publication.`,
          authorName: name,
          authorSlug: slug,
        });
      } catch (err) {
        console.error(`Detection error for author ${name}:`, err);
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
