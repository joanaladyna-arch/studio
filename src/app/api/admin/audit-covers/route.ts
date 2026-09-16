import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, AdminConfigError } from "@/lib/firebase-admin";
import { ADMIN_EMAILS, fetchWithTimeout } from "@/lib/utils";

/**
 * Réparation en masse des couvertures manquantes dans les bibliothèques
 * personnelles. Chaque livre ajouté copie sa couverture depuis le
 * résultat de recherche choisi au moment de l'ajout (voir confirmAdd
 * dans /add) ; si cette recherche n'avait alors ramené aucune couverture
 * — une fiche masterBooks pas encore enrichie, une source (BnF...) qui
 * n'en fournissait pas — la lectrice restait avec une fiche vide pour
 * toujours, même après que la fiche partagée masterBooks a ensuite reçu
 * une vraie couverture (curation admin, enrichissement ISBNdb...).
 *
 * Deux étapes :
 * 1. Pour chaque fiche masterBooks encore sans couverture, tente une
 *    recherche Google Books par titre/auteur (l'outil "Compléter les
 *    champs manquants (ISBNdb)" existant ne couvre que les fiches ayant
 *    déjà un ISBN, ISBNdb ne cherchant qu'en exact — beaucoup de fiches
 *    ajoutées par titre/auteur n'en ont jamais eu). Plafonné par passage
 *    pour rester sous le temps d'exécution serverless — relancer l'audit
 *    poursuit sur les fiches restantes.
 * 2. Recopie, pour chaque livre personnel sans couverture, celle de sa
 *    fiche masterBooks liée si elle en a une (déjà là ou tout juste
 *    trouvée à l'étape 1). Ne touche jamais aux livres sans masterBookId
 *    (ajout manuel — souvent de l'auto-édition que seule la lectrice
 *    peut illustrer elle-même) ni à ceux dont la fiche masterBooks n'a
 *    toujours pas de couverture.
 */
// Traités en parallèle par petits lots plutôt qu'un par un : sur le
// plan Hobby de Vercel, la fonction serverless a un temps d'exécution
// limité, et le faire en série (une recherche Google Books à la fois)
// ne permettait de traiter qu'une poignée de fiches par clic sur une
// bibliothèque de plusieurs centaines de livres.
const MAX_GOOGLE_LOOKUPS_PER_RUN = 300;
const CONCURRENCY = 12;
export const maxDuration = 60;

async function queryGoogleBooks(q: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    const thumbnail = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    return thumbnail ? thumbnail.replace("http://", "https://") : null;
  } catch {
    return null;
  }
}

async function findGoogleCover(title: string, author: string): Promise<string | null> {
  // "Rina Kent, Marie Bagot" (auteur + traductrice, souvent stockés
  // ensemble) fait échouer inauthor: sur le second nom — on ne garde que
  // le premier pour la recherche stricte.
  const primaryAuthor = author.split(",")[0]?.trim() || "";
  const strict = primaryAuthor ? `intitle:${title} inauthor:${primaryAuthor}` : `intitle:${title}`;
  const found = await queryGoogleBooks(strict);
  if (found) return found;

  // Repli en recherche libre (sans opérateurs de champ) : meilleur
  // rappel sur les titres/traductions que Google Books indexe mal avec
  // intitle/inauthor stricts, au prix d'une précision un peu moindre —
  // acceptable ici puisqu'on ne prend que le tout premier résultat.
  if (primaryAuthor) return queryGoogleBooks(`${title} ${primaryAuthor}`);
  return null;
}

