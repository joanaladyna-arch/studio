
"use client";

import { useState, useEffect } from "react";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/splash-screen";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Navigation } from "@/components/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AdminModeProvider } from "@/components/admin-mode";
import { AdminModeBar } from "@/components/admin-mode-bar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem("lectoria-visited");
    if (hasVisited) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem("lectoria-visited", "true");
  };

  return (
    <html lang="fr">
      <head>
        <title>LECTORIA - Journal de Lecture Personnel</title>
        <meta name="description" content="Ton carnet de lecture précieux et authentique." />
        
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lectoria" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#fdf2f5" />
        
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen overflow-x-hidden relative flex flex-col">
        <FirebaseClientProvider>
          <div className="fixed inset-0 pointer-events-none opacity-20 mix-blend-overlay z-[60] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
          
          {showSplash ? (
            <SplashScreen onFinish={handleSplashFinish} />
          ) : (
            <AuthGuard>
              <AdminModeProvider>
                <Navigation />
                <AdminModeBar />
                <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 md:pt-28 md:pb-16 w-full">
                  {children}
                </main>
              </AdminModeProvider>
            </AuthGuard>
          )}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
