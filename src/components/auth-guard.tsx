
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Composant de protection des routes.
 * Redirige vers /login si l'utilisateur n'est pas authentifié,
 * sauf pour les pages de connexion et d'inscription.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login');
    }
  }, [user, loading, isPublicRoute, router]);

  // Pendant le chargement de l'auth, on ne montre rien pour éviter les flashs de contenu
  if (loading && !isPublicRoute) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 bg-primary/20 rounded-full" />
          <p className="font-headline italic text-primary/40">Ouverture de votre sanctuaire...</p>
        </div>
      </div>
    );
  }

  // Si on est sur une route protégée sans user, on bloque le rendu en attendant la redirection
  if (!user && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
