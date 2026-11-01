import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

/**
 * Envoi de notifications push (FCM) aux appareils enregistrés des lectrices
 * (users/{uid}.fcmTokens, remplis quand elles activent les alertes depuis la
 * cloche). Jamais bloquant : un échec de push ne doit pas empêcher la
 * notification dans l'app. Les jetons devenus invalides sont retirés.
 */
export async function sendPush(uids: string[], msg: { title: string; body?: string; link?: string }): Promise<number> {
  if (uids.length === 0) return 0;
  try {
    const db = getAdminDb();
    const messaging = await getAdminMessaging();
    let sent = 0;
    for (const uid of uids) {
      const snap = await db.collection("users").doc(uid).get();
      const tokens: string[] = (snap.data()?.fcmTokens || []).filter((t: unknown) => typeof t === "string");
      if (tokens.length === 0) continue;
      const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: msg.title, body: msg.body || "" },
        data: { link: msg.link || "/" },
        webpush: { fcmOptions: { link: msg.link || "/" }, notification: { icon: "/icon-192-v4.png", badge: "/icon-192-v4.png" } },
      });
      sent += res.successCount;
      const dead: string[] = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code || "";
        if (!r.success && (code.includes("registration-token-not-registered") || code.includes("invalid-argument") || code.includes("invalid-registration-token"))) dead.push(tokens[i]);
      });
      if (dead.length) await db.collection("users").doc(uid).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
    }
    return sent;
  } catch (err) {
    console.error("[push] sendPush error:", err);
    return 0;
  }
}
