'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

export type FirebaseInstances = {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
};

/**
 * Initialise les services Firebase pour plume-f3424.
 */
export function initializeFirebase(): FirebaseInstances {
  try {
    // On ne tente l'initialisation que si la clé API est présente
    if (!firebaseConfig.apiKey) {
      console.warn("PLUME : La clé API Firebase est manquante. L'authentification sera désactivée.");
      return { app: null, db: null, auth: null };
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    return { app, db, auth };
  } catch (error) {
    console.error("PLUME : Erreur lors de l'initialisation Firebase.", error);
    return { app: null, db: null, auth: null };
  }
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
