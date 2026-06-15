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

export function initializeFirebase(): FirebaseInstances {
  // Vérification basique de la configuration
  const hasConfig = !!firebaseConfig.projectId;

  if (!hasConfig) {
    console.warn(
      "PLUME : La configuration Firebase semble incomplète. " +
      "Veuillez lier votre projet dans le panneau Firebase Studio pour activer les services."
    );
    return { app: null, db: null, auth: null };
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    return { app, db, auth };
  } catch (error) {
    console.error("PLUME : Erreur lors de l'initialisation de Firebase", error);
    return { app: null, db: null, auth: null };
  }
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
