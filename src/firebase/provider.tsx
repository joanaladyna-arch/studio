
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { useUser as useUserHook } from './auth/use-user';

interface FirebaseContextType {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  db: null,
  auth: null,
  storage: null,
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
  return (
    <FirebaseContext.Provider value={{ app, db, auth, storage }}>
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
 */
export function useUser() {
  const { auth } = useFirebase();
  return useUserHook(auth);
}
