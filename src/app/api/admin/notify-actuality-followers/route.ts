import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAILS } from "@/lib/utils";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Fan-out des notifications "nouvelle annonce livre à paraître" vers les
 * lectrices qui suivent l'auteur ou l'éditeur concerné — appelée juste
 * après la publication d'une actualité (voir admin-actualites-queue.tsx,
 * pending-actualites-manager.tsx, actualites-manager.tsx).
 *
 * Via le SDK Admin (pas le SDK client) car il faut interroger TOUTE la
 * collection `users` par followedAuthors/followedPublishers — une
 * requête que les règles de sécurité Firestore n'ont aucune raison
 * d'autoriser depuis le navigateur, même admin.
 *
 * Protégée par vérification du token admin, comme vision-import : c'est
 * un outil déclenché depuis l'écran admin, jamais public.
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
    console.error("[notify-actuality-followers] Token verification failed:", err);
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const authorSlug = (body?.authorSlug || "").toString().trim();
  const publisherName = (body?.publisherName || "").toString().trim();
  const title = (body?.title || "").toString().trim();
  const link = (body?.link || "/actualites").toString();

  if (!authorSlug && !publisherName) {
    return NextResponse.json({ notified: 0 });
  }

  try {
    const db = getAdminDb();
    const uids = new Set<string>();

    if (authorSlug) {
      const snap = await db.collection("users").where("followedAuthors", "array-contains", authorSlug).get();
      snap.forEach((d) => uids.add(d.id));
    }
    if (publisherName) {
      const snap = await db.collection("users").where("followedPublishers", "array-contains", publisherName).get();
      snap.forEach((d) => uids.add(d.id));
    }

    if (uids.size === 0) {
      return NextResponse.json({ notified: 0 });
    }

    const batch = db.batch();
    uids.forEach((uid) => {
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        type: "upcoming_release",
        title: "Nouvelle annonce !",
        body: title ? `Une nouvelle actualité vient de paraître : "${title}".` : "Une nouvelle actualité vient de paraître.",
        link,
        targetUid: uid,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return NextResponse.json({ notified: uids.size });
  } catch (err) {
    console.error("[notify-actuality-followers] Error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
