import { addDoc, collection, serverTimestamp, type Firestore } from "firebase/firestore";

/**
 * Le Lounge : demandes de reco, fil d'activité, signalements.
 *
 * Collections Firestore (règles à ajouter dans la console, voir README du
 * Lounge dans la réponse de mise en ligne) :
 *  - recoRequests/{id}            { uid, name, avatarUrl, text, tags[], createdAt }
 *  - recoRequests/{id}/answers/{id} { uid, name, avatarUrl, title, author, cover, masterBookId, note, createdAt }
 *  - activity/{id}                { uid, name, avatarUrl, type: "finished" | "review", title, author, cover, rating, createdAt }
 *  - reports/{id}                 { kind, targetPath, reporterUid, createdAt }
 */

export type RecoAnswer = {
  id: string;
  uid: string;
  name: string;
  avatarUrl?: string;
  title: string;
  author: string;
  cover?: string;
  masterBookId?: string;
  note?: string;
};

export type RecoRequest = {
  id: string;
  uid: string;
  name: string;
  avatarUrl?: string;
  text: string;
  tags: string[];
  createdAt?: any;
};

export type ActivityItem = {
  id: string;
  uid: string;
  name: string;
  avatarUrl?: string;
  type: "finished" | "review";
  title: string;
  author?: string;
  cover?: string;
  rating?: number;
  createdAt?: any;
};

export function relativeTime(ts: any): string {
  const ms = ts?.toMillis?.() ?? (typeof ts === "number" ? ts : 0);
  if (!ms) return "à l'instant";
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 30) return `il y a ${d} jours`;
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function prefillLink(b: { title: string; author?: string; cover?: string; masterBookId?: string }): string {
  return `/add?prefill=${encodeURIComponent(JSON.stringify({ title: b.title, author: b.author || "", cover: b.cover || "", masterBookId: b.masterBookId || "" }))}`;
}

export async function reportContent(db: Firestore, uid: string, kind: string, targetPath: string) {
  await addDoc(collection(db, "reports"), { kind, targetPath, reporterUid: uid, createdAt: serverTimestamp() });
}

/**
 * Publie un événement dans le fil, uniquement si la lectrice a activé
 * "Partager mon activité" (users/{uid}.shareActivity). Jamais bloquant :
 * un échec ici ne doit jamais empêcher l'enregistrement d'un livre.
 */
export async function emitActivity(
  db: Firestore,
  user: { uid: string },
  profile: any,
  ev: { type: ActivityItem["type"]; title: string; author?: string; cover?: string; rating?: number }
) {
  if (!profile?.shareActivity) return;
  try {
    await addDoc(collection(db, "activity"), {
      uid: user.uid,
      name: profile?.name || "Lectrice Lectoria",
      avatarUrl: profile?.avatarUrl || "",
      type: ev.type,
      title: ev.title,
      author: ev.author || "",
      cover: ev.cover || "",
      rating: ev.rating || 0,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Emit activity:", err);
  }
}

export const RULES_HINT = "Firestore refuse l'accès : les règles du Lounge (recoRequests, activity, reports) doivent être ajoutées dans la console Firebase.";
