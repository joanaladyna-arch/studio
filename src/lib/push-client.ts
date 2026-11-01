"use client";

import { getApp } from "firebase/app";
import { arrayRemove, arrayUnion, doc, updateDoc, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

/**
 * Notifications push (FCM) côté navigateur : la lectrice les active depuis la
 * cloche ; son jeton d'appareil est rangé dans users/{uid}.fcmTokens et le
 * serveur (lib/push-server.ts) s'en sert pour envoyer l'alerte même quand
 * Lectoria n'est pas ouverte. Nécessite NEXT_PUBLIC_FIREBASE_VAPID_KEY
 * (Firebase → Paramètres → Cloud Messaging → certificat Web Push).
 */
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
const TOKEN_KEY = "lectoria-fcm-token";
const SCOPE = "/firebase-cloud-messaging-push-scope";

export type PushState = "unsupported" | "no-key" | "denied" | "off" | "on";

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return "unsupported";
  try {
    const { isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return "unsupported";
  } catch {
    return "unsupported";
  }
  if (!VAPID_KEY) return "no-key";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && localStorage.getItem(TOKEN_KEY) ? "on" : "off";
}

function registerSW() {
  const q = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${q.toString()}`, { scope: SCOPE });
}

export async function enablePush(db: Firestore, uid: string): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await registerSW();
  const { getMessaging, getToken } = await import("firebase/messaging");
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return "off";
  await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
  localStorage.setItem(TOKEN_KEY, token);
  return "on";
}

export async function disablePush(db: Firestore, uid: string): Promise<PushState> {
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    await deleteToken(getMessaging(getApp()));
  } catch {
    /* le jeton sera de toute façon retiré de la liste */
  }
  if (token) await updateDoc(doc(db, "users", uid), { fcmTokens: arrayRemove(token) });
  localStorage.removeItem(TOKEN_KEY);
  return "off";
}
