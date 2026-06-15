
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    // Si Firebase a fini de vérifier l'état
    if (!loading) {
      if (user && isPublicRoute) {
        console.log("PLUME AuthGuard: Utilisateur connecté sur route publique, redirection vers /");
        router.replace('/');
      } else if (!user && !isPublicRoute) {
        console.log("PLUME AuthGuard: Utilisateur non connecté sur route privée, redirection vers /login");
        router.replace('/login');
      }
    }
  }, [user, loading, isPublicRoute, router]);

  // Pendant le chargement, on laisse l'interface telle quelle (le layout gère le splash screen ou loader)
  if (loading) {
    return <>{children}</>;
  }

  // Empêcher l'affichage du contenu privé si pas d'utilisateur (pendant la redirection)
  if (!user && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
