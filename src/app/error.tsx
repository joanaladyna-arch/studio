"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log utile pour le débogage, sans jamais exposer la stack à l'utilisatrice
    console.error("LECTORIA — Erreur d'affichage interceptée :", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="glass-card max-w-md w-full p-10 text-center space-y-6 border-none shadow-2xl bg-white/70">
        <div className="mx-auto h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-headline italic">Une page s'est froissée</h1>
          <p className="text-sm text-muted-foreground italic leading-relaxed">
            Quelque chose ne s'est pas affiché correctement. Ce n'est pas grave — vos données sont en sécurité, il suffit de réessayer.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button onClick={() => reset()} className="flex-1 rounded-2xl bg-primary hover:bg-primary/90 font-headline italic h-12">
            <RotateCcw className="mr-2 h-4 w-4" /> Réessayer
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-2xl font-headline italic h-12">
            <Link href="/"><Home className="mr-2 h-4 w-4" /> Accueil</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
