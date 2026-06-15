"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Music, Library, BookOpen, Globe, Headphones, ExternalLink } from "lucide-react";

const PLATFORMS = [
  { name: "Instagram", icon: Instagram, color: "text-pink-500", desc: "Partagez vos lectures en Story" },
  { name: "TikTok", icon: Music, color: "text-slate-900", desc: "Rejoignez la communauté BookTok" },
  { name: "Babelio", icon: BookOpen, color: "text-orange-500", desc: "Importez vos critiques" },
  { name: "Goodreads", icon: Globe, color: "text-amber-800", desc: "Synchronisez votre bibliothèque" },
  { name: "Audible", icon: Headphones, color: "text-amber-500", desc: "Journal d'écoute automatique" },
  { name: "Google Books", icon: Library, color: "text-blue-500", desc: "Recherche enrichie" },
];

export default function ConnectionsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline">Connexions</h1>
        <p className="text-muted-foreground">Centralisez votre univers littéraire en connectant vos plateformes préférées.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => (
          <Card key={p.name} className="glass-card overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className={cn("p-2 rounded-xl bg-white/80 shadow-sm", p.color)}>
                <p.icon className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <CardDescription className="text-xs">{p.desc}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <Badge variant="secondary" className="bg-muted text-[10px]">Bientôt disponible</Badge>
              <Button disabled size="sm" variant="outline">
                Connecter <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}