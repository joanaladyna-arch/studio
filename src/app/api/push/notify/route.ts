import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAILS } from "@/lib/utils";
import { sendPush } from "@/lib/push-server";

/**
 * Envoie la notification push correspondant à un document `notifications`
 * qui vient d'être créé côté client (réponse à une demande de reco, nouvelle
 * abonnée...). L'appelante doit être l'auteure de la notification
 * (fromUid) ou l'administratrice ; chaque notification n'est poussée
 * qu'une seule fois (champ pushed).
 */
const PUSHABLE = ["reco_answer", "new_follower"];

export async function POST(req: NextRequest) {
  const idToken = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!idToken) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let uid = "";
  let isAdmin = false;
  try {
    const decoded = await (await getAdminAuth()).verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = !!decoded.email && ADMIN_EMAILS.includes(decoded.email);
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = (body?.notificationId || "").toString();
  if (!id) return NextResponse.json({ error: "notificationId manquant" }, { status: 400 });

  try {
    const ref = getAdminDb().collection("notifications").doc(id);
    const snap = await ref.get();
    const n: any = snap.data();
    if (!n || n.pushed || !n.targetUid || !PUSHABLE.includes(n.type)) return NextResponse.json({ sent: 0 });
    if (n.fromUid !== uid && !isAdmin) return NextResponse.json({ error: "Interdit" }, { status: 403 });
    await ref.update({ pushed: true });
    const sent = await sendPush([n.targetUid], { title: n.title, body: n.body, link: n.link });
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[push/notify] Error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
