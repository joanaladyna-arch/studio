
'use client';

import { useUser } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const publicRoutes = ["/login", "/signup"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && !publicRoutes.includes(pathname)) {
        console.log("PLUME AuthGuard: Pas d'utilisateur, redirection vers /login");
        router.replace("/login");
      } else if (user && publicRoutes.includes(pathname)) {
        console.log("PLUME AuthGuard: Utilisateur déjà connecté, redirection vers /");
        router.replace("/");
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="font-headline italic text-primary/60 text-2xl animate-pulse">Ouverture de votre réserve...</p>
        </div>
      </div>
    );
  }

  // Permettre l'accès aux pages publiques si déconnecté
  if (!user && publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  // Ne rien afficher si on attend la redirection
  if (!user) return null;

  return <>{children}</>;
}