// L'ancienne "garantie couverture" de /add devinait une URL Open
// Library depuis l'ISBN sans jamais vérifier qu'une vraie couverture
// existe pour cet ISBN (retirée depuis, voir confirmAdd). Les fiches
// déjà créées avec cette URL ont un champ `cover` non vide — jamais
// détectées comme manquantes — mais l'API Open Library répond 200 avec
// une image 1×1 transparente quand elle n'a rien : invisible à
// l'écran, indiscernable d'un vrai bug sans vérifier le fichier
// lui-même. Une vraie couverture fait au minimum plusieurs dizaines de
// Ko ; le repli transparent fait moins d'1 Ko.
async function isFakeOpenLibraryCover(url: string): Promise<boolean> {
  if (!/covers\.openlibrary\.org\/b\/isbn\//.test(url)) return false;
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD" }, 6000);
    if (!res.ok) return true;
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    return len > 0 && len < 1000;
  } catch {
    return true;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
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
  } catch (err: any) {
    console.error("[audit-covers] Token verification failed:", err);
    if (err instanceof AdminConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const reason = err?.errorInfo?.code || err?.code || err?.message || "raison inconnue";
    return NextResponse.json({ error: `Token invalide : ${reason}` }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    const masterSnap = await db.collection("masterBooks").get();
    const masterCovers = new Map<string, string>();
    const masterMissingCover: { id: string; title: string; author: string }[] = [];
    const suspectCovers: { id: string; title: string; author: string; cover: string }[] = [];
    masterSnap.forEach((d) => {
      const data = d.data();
      const cover = (data?.cover || "").toString().trim();
      const title = (data?.title || "").toString().trim();
      if (cover && /covers\.openlibrary\.org\/b\/isbn\//.test(cover)) {
        if (title) suspectCovers.push({ id: d.id, title, author: (data.author || "").toString(), cover });
      } else if (cover) {
        masterCovers.set(d.id, cover);
      } else if (title) {
        masterMissingCover.push({ id: d.id, title, author: (data.author || "").toString() });
      }
    });

    // Vérifie les couvertures Open Library "devinées" par l'ancienne
    // logique (voir isFakeOpenLibraryCover ci-dessus) : les vraies
    // rejoignent masterCovers normalement, les fausses rejoignent la
    // liste à ré-enrichir comme si elles n'avaient jamais eu de champ
    // cover, et sont vidées en base pour ne pas rester bloquées ainsi
    // si aucun remplacement n'est trouvé cette fois.
    const suspectResults = await mapWithConcurrency(suspectCovers, CONCURRENCY, async (s) => ({
      ...s,
      isFake: await isFakeOpenLibraryCover(s.cover),
    }));
    const clearBatch = db.batch();
    let clearOps = 0;
    for (const s of suspectResults) {
      if (s.isFake) {
        masterMissingCover.push({ id: s.id, title: s.title, author: s.author });
        clearBatch.update(db.collection("masterBooks").doc(s.id), { cover: "" });
        clearOps++;
      } else {
        masterCovers.set(s.id, s.cover);
      }
    }
    if (clearOps > 0) await clearBatch.commit();

    const toLookUp = masterMissingCover.slice(0, MAX_GOOGLE_LOOKUPS_PER_RUN);
    const found = await mapWithConcurrency(toLookUp, CONCURRENCY, (m) => findGoogleCover(m.title, m.author));

    let masterCoversEnriched = 0;
    let enrichBatch = db.batch();
    let enrichOps = 0;
    const enrichCommits: Promise<unknown>[] = [];
    for (let i = 0; i < toLookUp.length; i++) {
      const cover = found[i];
      if (!cover) continue;
      enrichBatch.update(db.collection("masterBooks").doc(toLookUp[i].id), { cover });
      masterCovers.set(toLookUp[i].id, cover);
      masterCoversEnriched++;
      enrichOps++;
      if (enrichOps >= 450) {
        enrichCommits.push(enrichBatch.commit());
        enrichBatch = db.batch();
        enrichOps = 0;
      }
    }
    if (enrichOps > 0) enrichCommits.push(enrichBatch.commit());
    await Promise.all(enrichCommits);
    const masterCoversRemaining = masterMissingCover.length - toLookUp.length;

    const booksSnap = await db.collectionGroup("books").get();

    // Un livre personnel peut avoir hérité directement de la fausse
    // couverture Open Library au moment de l'ajout (resolvedCover
    // copiait alors telle quelle la couverture "devinée" du résultat de
    // recherche) — indépendamment de ce que sa fiche masterBooks a comme
    // valeur aujourd'hui. Un `cover` non vide mais factice doit être
    // traité comme manquant ici aussi, sans quoi ce livre reste invisible
    // pour toujours malgré tous les passages de l'audit.
    const suspectUserBooks = booksSnap.docs.filter((d) => {
      const cover = (d.data()?.cover || "").toString().trim();
      return cover && /covers\.openlibrary\.org\/b\/isbn\//.test(cover);
    });
    const fakeUserBookIds = new Set<string>();
    if (suspectUserBooks.length > 0) {
      const verified = await mapWithConcurrency(suspectUserBooks, CONCURRENCY, async (d) => ({
        id: d.id,
        isFake: await isFakeOpenLibraryCover((d.data()?.cover || "").toString().trim()),
      }));
      for (const v of verified) if (v.isFake) fakeUserBookIds.add(v.id);
    }

    let scanned = 0;
    let missingCover = 0;
    let repaired = 0;
    let stillMissing = 0;

    let batch = db.batch();
    let opsInBatch = 0;
    const commits: Promise<unknown>[] = [];
    const flushIfFull = async () => {
      if (opsInBatch >= 450) {
        commits.push(batch.commit());
        batch = db.batch();
        opsInBatch = 0;
      }
    };

    for (const docSnap of booksSnap.docs) {
      scanned++;
      const data = docSnap.data();
      const currentCover = (data?.cover || "").toString().trim();
      const isFake = fakeUserBookIds.has(docSnap.id);
      if (currentCover && !isFake) continue;

      missingCover++;
      const masterBookId = data?.masterBookId;
      const newCover = masterBookId ? masterCovers.get(masterBookId) : undefined;
      if (!newCover) {
        stillMissing++;
        // Vide au moins la fausse couverture (plutôt que la laisser
        // invisible mais "présente") même si aucun remplacement n'a été
        // trouvé cette fois — un prochain enrichissement de la fiche
        // partagée pourra alors la repérer et la corriger.
        if (isFake) {
          batch.update(docSnap.ref, { cover: "" });
          opsInBatch++;
          await flushIfFull();
        }
        continue;
      }

      batch.update(docSnap.ref, { cover: newCover });
      opsInBatch++;
      repaired++;
      await flushIfFull();
    }
    if (opsInBatch > 0) commits.push(batch.commit());
    await Promise.all(commits);

    return NextResponse.json({
      scanned, missingCover, repaired, stillMissing,
      masterCoversEnriched, masterCoversRemaining,
    });
  } catch (err: any) {
    console.error("[audit-covers] Error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}
