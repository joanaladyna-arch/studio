"use client";

import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, Clock, Trophy, PenTool, Heart, Bookmark } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  const currentRead = {
    title: "L'élégance du hérisson",
    author: "Muriel Barbery",
    progress: 65,
    pagesRead: 210,
    totalPages: 320,
    cover: "https://picsum.photos/seed/book1/200/300"
  };

  const stats = [
    { label: "Livres Lus", value: 12, icon: BookOpen, color: "text-primary" },
    { label: "En cours", value: 2, icon: Clock, color: "text-secondary" },
    { label: "Objectif 2024", value: "12/24", icon: Trophy, color: "text-accent" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <Navigation />
      
      <header className="space-y-4 pt-4">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-5xl font-headline text-foreground tracking-tight">Bonjour, Léa</h1>
          <p className="text-primary/60 italic mt-2 font-medium text-xl">Tes lectures, tes mots, tes émotions.</p>
        </div>
        <div className="max-w-xl mx-auto p-6 rounded-3xl bg-white/40 border border-white/60 shadow-sm text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Plume est un journal de lecture authentique, pensé pour garder une trace sincère de tes lectures, de ta PAL et de ton parcours de lectrice.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center p-4 rounded-3xl bg-white/30 border border-white/40 shadow-sm hover:bg-white/50 transition-colors">
            <div className={cn("p-2 mb-2 rounded-full bg-white/80 shadow-sm", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{stat.label}</p>
            <p className="text-xl font-headline mt-1">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-headline flex items-center gap-2">
            <Clock className="h-5 w-5 text-secondary" /> Lecture du moment
          </h2>
          <Card className="glass-card overflow-hidden border-none group transition-all duration-500">
            <div className="grid sm:grid-cols-[180px_1fr] gap-0">
              <div className="relative aspect-[2/3] overflow-hidden">
                <Image 
                  src={currentRead.cover} 
                  alt={currentRead.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <CardContent className="p-8 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-headline">{currentRead.title}</h3>
                      <p className="text-primary italic opacity-70">{currentRead.author}</p>
                    </div>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60">
                      <span>Progression</span>
                      <span>{currentRead.progress}%</span>
                    </div>
                    <Progress value={currentRead.progress} className="h-1.5 bg-primary/10" />
                    <p className="text-xs text-muted-foreground font-medium">{currentRead.pagesRead} sur {currentRead.totalPages} pages</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-8">
                  <Button asChild className="flex-1 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Link href="/journal">
                      <PenTool className="mr-2 h-4 w-4" />
                      Écrire une réflexion
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-headline flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary/40" /> Raccourcis
          </h2>
          <div className="grid gap-3">
            <Link href="/coeur-de-plume" className="flex items-center gap-4 p-4 rounded-3xl bg-accent/20 border border-white/60 hover:bg-accent/30 transition-all group">
              <div className="p-2 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform">
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <span className="font-headline text-lg">Cœur de Plume</span>
            </Link>
            <Link href="/library" className="flex items-center gap-4 p-4 rounded-3xl bg-secondary/10 border border-white/60 hover:bg-secondary/20 transition-all group">
              <div className="p-2 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform">
                <BookOpen className="h-4 w-4 text-secondary" />
              </div>
              <span className="font-headline text-lg">Ma Bibliothèque</span>
            </Link>
          </div>

          <div className="mt-8 p-6 rounded-3xl bg-primary/5 border border-dashed border-primary/20">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Citations favorites</h3>
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "Le mouvement de la vie n'a d'intérêt que si on le regarde de l'intérieur."
            </p>
            <p className="text-[10px] font-bold text-primary/40 mt-2 uppercase tracking-tighter">— L'élégance du hérisson</p>
          </div>
        </section>
      </div>
    </div>
  );
}