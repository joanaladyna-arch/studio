import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAILS } from "@/lib/utils";

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
 * Cette route recopie, pour chaque livre personnel sans couverture, celle
 * de sa fiche masterBooks liée si elle en a une désormais. Elle ne touche
 * jamais aux livres sans masterBookId (ajout manuel — souvent de
 * l'auto-édition que seule la lectrice peut illustrer elle-même) ni à
 * ceux dont la fiche masterBooks n'a toujours pas de couverture.
 */
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
    console.error("[audit-covers] Token verification failed:", err);
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    const masterSnap = await db.collection("masterBooks").get();
    const masterCovers = new Map<string, string>();
    masterSnap.forEach((d) => {
      const cover = (d.data()?.cover || "").toString().trim();
      if (cover) masterCovers.set(d.id, cover);
    });

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

    return NextResponse.json({ scanned, missingCover, repaired, stillMissing });
  } catch (err: any) {
    console.error("[audit-covers] Error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}
