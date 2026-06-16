
"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Medal, BookOpen, Star, Sparkles, Diamond, Crown, Shield, Lock } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { GENRES_LIST, TROPES_LIST, Book } from "@/app/library/page";
import { cn } from "@/lib/utils";

const LEVELS = [
  { label: "Bronze", min: 5, color: "text-amber-600", bg: "bg-amber-100" },
  { label: "Silver", min: 15, color: "text-slate-400", bg: "bg-slate-100" },
  { label: "Gold", min: 30, color: "text-yellow-500", bg: "bg-yellow-100" },
  { label: "Diamond", min: 50, color: "text-cyan-400", bg: "bg-cyan-100" },
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
    // Only count books with status 'read' or 'reread'
    return (allBooks as unknown as Book[]).filter(b => b.status === 'read' || b.status === 'reread');
  }, [allBooks]);

  const genreStats = useMemo(() => {
    const stats: Record<string, number> = {};
    GENRES_LIST.forEach(g => stats[g] = 0);
    readBooks.forEach(b => {
      b.genres?.forEach(g => {
        if (stats[g] !== undefined) stats[g]++;
      });
    });
    return stats;
  }, [readBooks]);

  const tropeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    TROPES_LIST.forEach(t => stats[t] = 0);
    readBooks.forEach(b => {
      b.tropes?.forEach(t => {
        if (stats[t] !== undefined) stats[t]++;
      });
    });
    return stats;
  }, [readBooks]);

  const getLevel = (count: number) => {
    if (count >= 50) return LEVELS[3];
    if (count >= 15) return LEVELS[1];
    if (count >= 30) return LEVELS[2];
    if (count >= 5) return LEVELS[0];
    return null;
  };

  const getNextGoal = (count: number) => {
    if (count < 5) return 5;
    if (count < 15) return 15;
    if (count < 30) return 30;
    if (count < 50) return 50;
    return 50;
  };

  return (
    <div className="space-y-12 animate-paper pb-20">
      <Navigation />
      
      <header className="text-center space-y-4 pt-8">
        <h1 className="text-5xl font-headline italic tracking-tight">Badges & Médailles</h1>
        <p className="text-primary/60 italic font-medium">Célébrez vos lectures terminées. La PAL ne compte pas ici !</p>
      </header>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-headline italic">Badges de Genres</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GENRES_LIST.map(genre => {
            const count = genreStats[genre];
            const level = getLevel(count);
            const nextGoal = getNextGoal(count);
            const progress = (count / nextGoal) * 100;
            const isUnlocked = count >= 5;

            return (
              <Card key={genre} className={cn(
                "glass-card border-none transition-all duration-500 overflow-hidden",
                isUnlocked ? "shadow-md scale-[1.02]" : "opacity-40 grayscale"
              )}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      level ? level.bg : "bg-muted"
                    )}>
                      {isUnlocked ? <Shield className={cn("h-6 w-6", level ? level.color : "text-muted-foreground")} /> : <Lock className="h-6 w-6 text-muted-foreground/40" />}
                    </div>
                    {level && (
                      <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", level.color)}>
                        {level.label}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-headline italic">{genre}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {count} livres lus
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter opacity-60">
                      <span>{isUnlocked ? `Vers ${LEVELS.find(l => l.min === nextGoal)?.label || 'Diamond'}` : 'Vers Bronze'} ({nextGoal})</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-primary/5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Medal className="h-8 w-8 text-secondary" />
          <h2 className="text-3xl font-headline italic">Médailles de Tropes</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TROPES_LIST.map(trope => {
            const count = tropeStats[trope];
            const level = getLevel(count);
            const nextGoal = getNextGoal(count);
            const progress = (count / nextGoal) * 100;
            const isUnlocked = count >= 5;

            return (
              <Card key={trope} className={cn(
                "glass-card border-none transition-all duration-500 overflow-hidden",
                isUnlocked ? "shadow-md scale-[1.02] border-secondary/20" : "opacity-40 grayscale"
              )}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      level ? level.bg : "bg-muted"
                    )}>
                      {isUnlocked ? <Medal className={cn("h-6 w-6", level ? level.color : "text-muted-foreground")} /> : <Lock className="h-6 w-6 text-muted-foreground/40" />}
                    </div>
                    {level && (
                      <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", level.color)}>
                        {level.label}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-headline italic">{trope}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {count} livres lus
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter opacity-60">
                      <span>{isUnlocked ? `Vers ${LEVELS.find(l => l.min === nextGoal)?.label || 'Diamond'}` : 'Vers Bronze'} ({nextGoal})</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-secondary/5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
