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
const MAX_GOOGLE_LOOKUPS_PER_RUN = 60;

async function findGoogleCover(title: string, author: string): Promise<string | null> {
  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
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
    masterSnap.forEach((d) => {
      const data = d.data();
      const cover = (data?.cover || "").toString().trim();
      if (cover) {
        masterCovers.set(d.id, cover);
      } else if ((data?.title || "").toString().trim()) {
        masterMissingCover.push({ id: d.id, title: data.title, author: (data.author || "").toString() });
      }
    });

    let masterCoversEnriched = 0;
    const toLookUp = masterMissingCover.slice(0, MAX_GOOGLE_LOOKUPS_PER_RUN);
    for (const m of toLookUp) {
      const found = await findGoogleCover(m.title, m.author);
      if (!found) continue;
      await db.collection("masterBooks").doc(m.id).update({ cover: found });
      masterCovers.set(m.id, found);
      masterCoversEnriched++;
    }
    const masterCoversRemaining = masterMissingCover.length - toLookUp.length;

    const booksSnap = await db.collectionGroup("books").get();

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
      if (currentCover) continue;

      missingCover++;
      const masterBookId = data?.masterBookId;
      const newCover = masterBookId ? masterCovers.get(masterBookId) : undefined;
      if (!newCover) {
        stillMissing++;
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
