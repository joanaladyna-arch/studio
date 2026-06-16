
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { useUser as useUserHook } from './auth/use-user';

interface FirebaseContextType {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  db: null,
  auth: null,
  storage: null,
  user: null,
  loading: true,
});

export function FirebaseProvider({
  children,
  app,
  db,
  auth,
  storage,
}: {
  children: ReactNode;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}) {
  // Instance unique de l'écouteur d'authentification partagée par toute l'app
  const { user, loading } = useUserHook(auth);

  return (
    <FirebaseContext.Provider value={{ app, db, auth, storage, user, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);
export const useFirebaseApp = () => useContext(FirebaseContext).app;
export const useFirestore = () => useContext(FirebaseContext).db;
export const useAuth = () => useContext(FirebaseContext).auth;
export const useStorage = () => useContext(FirebaseContext).storage;

/**
 * Hook personnalisé pour accéder à l'utilisateur actuel.
 * Récupère l'état partagé depuis le FirebaseProvider.
 */
export function useUser() {
  const context = useContext(FirebaseContext);
  
  // Logs demandés pour le débogage
  console.log("AUTH USER", context.user?.uid);
  console.log("AUTH LOADING", context.loading);
  
  return { user: context.user, loading: context.loading };
}
