
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Settings, Share2, Crown, BadgeCheck, FileArchive, Sparkles, Award, Medal, TrendingUp, BookOpen, Clock, DoorOpen, Star } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { GENRES_LIST, TROPES_LIST, Book } from "@/app/library/page";

export default function ProfilePage() {
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [] } = useCollection(booksQuery);

  const stats = useMemo(() => {
    const allBooks = (books as unknown as Book[]);
    const readBooks = allBooks.filter(b => b.status === 'read');
    const palBooks = allBooks.filter(b => b.status === 'pal');
    const progressBooks = allBooks.filter(b => b.status === 'progress');
    const dnfBooks = allBooks.filter(b => b.status === 'dnf');
    const pagesRead = allBooks.reduce((acc, b) => acc + (b.pagesRead || 0), 0);
    
    // Genre Counts
    const genreCounts: Record<string, number> = {};
    readBooks.forEach(b => {
      b.genres?.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    });
    const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const unlockedBadges = Object.values(genreCounts).filter(c => c >= 5).length;

    // Trope Counts
    const tropeCounts: Record<string, number> = {};
    readBooks.forEach(b => {
      b.tropes?.forEach(t => tropeCounts[t] = (tropeCounts[t] || 0) + 1);
    });
    const favoriteTrope = Object.entries(tropeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const unlockedMedals = Object.values(tropeCounts).filter(c => c >= 5).length;

    return {
      readCount: readBooks.length,
      palCount: palBooks.length,
      progressCount: progressBooks.length,
      dnfCount: dnfBooks.length,
      pagesRead,
      unlockedBadges,
      unlockedMedals,
      favoriteGenre,
      favoriteTrope
    };
  }, [books]);

  const annualGoal = profile?.annualGoal || 24;
  const progressPercent = Math.min(100, Math.round((stats.readCount / annualGoal) * 100));

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-center pt-8">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-xl">
              <AvatarImage src={user?.photoURL || `https://picsum.photos/seed/${user?.uid}/200`} />
              <AvatarFallback className="bg-primary/5 text-primary text-xl font-headline italic">PL</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-2 border-2 border-white shadow-md">
              <Crown className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-headline italic tracking-tight">{user?.displayName || "Lectrice Plume"}</h1>
            <p className="text-muted-foreground italic text-sm">{profile?.bio || "“Perdue entre deux chapitres.”"}</p>
          </div>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/10 hover:bg-primary/5">
                <Settings className="h-5 w-5 text-primary" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/10 hover:bg-primary/5">
                <Share2 className="h-5 w-5 text-primary" />
            </Button>
        </div>
      </header>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary/40" />
          <h2 className="text-3xl font-headline italic">Mes Statistiques</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform">
            <BookOpen className="h-8 w-8 mx-auto text-primary" />
            <p className="text-3xl font-headline italic">{stats.readCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Livres lus</p>
          </Card>
          <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform">
            <Clock className="h-8 w-8 mx-auto text-blue-400" />
            <p className="text-3xl font-headline italic">{stats.progressCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">En cours</p>
          </Card>
          <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform">
            <Sparkles className="h-8 w-8 mx-auto text-emerald-400" />
            <p className="text-3xl font-headline italic">{stats.palCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Dans ma PAL</p>
          </Card>
          <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform">
            <DoorOpen className="h-8 w-8 mx-auto text-rose-400" />
            <p className="text-3xl font-headline italic">{stats.dnfCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">DNF</p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            <Card className="glass-card p-8 border-none space-y-6 bg-white/40">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Objectif annuel</p>
                    <p className="text-4xl font-headline italic">{stats.readCount} / {annualGoal}</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-none text-lg font-headline px-4 py-1">{progressPercent}%</Badge>
                </div>
                <Progress value={progressPercent} className="h-3 bg-primary/5" />
                <p className="text-center text-xs text-muted-foreground italic">
                   {stats.readCount >= annualGoal ? "Objectif accompli ! Bravo !" : `Encore ${annualGoal - stats.readCount} livres pour atteindre votre but.`}
                </p>
            </Card>

            <div className="grid grid-cols-2 gap-6">
                <Link href="/profile/badges">
                    <Card className="glass-card p-6 border-none text-center space-y-2 h-full hover:bg-white/60 transition-colors">
                        <BadgeCheck className="h-8 w-8 mx-auto text-emerald-400" />
                        <p className="text-3xl font-headline italic">{stats.unlockedBadges}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Badges de Genres</p>
                    </Card>
                </Link>
                <Link href="/profile/badges">
                    <Card className="glass-card p-6 border-none text-center space-y-2 h-full hover:bg-white/60 transition-colors">
                        <Medal className="h-8 w-8 mx-auto text-amber-500" />
                        <p className="text-3xl font-headline italic">{stats.unlockedMedals}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Médailles de Tropes</p>
                    </Card>
                </Link>
            </div>
        </div>

        <Card className="glass-card p-8 border-none space-y-8 bg-white/40">
            <div className="grid sm:grid-cols-2 gap-12 items-center">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Star className="h-5 w-5 text-primary/40" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Prédilection</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-headline italic text-primary">{stats.favoriteGenre}</p>
                        <p className="text-xs text-muted-foreground italic">Votre genre le plus lu</p>
                    </div>
                </div>
                <div className="space-y-4 sm:text-right">
                    <div className="flex items-center gap-3 sm:justify-end">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Trope favori</span>
                        <Award className="h-5 w-5 text-secondary/40" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-headline italic text-secondary">{stats.favoriteTrope}</p>
                        <p className="text-xs text-muted-foreground italic">Votre thématique de cœur</p>
                    </div>
                </div>
            </div>
            <div className="pt-8 border-t border-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5 text-primary/20" />
                    <span className="text-xs italic text-muted-foreground">Pages parcourues cette année</span>
                </div>
                <p className="text-2xl font-headline italic">{stats.pagesRead.toLocaleString()}</p>
            </div>
        </Card>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-8">
        <Button asChild variant="ghost" className="h-auto py-8 glass-card flex-col gap-3 rounded-[2.5rem] hover:bg-white/60 shadow-none border-none">
           <Link href="/share">
              <Share2 className="h-8 w-8 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Partager</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-8 glass-card flex-col gap-3 rounded-[2.5rem] hover:bg-white/60 shadow-none border-none">
           <Link href="/passport">
              <FileArchive className="h-8 w-8 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Passeport</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-8 glass-card flex-col gap-3 rounded-[2.5rem] hover:bg-white/60 shadow-none border-none col-span-2 md:col-span-1">
           <Link href="/subscription">
              <Crown className="h-8 w-8 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Plume Royale</span>
           </Link>
        </Button>
      </section>
    </div>
  );
}
