
'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

export function initializeFirebase() {
  // Vérification de la présence de la clé API pour éviter le crash au démarrage
  const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== "";

  if (!isConfigValid) {
    console.warn(
      "PLUME : La configuration Firebase est incomplète. " +
      "Vérifiez que vous avez bien connecté votre projet dans le panneau latéral de Firebase Studio " +
      "et que les variables d'environnement sont définies."
    );
  }

  // Initialisation sécurisée
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  return { app, db, auth };
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
