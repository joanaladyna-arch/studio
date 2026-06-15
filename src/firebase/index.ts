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
 * Initialise les services Firebase de manière robuste.
 * Vérifie la présence de la clé API avant toute tentative d'initialisation
 * pour éviter l'erreur auth/invalid-api-key.
 */
export function initializeFirebase(): FirebaseInstances {
  // Vérification stricte de la configuration
  const { apiKey, projectId } = firebaseConfig;
  const isConfigValid = !!apiKey && apiKey !== "undefined" && !!projectId;

  if (!isConfigValid) {
    if (typeof window !== 'undefined') {
      console.warn(
        "PLUME : Configuration Firebase manquante ou clé API invalide.\n" +
        "Veuillez vérifier vos variables d'environnement NEXT_PUBLIC_FIREBASE_*.\n" +
        "L'authentification et Firestore sont désactivés pour le moment."
      );
    }
    return { app: null, db: null, auth: null };
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    return { app, db, auth };
  } catch (error) {
    console.error("PLUME : Erreur critique lors de l'initialisation de Firebase", error);
    return { app: null, db: null, auth: null };
  }
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
