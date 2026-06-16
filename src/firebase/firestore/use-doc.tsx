
'use client';

import { useState, useEffect } from 'react';
import { DocumentReference, onSnapshot, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useDoc<T = DocumentData>(ref: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // On réinitialise systématiquement l'état au changement de référence,
    // sinon l'ancien document reste affiché brièvement (ou indéfiniment en
    // cas d'erreur) pendant que le nouveau se charge.
    setData(null);
    setError(null);

    if (!ref) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      ref,
      (doc) => {
        setData(doc.data() || null);
        setLoading(false);
        setError(null);
      },
      async (err) => {
        console.error("PLUME Firestore Doc Error:", err);
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [ref?.path]);

  return { data, loading, error };
}
