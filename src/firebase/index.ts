
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

export type FirebaseInstances = {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
};

/**
 * Initialise les services Firebase pour plume-f3424 de manière directe.
 */
export function initializeFirebase(): FirebaseInstances {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    return { app, db, auth, storage };
  } catch (error) {
    console.error("PLUME : Erreur fatale lors de l'initialisation Firebase.", error);
    return { app: null, db: null, auth: null, storage: null };
  }
}

// L'export de useUser vient maintenant de provider.tsx (version Context)
export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
// On supprime l'export direct de useUser d'ici pour éviter le conflit avec celui du provider
