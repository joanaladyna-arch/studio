
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
    // Si le chargement est terminé et qu'il n'y a pas d'utilisateur sur une route protégée
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login');
    }
  }, [user, loading, isPublicRoute, router]);

  // Pendant le chargement initial de Firebase
  if (loading) {
    // Si on est déjà sur une page publique, on laisse passer pour éviter de bloquer le login
    if (isPublicRoute) return <>{children}</>;

    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-[100]">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center">
             <div className="h-8 w-8 bg-primary/40 rounded-full animate-ping" />
          </div>
          <p className="font-headline italic text-primary/60 text-xl">Ouverture de votre sanctuaire...</p>
        </div>
      </div>
    );
  }

  // Si on n'est pas connecté et qu'on essaie d'accéder à une page protégée
  if (!user && !isPublicRoute) {
    return null; // Le useEffect se chargera de la redirection
  }

  // Si on est connecté ou sur une page publique
  return <>{children}</>;
}
