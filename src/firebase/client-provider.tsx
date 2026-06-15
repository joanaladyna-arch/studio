
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { initializeFirebase, FirebaseInstances } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<FirebaseInstances | null>(null);

  useEffect(() => {
    setInstances(initializeFirebase());
  }, []);

  // On attend que l'initialisation soit tentée
  if (!instances) return null;

  return (
    <FirebaseProvider 
      app={instances.app} 
      db={instances.db} 
      auth={instances.auth} 
      storage={instances.storage}
    >
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
