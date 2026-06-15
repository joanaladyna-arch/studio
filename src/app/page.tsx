
"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  PenTool, 
  Heart, 
  Bookmark, 
  Feather, 
  Sparkles,
  Library,
  User as UserIcon
} from "lucide-react";
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

  const userName = user?.displayName || user?.email?.split('@')[0] || "cher lecteur";

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
      { label: "En cours", value: progressCount, icon: Clock, color: "text-blue-400" },
      { label: "Objectif", value: `${readCount}/24`, icon: Trophy, color: "text-amber-500" },
    ];
  }, [allBooks]);

  return (
    <div className="space-y-12 animate-paper">
      <header className="space-y-8 pt-8 text-center relative">
        <div className="relative inline-block">
          <Feather className="h-16 w-16 text-primary/40 animate-float mx-auto" />
          <h1 className="text-7xl font-headline text-foreground tracking-tighter italic mt-2">Plume</h1>
        </div>
        
        <div className="max-w-xl mx-auto p-10 rounded-[3rem] bg-white/40 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md">
          <p className="text-2xl font-headline italic text-primary/80 mb-2">
            Bonjour {userName},
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            “Chaque page tournée est un souvenir gravé.” Ton sanctuaire littéraire t'attend pour de nouvelles pépites.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center p-8 rounded-[3rem] bg-white/50 border border-white/60 shadow-sm hover:shadow-xl transition-all duration-700 hover:-translate-y-1">
            <div className={cn("p-4 mb-3 rounded-2xl bg-white shadow-sm border border-primary/5", stat.color)}>
              <stat.icon className="h-6 w-6" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold text-center mb-1">{stat.label}</p>
            <p className="text-3xl font-headline">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-[1.6fr_1fr] gap-10">
        <section className="space-y-6">
          <h2 className="text-3xl font-headline flex items-center gap-3 italic">
            <Sparkles className="h-6 w-6 text-primary/40" /> En cours de lecture
          </h2>
          {currentRead ? (
            <Card className="glass-card overflow-hidden border-none group transition-all duration-700 hover:shadow-2xl">
              <div className="grid sm:grid-cols-[200px_1fr] gap-0">
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image 
                    src={currentRead.cover || "https://picsum.photos/seed/placeholder/600/900"} 
                    alt={currentRead.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-1000"
                    sizes="200px"
                  />
                  <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                </div>
                <CardContent className="p-10 flex flex-col justify-between bg-gradient-to-br from-white/95 to-transparent">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-3xl font-headline italic leading-tight group-hover:text-primary transition-colors">{currentRead.title}</h3>
                      <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">{currentRead.author}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest opacity-60">
                        <span>Progression</span>
                        <span>{currentRead.progress || 0}%</span>
                      </div>
                      <Progress value={currentRead.progress || 0} className="h-2.5 bg-primary/5" />
                    </div>
                  </div>
                  <Button asChild className="mt-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10 h-14 text-lg font-headline italic">
                    <Link href="/journal">
                      <PenTool className="mr-3 h-5 w-5" /> Journal de bord
                    </Link>
                  </Button>
                </CardContent>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-16 text-center border-dashed border-primary/20 bg-white/20">
              <BookOpen className="h-16 w-16 mx-auto text-primary/20 mb-4" />
              <p className="text-muted-foreground italic text-lg">Aucune lecture en cours. <br/>Commencez un nouveau voyage aujourd'hui.</p>
              <Button asChild variant="outline" className="mt-8 rounded-2xl border-primary/20 text-primary h-12 px-10">
                <Link href="/library">Explorer ma PAL</Link>
              </Button>
            </Card>
          )}
        </section>

        <section className="space-y-10">
          <div className="space-y-6">
            <h2 className="text-3xl font-headline flex items-center gap-3 italic">
              <Bookmark className="h-6 w-6 text-primary/40" /> Raccourcis
            </h2>
            <div className="grid gap-5">
              <Link href="/library" className="flex items-center gap-6 p-6 rounded-[3rem] bg-secondary/10 border border-white/60 hover:bg-secondary/20 transition-all group shadow-sm">
                <div className="p-4 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Library className="h-6 w-6 text-secondary" />
                </div>
                <span className="font-headline text-2xl italic">Ma Bibliothèque</span>
              </Link>
              <Link href="/coeur-de-plume" className="flex items-center gap-6 p-6 rounded-[3rem] bg-primary/5 border border-white/60 hover:bg-primary/10 transition-all group shadow-sm">
                <div className="p-4 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Heart className="h-6 w-6 text-primary fill-primary/20" />
                </div>
                <span className="font-headline text-2xl italic">De Plume</span>
              </Link>
              <Link href="/profile" className="flex items-center gap-6 p-6 rounded-[3rem] bg-amber-50 border border-white/60 hover:bg-amber-100/50 transition-all group shadow-sm">
                <div className="p-4 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <UserIcon className="h-6 w-6 text-amber-500" />
                </div>
                <span className="font-headline text-2xl italic">Mon Profil</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
