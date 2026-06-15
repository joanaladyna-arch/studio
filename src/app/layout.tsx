"use client";

import { useState, useEffect } from "react";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/splash-screen";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showSplash, setShowSplash] = useState(true);

  // Éviter l'effet de flash blanc avant l'animation si possible
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
        <title>PLUME</title>
        <meta name="description" content="Ton journal de lecture personnel." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen pb-20 md:pb-0 overflow-x-hidden">
        {showSplash ? (
          <SplashScreen onFinish={handleSplashFinish} />
        ) : (
          <main className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-1000">
            {children}
          </main>
        )}
        <Toaster />
      </body>
    </html>
  );
}