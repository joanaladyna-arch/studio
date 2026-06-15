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
 * Initialise les services Firebase de manière sécurisée.
 * Si la configuration est incomplète (notamment la clé API),
 * les services retourneront null pour éviter de bloquer l'application.
 */
export function initializeFirebase(): FirebaseInstances {
  // Vérification de la présence des clés minimales requises par Firebase SDK
  const hasConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

  if (!hasConfig) {
    console.warn(
      "PLUME : La configuration Firebase est incomplète (clé API ou ID de projet manquant). " +
      "Veuillez lier votre projet dans Firebase Studio pour activer l'authentification et la base de données."
    );
    return { app: null, db: null, auth: null };
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // getAuth est particulièrement sensible à la validité de l'apiKey
    let auth: Auth | null = null;
    try {
      auth = getAuth(app);
    } catch (authError) {
      console.error("PLUME : Impossible d'initialiser Firebase Auth (clé API invalide ?)", authError);
    }

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
