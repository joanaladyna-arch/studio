"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Trophy, PenTool, Heart, Bookmark, Coffee, Feather } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";

export default function Home() {
  const { user } = useUser();
  const db = useFirestore();

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
      <Navigation />
      
      <header className="space-y-6 pt-8 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 opacity-20 pointer-events-none">
          <Feather className="h-12 w-12 text-primary animate-float" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-6xl font-headline text-foreground tracking-tight italic">PLUME</h1>
          <div className="flex items-center justify-center gap-2 text-primary/60 font-medium">
            <Coffee className="h-4 w-4" />
            <span className="italic">Ton journal de lecture personnel.</span>
          </div>
        </div>
        
        <div className="max-w-xl mx-auto p-8 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-inner backdrop-blur-sm">
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            Plume est un journal de lecture authentique, sans IA obligatoire, pensé pour garder une trace sincère de tes lectures, de tes émotions et de ton parcours de lectrice.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center p-6 rounded-[2rem] bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all duration-500">
            <div className={cn("p-3 mb-3 rounded-full bg-white shadow-sm border border-primary/5", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">{stat.label}</p>
            <p className="text-2xl font-headline mt-1">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-[1.6fr_1fr] gap-10">
        <section className="space-y-6">
          <h2 className="text-3xl font-headline flex items-center gap-3 italic">
            <Clock className="h-6 w-6 text-secondary" /> En ce moment
          </h2>
          {currentRead ? (
            <Card className="glass-card overflow-hidden border-none group transition-all duration-700 hover:shadow-2xl">
              <div className="grid sm:grid-cols-[200px_1fr] gap-0">
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image 
                    src={currentRead.cover || "https://picsum.photos/seed/placeholder/600/900"} 
                    alt={currentRead.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-black/5" />
                </div>
                <CardContent className="p-10 flex flex-col justify-between bg-gradient-to-br from-white/80 to-transparent">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-3xl font-headline italic leading-tight">{currentRead.title}</h3>
                      <p className="text-primary/70 font-medium mt-1">{currentRead.author}</p>
                    </div>
                    <div className="pt-4 space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                        <span>Progression</span>
                        <span>{currentRead.progress || 0}%</span>
                      </div>
                      <Progress value={currentRead.progress || 0} className="h-2 bg-primary/5" />
                      <p className="text-xs text-muted-foreground italic">{currentRead.pagesRead || 0} pages lues sur {currentRead.totalPages || 0}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-10">
                    <Button asChild className="flex-1 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 py-6">
                      <Link href="/journal">
                        <PenTool className="mr-2 h-4 w-4" />
                        Journal de bord
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-12 text-center border-dashed border-primary/20 bg-white/20">
              <p className="text-muted-foreground italic">Aucune lecture en cours. <br/>Il est temps de commencer un nouveau voyage !</p>
              <Button asChild variant="outline" className="mt-6 rounded-2xl border-primary/20 text-primary">
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
              <Link href="/coeur-de-plume" className="flex items-center gap-5 p-6 rounded-[2rem] bg-accent/20 border border-white/60 hover:bg-accent/30 transition-all group shadow-sm">
                <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <span className="font-headline text-xl italic">Cœur de Plume</span>
              </Link>
              <Link href="/library" className="flex items-center gap-5 p-6 rounded-[2rem] bg-secondary/10 border border-white/60 hover:bg-secondary/20 transition-all group shadow-sm">
                <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <BookOpen className="h-5 w-5 text-secondary" />
                </div>
                <span className="font-headline text-xl italic">Ma Bibliothèque</span>
              </Link>
            </div>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-primary/5 border border-dashed border-primary/20 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
               <Feather className="h-24 w-24" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 mb-4">Tes lectures, tes mots, tes émotions.</h3>
            <p className="text-lg italic text-foreground/80 leading-relaxed font-headline">
              "Le mouvement de la vie n'a d'intérêt que si on le regarde de l'intérieur."
            </p>
            <div className="flex items-center gap-2 mt-4">
              <span className="h-px w-6 bg-primary/30" />
              <p className="text-[10px] font-bold text-primary/50 uppercase tracking-tighter">L'élégance du hérisson</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}