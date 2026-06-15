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
 * Initialise les services Firebase pour plume-f3424 de manière directe.
 */
export function initializeFirebase(): FirebaseInstances {
  try {
    // Initialisation forcée avec la config directe
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    return { app, db, auth };
  } catch (error) {
    console.error("PLUME : Erreur fatale lors de l'initialisation Firebase.", error);
    // Retourne des instances nulles au lieu de faire planter l'app
    return { app: null, db: null, auth: null };
  }
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
