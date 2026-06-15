
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<ReturnType<typeof initializeFirebase> | null>(null);

  useEffect(() => {
    setInstances(initializeFirebase());
  }, []);

  if (!instances) return null;

  return (
    <FirebaseProvider app={instances.app} db={instances.db} auth={instances.auth}>
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
