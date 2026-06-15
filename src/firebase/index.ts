
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

export function initializeFirebase() {
  // Vérification de la validité de la config avant initialisation
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "placeholder-key") {
    console.warn("Firebase API Key is missing or invalid. Please check your environment variables.");
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  return { app, db, auth };
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
