
"use client";

import { useState, useEffect } from "react";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/splash-screen";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { useUser } from "@/firebase";
import { usePathname, useRouter } from "next/navigation";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On considère que l'auth est prête dès que le chargement Firebase est fini
    if (!loading) {
      setReady(true);
    }
    // Timeout de sécurité de 3 secondes pour ne pas bloquer l'utilisateur
    const timer = setTimeout(() => {
      setReady(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!ready) return;

    // Si pas d'utilisateur et pas sur une page d'auth -> redirection login
    if (!user && pathname !== "/login" && pathname !== "/signup") {
      router.push("/login");
    } 
    // Si utilisateur connecté et sur une page d'auth -> redirection accueil
    else if (user && (pathname === "/login" || pathname === "/signup")) {
      router.push("/");
    }
  }, [user, ready, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Affichage du domaine pour configuration Firebase
    console.log("-----------------------------------------");
    console.log("PLUME - CONFIGURATION DOMAINE");
    console.log("Domaine à ajouter (Authorized Domain) :", window.location.hostname);
    console.log("-----------------------------------------");
  }, []);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem("plume-visited");
    if (hasVisited) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem("plume-visited", "true");
  };

  return (
    <html lang="fr">
      <head>
        <title>PLUME - Journal de Lecture Personnel</title>
        <meta name="description" content="Ton carnet de lecture précieux et authentique." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen pb-20 md:pb-0 overflow-x-hidden relative">
        <FirebaseClientProvider>
          <div className="fixed inset-0 pointer-events-none opacity-20 mix-blend-overlay z-[60] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
          
          {showSplash ? (
            <SplashScreen onFinish={handleSplashFinish} />
          ) : (
            <AuthGuard>
              <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
                {children}
              </main>
            </AuthGuard>
          )}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
