import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Tâche planifiée (Vercel Cron, voir vercel.json) qui détecte les
 * nouvelles sorties des auteurs suivis par au moins une lectrice, et les
 * dépose dans `actualitesPending` en attente de validation par
 * l'administratrice — jamais publiées directement (voir
 * PendingActualitesManager côté app).
 *
 * Protégée par un secret partagé (CRON_SECRET) pour qu'elle ne puisse
 * être déclenchée que par Vercel Cron, jamais par une requête publique.
 *
 * Fenêtre de détection volontairement resserrée à 45 jours après la
 * date de publication Google Books, pour ne remonter que de vraies
 * nouveautés et non tout le fonds de catalogue d'un auteur.
 */
const RECENT_WINDOW_DAYS = 45;

function normalize(s: string) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // 1. Collecte des auteurs suivis par au moins une lectrice (slugs
    // uniques), en parcourant les documents utilisatrices via l'Admin
    // SDK — celui-ci contourne les règles de sécurité normales, ce qui
    // est justement pourquoi cette route ne doit jamais être publique.
    const usersSnap = await db.collection("users").get();
    const followedSlugs = new Set<string>();
    usersSnap.forEach((doc) => {
      const followed = doc.data()?.followedAuthors;
      if (Array.isArray(followed)) followed.forEach((slug) => slug && followedSlugs.add(slug));
    });

    if (followedSlugs.size === 0) {
      return NextResponse.json({ message: "Aucun auteur suivi pour le moment.", detected: 0 });
    }

    // 2. Résolution slug → nom d'affichage via la fiche auteur partagée.
    const authorNames: { slug: string; name: string }[] = [];
    for (const slug of followedSlugs) {
      const authorDoc = await db.collection("authors").doc(slug).get();
      const name = authorDoc.exists ? (authorDoc.data()?.name || slug) : slug;
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

    const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let detected = 0;

    for (const { slug, name } of authorNames) {
      try {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`inauthor:"${name}"`)}&orderBy=newest&maxResults=5`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const items = data.items || [];

        for (const item of items) {
          const info = item.volumeInfo || {};
          const title = info.title || "";
          if (!title || knownTitles.has(normalize(title))) continue;

          const publishedDate = info.publishedDate || "";
          const publishedMillis = publishedDate ? new Date(publishedDate).getTime() : NaN;
          if (isNaN(publishedMillis) || publishedMillis < cutoff) continue;

          // Nouvelle sortie détectée : dépôt en attente de validation,
          // jamais publiée directement.
          const docRef = db.collection("actualitesPending").doc();
          await docRef.set({
            title,
            content: `Nouvelle sortie détectée automatiquement chez ${name} : "${title}", parue le ${publishedDate}. À vérifier avant publication.`,
            authorName: name,
            authorSlug: slug,
            cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
            isRelease: true,
            releaseDate: publishedDate.length === 10 ? publishedDate : "",
            detectedAt: FieldValue.serverTimestamp(),
            source: "auto-google-books",
          });
          knownTitles.add(normalize(title));
          detected++;
        }
      } catch (err) {
        console.error(`Detection error for author ${name}:`, err);
        // On continue avec les auteurs suivants même si un seul échoue.
      }
    }

    return NextResponse.json({
      message: `${detected} nouvelle(s) sortie(s) détectée(s) et déposée(s) en attente de validation.`,
      authorsChecked: authorNames.length,
      detected,
    });
  } catch (err: any) {
    console.error("Detect Releases Cron Error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}
