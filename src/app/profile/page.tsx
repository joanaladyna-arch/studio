"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Settings, FileText, TrendingUp, BookOpenCheck, Share2, Link2, Palette, Crown, BadgeCheck, FileArchive, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "soft", label: "Doux pastel", color: "bg-[#fdf2f5]" },
  { id: "cosy", label: "Bibliothèque cosy", color: "bg-[#f5e6d3]" },
  { id: "night", label: "Mode nuit", color: "bg-slate-900" },
  { id: "romantasy", label: "Romantasy", color: "bg-[#2a1a3a]" },
  { id: "minimal", label: "Minimaliste", color: "bg-white" },
];

const ICONS = [
  "Plume Classique", "Plume Diamant", "Plume Royale", "Plume Sakura", "Plume Nuit", "Plume BookTok"
];

export default function ProfilePage() {
  const [currentTheme, setCurrentTheme] = useState("soft");

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
              <AvatarImage src="https://picsum.photos/seed/user/100/100" />
              <AvatarFallback>PL</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white shadow-sm">
              <Crown className="h-3 w-3" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-headline">Léa Plume</h1>
            <p className="text-muted-foreground italic text-sm">“Perdue entre deux chapitres.”</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="rounded-full"><Settings className="h-5 w-5" /></Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2 rounded-2xl hover:bg-white/60">
           <Link href="/share">
              <Share2 className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold">Fiches Partage</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2 rounded-2xl hover:bg-white/60">
           <Link href="/connections">
              <Link2 className="h-5 w-5 text-blue-500" />
              <span className="text-xs font-bold">Connexions</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2 rounded-2xl hover:bg-white/60">
           <Link href="/passport">
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-xs font-bold">Mon Passeport</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2 rounded-2xl hover:bg-white/60">
           <Link href="/subscription">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-bold">Abonnement</span>
           </Link>
        </Button>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-headline flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" /> Mon Apparence
        </h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold mb-3 flex items-center gap-2">Thèmes <Badge variant="secondary" className="text-[8px] h-4">Plume Plus</Badge></p>
            <div className="flex flex-wrap gap-4">
              {THEMES.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setCurrentTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 group transition-all",
                    currentTheme === t.id ? "scale-105" : "opacity-60"
                  )}
                >
                  <div className={cn("h-12 w-12 rounded-2xl border-2 shadow-sm", t.color, currentTheme === t.id ? "border-primary" : "border-transparent")} />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold mb-3">Icônes personnalisées</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <Badge key={icon} variant="outline" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors py-1.5 px-3 rounded-lg border-primary/20">
                  {icon}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline flex items-center gap-2">
           <FileArchive className="h-6 w-6 text-primary" /> Mes Archives
        </h2>
        <Card className="bg-primary/5 border-dashed border-primary/30 rounded-2xl overflow-hidden">
          <CardContent className="p-6 text-center space-y-2">
             <Sparkles className="h-8 w-8 mx-auto text-primary/40" />
             <h3 className="font-bold">Archives Annuelles</h3>
             <p className="text-xs text-muted-foreground italic">“Garde une trace historique de tes années de lecture sous forme d'album numérique.”</p>
             <p className="text-[10px] text-primary font-bold pt-2 uppercase tracking-widest">Fonction optionnelle non activée</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline">Bilan de l'année 2024</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium italic text-primary">Objectif annuel : 24 livres</span>
            <span className="font-bold text-primary">50%</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-primary w-1/2 rounded-full transition-all duration-1000" />
          </div>
        </div>
      </section>
    </div>
  );
}
