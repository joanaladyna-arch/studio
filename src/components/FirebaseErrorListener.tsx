
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    let lastShown = 0;
    const handlePermissionError = (error: any) => {
      console.error("LISORIA permission:", error?.message || error);
      // Une seule barre à la fois : plusieurs écoutes refusées en même temps
      // (ex. juste après la connexion) n'en font plus qu'une.
      if (Date.now() - lastShown < 8000) return;
      lastShown = Date.now();
      const where = error?.context?.path ? ` (${error.context.path})` : "";
      toast({
        variant: "destructive",
        title: "Erreur de permission Firestore",
        description: `Vous n'avez pas les droits nécessaires pour effectuer cette action.${where}`,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
