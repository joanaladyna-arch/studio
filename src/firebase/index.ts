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
 * Vérifie la validité des clés avant toute tentative pour éviter l'erreur auth/invalid-api-key.
 */
export function initializeFirebase(): FirebaseInstances {
  const { apiKey, projectId } = firebaseConfig;
  
  // Vérification stricte : si la clé est absente, "undefined" (string) ou vide, on n'initialise pas.
  const isConfigValid = 
    !!apiKey && 
    apiKey !== "undefined" && 
    apiKey !== "" && 
    !!projectId && 
    projectId !== "undefined" && 
    projectId !== "";

  if (!isConfigValid) {
    if (typeof window !== 'undefined') {
      console.warn(
        "PLUME : Configuration Firebase manquante ou clé API invalide.\n" +
        "L'application fonctionne en mode hors-ligne. Connectez votre projet dans l'onglet Firebase pour activer l'authentification."
      );
    }
    return { app: null, db: null, auth: null };
  }

  try {
    // initializeApp accepte parfois des configs invalides sans crash immédiat...
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    // ...mais c'est ici (getAuth) que le crash auth/invalid-api-key survient si l'API Key est mauvaise.
    const auth = getAuth(app);
    const db = getFirestore(app);

    return { app, db, auth };
  } catch (error) {
    console.error("PLUME : Erreur lors de l'accès aux services Firebase. Vérifiez vos clés API.", error);
    return { app: null, db: null, auth: null };
  }
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
