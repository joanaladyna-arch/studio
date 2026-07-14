
"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Medal, BookOpen, Star, Sparkles, Diamond, Crown, Shield, Lock } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { GENRES_LIST, TROPES_LIST, Book } from "@/app/library/page";
import { cn, toArray } from "@/lib/utils";

// Paliers par catégorie (genre ou trope) — ex: "Dark Romance" (5+),
// "Dark Romance Argent" (15+), "Dark Romance Or" (50+), "Dark Romance
// Diamant" (100+), à la demande explicite de l'utilisatrice.
const LEVELS = [
  { label: "Bronze", min: 5, color: "text-copper", bg: "bg-copper/10" },
  { label: "Argent", min: 15, color: "text-primary/70", bg: "bg-primary/5" },
  { label: "Or", min: 50, color: "text-rose", bg: "bg-rose/10" },
  { label: "Diamant", min: 100, color: "text-primary", bg: "bg-primary/10" },
];

export default function BadgesMedalsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: allBooks = [] } = useCollection(booksQuery);

  const readBooks = useMemo(() => {
    return (allBooks as unknown as Book[]).filter(b => b.status === 'read' || b.status === 'reread');
  }, [allBooks]);

  const genreStats = useMemo(() => {
    const stats: Record<string, number> = {};
    GENRES_LIST.forEach(g => stats[g] = 0);
    readBooks.forEach(b => {
      toArray<string>(b.genres).forEach(g => {
        if (stats[g] !== undefined) stats[g]++;
      });
    });
    return stats;
  }, [readBooks]);

  const tropeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    TROPES_LIST.forEach(t => stats[t] = 0);
    readBooks.forEach(b => {
      toArray<string>(b.tropes).forEach(t => {
        if (stats[t] !== undefined) stats[t]++;
      });
    });
    return stats;
  }, [readBooks]);

  const getLevel = (count: number) => {
    if (count >= 100) return LEVELS[3];
    if (count >= 50) return LEVELS[2];
    if (count >= 15) return LEVELS[1];
    if (count >= 5) return LEVELS[0];
    return null;
  };

  const getNextGoal = (count: number) => {
    if (count < 5) return 5;
    if (count < 15) return 15;
    if (count < 50) return 50;
    if (count < 100) return 100;
    return 100;
  };

  return (
    <div className="space-y-12 animate-paper pb-20">
      <header className="text-center space-y-4 pt-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline italic tracking-tight">Badges & Médailles</h1>
        <p className="text-primary/60 italic font-medium text-sm">Célébrez vos lectures terminées.</p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-headline italic">Badges de Genres</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {GENRES_LIST.map(genre => {
            const count = genreStats[genre];
            const level = getLevel(count);
            const nextGoal = getNextGoal(count);
            const progress = (count / nextGoal) * 100;
            const isUnlocked = count >= 5;

            return (
              <Card key={genre} className={cn(
                "glass-card border-none transition-all duration-500 overflow-hidden bg-white/40",
                isUnlocked ? "shadow-sm border-primary/10" : "opacity-30 grayscale"
              )}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-1.5 rounded-lg", level ? level.bg : "bg-muted")}>
                      {isUnlocked ? <Shield className={cn("h-3.5 w-3.5", level ? level.color : "text-muted-foreground")} /> : <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </div>
                    {level && <span className={cn("text-[8px] font-bold uppercase tracking-widest", level.color)}>{level.label}</span>}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-[10px] font-headline italic line-clamp-1">{genre}</h3>
                    <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">{count} lus</p>
                  </div>
                  <Progress value={progress} className="h-0.5 bg-primary/5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Medal className="h-6 w-6 text-rose" />
          <h2 className="text-2xl font-headline italic">Médailles de Tropes</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TROPES_LIST.map(trope => {
            const count = tropeStats[trope];
            const level = getLevel(count);
            const nextGoal = getNextGoal(count);
            const progress = (count / nextGoal) * 100;
            const isUnlocked = count >= 5;

            return (
              <Card key={trope} className={cn(
                "glass-card border-none transition-all duration-500 overflow-hidden bg-white/40",
                isUnlocked ? "shadow-sm border-secondary/10" : "opacity-30 grayscale"
              )}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-1.5 rounded-lg", level ? level.bg : "bg-muted")}>
                      {isUnlocked ? <Medal className={cn("h-3.5 w-3.5", level ? level.color : "text-muted-foreground")} /> : <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </div>
                    {level && <span className={cn("text-[8px] font-bold uppercase tracking-widest", level.color)}>{level.label}</span>}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-[10px] font-headline italic line-clamp-1">{trope}</h3>
                    <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">{count} lus</p>
                  </div>
                  <Progress value={progress} className="h-0.5 bg-secondary/5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
