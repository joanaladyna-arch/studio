"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Settings, FileText, TrendingUp, BookOpenCheck, Share2, Link2, Palette, Crown, BadgeCheck } from "lucide-react";
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
            <Avatar className="h-20 w-20 border-4 border-primary/20">
              <AvatarImage src="https://picsum.photos/seed/user/100/100" />
              <AvatarFallback>PL</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white">
              <Crown className="h-3 w-3" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-headline">Léa Plume</h1>
            <p className="text-muted-foreground">Lectrice Royale depuis 2018</p>
          </div>
        </div>
        <Button variant="outline" size="icon"><Settings className="h-5 w-5" /></Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2">
           <Link href="/share">
              <Share2 className="h-5 w-5 text-primary" />
              <span className="text-xs">Partage BookTok</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2">
           <Link href="/connections">
              <Link2 className="h-5 w-5 text-blue-500" />
              <span className="text-xs">Connexions</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2">
           <Link href="/passport">
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-xs">Mon Passeport</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-4 glass-card flex-col gap-2">
           <Link href="/subscription">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-xs">Abonnement</span>
           </Link>
        </Button>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-headline flex items-center gap-2">
          <Palette className="h-6 w-6" /> Personnalisation
        </h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold mb-3">Thèmes</p>
            <div className="flex flex-wrap gap-4">
              {THEMES.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setCurrentTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 group",
                    currentTheme === t.id ? "scale-105" : "opacity-60"
                  )}
                >
                  <div className={cn("h-12 w-12 rounded-xl border-2 shadow-sm", t.color, currentTheme === t.id ? "border-primary" : "border-transparent")} />
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold mb-3">Icône de l'application</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <Badge key={icon} variant="outline" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors">
                  {icon}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline">Ma Progression 2024</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Objectif annuel : 24 livres</span>
            <span className="text-muted-foreground">50%</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/2 rounded-full" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline">Rapports IA</h2>
        <div className="bg-primary/5 p-4 rounded-xl border border-dashed border-primary/30 text-center">
           <p className="text-xs text-primary font-medium">✨ Fonction IA bientôt disponible</p>
           <p className="text-[10px] text-muted-foreground mt-1">Configurez votre clé Gemini pour débloquer les bilans narratifs.</p>
        </div>
      </section>
    </div>
  );
}