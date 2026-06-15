
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Share2, Link2, Palette, Crown, BadgeCheck, FileArchive, Sparkles, Award, Medal, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { GENRES_LIST, TROPES_LIST, Book } from "@/app/library/page";

const THEMES = [
  { id: "soft", label: "Doux pastel", color: "bg-[#fdf2f5]" },
  { id: "cosy", label: "Bibliothèque cosy", color: "bg-[#f5e6d3]" },
  { id: "night", label: "Mode nuit", color: "bg-slate-900" },
  { id: "romantasy", label: "Romantasy", color: "bg-[#2a1a3a]" },
  { id: "minimal", label: "Minimaliste", color: "bg-white" },
];

export default function ProfilePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [currentTheme, setCurrentTheme] = useState("cosy");

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
    const readBooks = (books as unknown as Book[]).filter(b => b.status === 'read');
    
    // Genre Badges
    const genreCounts: Record<string, number> = {};
    readBooks.forEach(b => {
      b.genres?.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    });
    const unlockedBadges = Object.values(genreCounts).filter(c => c >= 5).length;
    const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Trope Medals
    const tropeCounts: Record<string, number> = {};
    readBooks.forEach(b => {
      b.tropes?.forEach(t => tropeCounts[t] = (tropeCounts[t] || 0) + 1);
    });
    const unlockedMedals = Object.values(tropeCounts).filter(c => c >= 5).length;
    const favoriteTrope = Object.entries(tropeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      readCount: readBooks.length,
      unlockedBadges,
      unlockedMedals,
      favoriteGenre,
      favoriteTrope,
      totalProgression: unlockedBadges + unlockedMedals
    };
  }, [books]);

  const annualGoal = profile?.annualGoal || 24;
  const progressPercent = Math.min(100, Math.round((stats.readCount / annualGoal) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg">
              <AvatarImage src={user?.photoURL || `https://picsum.photos/seed/${user?.uid}/200`} />
              <AvatarFallback>{user?.displayName?.substring(0, 2).toUpperCase() || "PL"}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1.5 border-2 border-white shadow-sm">
              <Crown className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-headline italic">{user?.displayName || "Lectrice Plume"}</h1>
            <p className="text-muted-foreground italic text-sm">{profile?.bio || "“Perdue entre deux chapitres.”"}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/10"><Settings className="h-5 w-5 text-primary" /></Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/share">
              <Share2 className="h-6 w-6 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Partager</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/profile/badges">
              <BadgeCheck className="h-6 w-6 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Badges</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/passport">
              <Settings className="h-6 w-6 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Identité</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/subscription">
              <Crown className="h-6 w-6 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Premium</span>
           </Link>
        </Button>
      </section>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-8">
        <section className="space-y-6">
          <h2 className="text-2xl font-headline flex items-center gap-2 italic">
            <TrendingUp className="h-6 w-6 text-primary/40" /> Ma Progression Royale
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
             <Card className="glass-card p-6 border-none text-center space-y-2">
                <Award className="h-8 w-8 mx-auto text-primary" />
                <p className="text-3xl font-headline italic">{stats.unlockedBadges}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Badges de Genres</p>
             </Card>
             <Card className="glass-card p-6 border-none text-center space-y-2">
                <Medal className="h-8 w-8 mx-auto text-secondary" />
                <p className="text-3xl font-headline italic">{stats.unlockedMedals}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Médailles de Tropes</p>
             </Card>
          </div>

          <Card className="glass-card p-8 border-none space-y-6">
             <div className="flex justify-between items-center">
                <div className="space-y-1">
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Genre de prédilection</p>
                   <p className="text-xl font-headline italic text-primary">{stats.favoriteGenre}</p>
                </div>
                <div className="text-right space-y-1">
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Trope favori</p>
                   <p className="text-xl font-headline italic text-secondary">{stats.favoriteTrope}</p>
                </div>
             </div>
             <div className="pt-4 border-t border-primary/5">
                <p className="text-center italic text-xs text-muted-foreground">Continuez à lire pour débloquer de nouveaux paliers de prestige !</p>
             </div>
          </Card>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-headline flex items-center gap-2 italic">
             <FileArchive className="h-6 w-6 text-primary/40" /> Bilan {new Date().getFullYear()}
          </h2>
          <Card className="glass-card p-8 border-none shadow-sm space-y-6">
             <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-headline italic text-primary">Objectif annuel : {stats.readCount}/{annualGoal} livres</span>
                  <span className="text-xs font-bold text-primary">{progressPercent}%</span>
                </div>
                <div className="h-2.5 w-full bg-primary/5 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-1000" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
             </div>
             
             <div className="pt-4 border-t border-primary/5 text-center">
                <Sparkles className="h-6 w-6 mx-auto text-primary/20 mb-2" />
                <p className="text-[10px] text-muted-foreground italic">“Garde une trace historique de tes années de lecture sous forme d'album numérique.”</p>
             </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
