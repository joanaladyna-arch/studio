
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Share2, Link2, Palette, Crown, BadgeCheck, FileArchive, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";

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

  const readCount = books.filter(b => b.status === 'read').length;
  const annualGoal = profile?.annualGoal || 24;
  const progressPercent = Math.min(100, Math.round((readCount / annualGoal) * 100));

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
           <Link href="/connections">
              <Link2 className="h-6 w-6 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Connexions</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/passport">
              <BadgeCheck className="h-6 w-6 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Passeport</span>
           </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto py-6 glass-card flex-col gap-2 rounded-[2rem] hover:bg-white/60">
           <Link href="/subscription">
              <Crown className="h-6 w-6 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Premium</span>
           </Link>
        </Button>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <h2 className="text-2xl font-headline flex items-center gap-2 italic">
            <Palette className="h-6 w-6 text-primary/40" /> Mon Apparence
          </h2>
          
          <Card className="glass-card p-6 border-none shadow-sm">
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4">Thèmes d'ambiance</p>
                <div className="flex flex-wrap gap-4">
                  {THEMES.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setCurrentTheme(t.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 group transition-all",
                        currentTheme === t.id ? "scale-105" : "opacity-40 hover:opacity-100"
                      )}
                    >
                      <div className={cn("h-12 w-12 rounded-2xl border-2 shadow-inner", t.color, currentTheme === t.id ? "border-primary" : "border-transparent")} />
                      <span className="text-[10px] font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                  <span className="text-sm font-headline italic text-primary">Objectif annuel : {readCount}/{annualGoal} livres</span>
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
