"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Trophy, PenTool, Heart, Bookmark, Coffee, Feather, LogOut, CheckCircle2, Star, Sparkles } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUser, useFirestore, useCollection, useAuth } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    toast({ title: "Déconnexion", description: "À bientôt sur Plume." });
    router.replace("/login");
  };

  // Fetch current reads
  const currentReadQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "books"),
      where("status", "==", "progress"),
      limit(1)
    );
  }, [db, user]);

  const { data: currentReads = [] } = useCollection(currentReadQuery);
  const currentRead = currentReads[0];

  // Fetch all books for stats
  const allBooksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: allBooks = [] } = useCollection(allBooksQuery);

  const stats = useMemo(() => {
    const readCount = allBooks.filter(b => b.status === 'read').length;
    const progressCount = allBooks.filter(b => b.status === 'progress').length;
    return [
      { label: "Livres Lus", value: readCount, icon: BookOpen, color: "text-primary" },
      { label: "En cours", value: progressCount, icon: Clock, color: "text-secondary" },
      { label: "Objectif 2024", value: `${readCount}/24`, icon: Trophy, color: "text-accent" },
    ];
  }, [allBooks]);

  return (
    <div className="space-y-12 animate-paper">
      <header className="space-y-6 pt-4 text-center relative">
        <div className="flex justify-center mb-2">
           <div className={cn(
             "flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border backdrop-blur-sm",
             user ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" : "bg-amber-50/50 text-amber-600 border-amber-100"
           )}>
              <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", user ? "bg-emerald-500" : "bg-amber-500")} />
              {user ? "Session Active" : "Mode Visiteur"}
           </div>
        </div>

        <div className="relative inline-block">
          <Feather className="h-12 w-12 text-primary/40 animate-float mx-auto" />
          <h1 className="text-7xl font-headline text-foreground tracking-tighter italic mt-2">Plume</h1>
        </div>
        
        <div className="max-w-xl mx-auto p-8 rounded-[3rem] bg-white/40 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md">
          <p className="text-lg font-headline italic text-primary/80 mb-2">
            Bonjour {user?.displayName || user?.email?.split('@')[0] || "cher lecteur"},
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            “Chaque page tournée est un souvenir gravé.” Ton sanctuaire littéraire t'attend pour de nouvelles pépites.
          </p>
        </div>
        
        {!user && (
          <div className="flex justify-center gap-4 mt-6">
            <Button asChild variant="outline" className="rounded-2xl border-primary/20 text-primary h-12 px-8">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild className="rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8">
              <Link href="/signup">S'inscrire</Link>
            </Button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center p-6 rounded-[2.5rem] bg-white/50 border border-white/60 shadow-sm hover:shadow-xl transition-all duration-700 hover:-translate-y-1">
            <div className={cn("p-3 mb-3 rounded-2xl bg-white shadow-sm border border-primary/5", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold text-center mb-1">{stat.label}</p>
            <p className="text-2xl font-headline">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-[1.6fr_1fr] gap-8">
        <section className="space-y-6">
          <h2 className="text-3xl font-headline flex items-center gap-3 italic">
            <Sparkles className="h-6 w-6 text-primary/40" /> En cours de lecture
          </h2>
          {currentRead ? (
            <Card className="glass-card overflow-hidden border-none group transition-all duration-700 hover:shadow-2xl">
              <div className="grid sm:grid-cols-[180px_1fr] gap-0">
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image 
                    src={currentRead.cover || "https://picsum.photos/seed/placeholder/600/900"} 
                    alt={currentRead.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                </div>
                <CardContent className="p-8 flex flex-col justify-between bg-gradient-to-br from-white/95 to-transparent">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-headline italic leading-tight group-hover:text-primary transition-colors">{currentRead.title}</h3>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">{currentRead.author}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                        <span>Progression</span>
                        <span>{currentRead.progress || 0}%</span>
                      </div>
                      <Progress value={currentRead.progress || 0} className="h-2 bg-primary/5" />
                    </div>
                  </div>
                  <Button asChild className="mt-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10 h-12">
                    <Link href="/journal">
                      <PenTool className="mr-2 h-4 w-4" />
                      Journal de bord
                    </Link>
                  </Button>
                </CardContent>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-12 text-center border-dashed border-primary/20 bg-white/20">
              <BookOpen className="h-12 w-12 mx-auto text-primary/20 mb-4" />
              <p className="text-muted-foreground italic">Aucune lecture en cours. <br/>Commencez un nouveau voyage aujourd'hui.</p>
              <Button asChild variant="outline" className="mt-6 rounded-2xl border-primary/20 text-primary h-12 px-8">
                <Link href="/library">Explorer ma PAL</Link>
              </Button>
            </Card>
          )}
        </section>

        <section className="space-y-8">
          <div className="space-y-6">
            <h2 className="text-3xl font-headline flex items-center gap-3 italic">
              <Bookmark className="h-6 w-6 text-primary/40" /> Raccourcis
            </h2>
            <div className="grid gap-4">
              <Link href="/library" className="flex items-center gap-5 p-6 rounded-[2.5rem] bg-secondary/10 border border-white/60 hover:bg-secondary/20 transition-all group shadow-sm">
                <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Library className="h-5 w-5 text-secondary" />
                </div>
                <span className="font-headline text-xl italic">Ma Bibliothèque</span>
              </Link>
              <Link href="/coeur-de-plume" className="flex items-center gap-5 p-6 rounded-[2.5rem] bg-accent/20 border border-white/60 hover:bg-accent/30 transition-all group shadow-sm">
                <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <span className="font-headline text-xl italic">Cœur de Plume</span>
              </Link>
              <Link href="/stats" className="flex items-center gap-5 p-6 rounded-[2.5rem] bg-primary/5 border border-white/60 hover:bg-primary/10 transition-all group shadow-sm">
                <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <span className="font-headline text-xl italic">Statistiques</span>
              </Link>
            </div>
          </div>

          <div className="p-8 rounded-[3rem] bg-primary/5 border border-dashed border-primary/20 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
               <Feather className="h-32 w-32" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 mb-4">L'essence de Plume</h3>
            <p className="text-lg italic text-foreground/80 leading-relaxed font-headline">
              "Lire, c'est boire et manger. L'esprit qui ne lit pas maigrit comme le corps qui ne mange pas."
            </p>
            <p className="text-[10px] mt-4 opacity-40 font-bold">— Victor Hugo</p>
          </div>
        </section>
      </div>
    </div>
  );
}
