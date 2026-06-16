
'use client';

import { useState, useEffect } from 'react';
import { Query, onSnapshot, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Réinitialisation systématique : sans ça, l'ancienne collection reste
    // affichée pendant que la nouvelle se charge (ex: changement d'utilisateur,
    // changement de filtre Firestore).
    setData([]);
    setError(null);

    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(docs);
        setLoading(false);
        setError(null);
      },
      async (err) => {
        console.error("PLUME Firestore Collection Error:", err);
        // On tente de récupérer un chemin pour le contexte d'erreur
        const path = (query as any)._query?.path?.segments?.join('/') || 'query';
        
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
