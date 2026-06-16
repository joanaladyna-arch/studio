
'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';

export function useUser(auth: Auth | null) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Log pour vérifier que onAuthStateChanged met bien à jour l'utilisateur
      console.log("PLUME Auth State Change (onAuthStateChanged):", firebaseUser ? `Connecté (UID: ${firebaseUser.uid})` : "Déconnecté");
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
