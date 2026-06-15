
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      // In production, we might just log this, but in development 
      // the studio handles showing the contextual error.
      toast({
        variant: "destructive",
        title: "Erreur de permission Firestore",
        description: "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
