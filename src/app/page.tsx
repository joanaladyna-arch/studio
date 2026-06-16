
'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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
  User as UserIcon,
  Plus,
  Loader2,
  ChevronRight,
  Target,
  Award,
  History,
  TrendingUp,
  FileText
} from "lucide-react";
import Image from 'next/image';
import { cn } from '@/utils';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, doc, orderBy } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  const userName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'cher lecteur';
  const userPhoto = profile?.avatarUrl || user?.photoURL || `https://picsum.photos/seed/${user?.uid || 'plume'}/200/200`;

  const currentReadQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'users', user.uid, 'books'),
      where('status', '==', 'progress'),
      orderBy('dateAdded', 'desc'),
      limit(1)
    );
  }, [db, user]);

  const { data: currentReads = [], loading: readingLoading } = useCollection(currentReadQuery);
  const currentRead = currentReads[0];

  const allBooksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'books');
  }, [db, user]);

  const { data: allBooks = [], loading: booksLoading } = useCollection(allBooksQuery);

  const stats = useMemo(() => {
    const readCount = allBooks.filter(b => b.status === 'read' || b.status === 'reread').length;
    const progressCount = allBooks.filter(b => b.status === 'progress').length;
    const pagesRead = allBooks.reduce((acc, b) => acc + (b.pagesRead || 0), 0);
    const annualGoal = profile?.annualGoal || 24;
    return {
      readCount,
      progressCount,
      pagesRead,
      annualGoal,
      progressPercent: Math.min(100, Math.round((readCount / annualGoal) * 100))
    };
  }, [allBooks, profile]);

  if (authLoading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
      <p className="font-headline italic text-primary/60 text-2xl">Ouverture de votre sanctuaire...</p>
    </div>
  );

  return (
    <div className="space-y-16 animate-paper">
      <header className="flex flex-col md:flex-row items-center justify-between gap-10 pt-10">
        <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <Link href="/profile" className="relative group">
            <Avatar className="h-32 w-32 border-4 border-white shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <AvatarImage src={userPhoto} className="object-cover" />
              <AvatarFallback className="bg-primary/5 text-primary text-3xl font-headline">PL</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-full border-2 border-white shadow-xl animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
          </Link>
          <div className="space-y-2">
            <h1 className="text-5xl font-headline italic text-foreground tracking-tight">Bonjour, {userName}</h1>
            <p className="text-muted-foreground italic text-lg opacity-80">“Chaque page tournée est un souvenir gravé.”</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <Button asChild variant="outline" className="rounded-2xl border-primary/10 hover:bg-white h-16 px-10 font-headline italic text-xl shadow-sm">
            <Link href="/journal">Mon Journal</Link>
          </Button>
          <Button asChild className="rounded-2xl bg-primary hover:bg-primary/90 h-16 px-12 font-headline italic text-xl shadow-2xl shadow-primary/20 transition-transform active:scale-95">
            <Link href="/add"><Plus className="mr-3 h-6 w-6" /> Ajouter</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2 p-10 rounded-[3rem] bg-white/60 border border-white shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-700">
           <div className="flex justify-between items-start">
             <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-bold italic">Objectif Annuel</p>
                <h3 className="text-5xl font-headline italic">{stats.readCount} / {stats.annualGoal}</h3>
             </div>
             <Trophy className="h-10 w-10 text-amber-500 animate-float" />
           </div>
           <div className="space-y-4 pt-8">
             <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60 italic">
               <span>Progression</span>
               <span>{stats.progressPercent}%</span>
             </div>
             <Progress value={stats.progressPercent} className="h-3 bg-primary/5" />
           </div>
        </div>

        <div className="p-10 rounded-[3rem] bg-white/60 border border-white shadow-sm text-center space-y-4 group hover:shadow-2xl transition-all duration-700">
           <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto text-primary group-hover:scale-110 transition-transform">
             <FileText className="h-7 w-7" />
           </div>
           <p className="text-4xl font-headline italic">{stats.pagesRead.toLocaleString()}</p>
           <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Pages lues</p>
        </div>

        <div className="p-10 rounded-[3rem] bg-white/60 border border-white shadow-sm text-center space-y-4 group hover:shadow-2xl transition-all duration-700">
           <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-400 group-hover:scale-110 transition-transform">
             <History className="h-7 w-7" />
           </div>
           <p className="text-4xl font-headline italic">{stats.progressCount}</p>
           <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">En cours</p>
        </div>
      </section>

      <div className="grid md:grid-cols-[1.8fr_1fr] gap-12">
        <section className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-4xl font-headline flex items-center gap-4 italic">
              <Sparkles className="h-8 w-8 text-primary/40" /> Lecture Actuelle
            </h2>
            {currentRead && (
               <Button asChild variant="link" className="text-primary italic text-lg group">
                 <Link href="/library" className="flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-2 transition-transform" /></Link>
               </Button>
            )}
          </div>
          {readingLoading ? (
            <div className="h-60 flex items-center justify-center"><Loader2 className="animate-spin text-primary/20 h-10 w-10" /></div>
          ) : currentRead ? (
            <Card className="glass-card overflow-hidden border-none group transition-all duration-1000 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
              <div className="grid sm:grid-cols-[280px_1fr] gap-0">
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image 
                    src={currentRead.cover || 'https://picsum.photos/seed/placeholder/600/900'} 
                    alt={currentRead.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent mix-blend-overlay" />
                </div>
                <CardContent className="p-12 flex flex-col justify-between bg-gradient-to-br from-white to-white/50">
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-4xl font-headline italic leading-tight group-hover:text-primary transition-colors">{currentRead.title}</h3>
                      <p className="text-md text-muted-foreground font-bold uppercase tracking-[0.2em] mt-3">{currentRead.author}</p>
                    </div>
                    <div className="space-y-5">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60 italic">
                        <span>Progression</span>
                        <span>{currentRead.progress || 0}%</span>
                      </div>
                      <Progress value={currentRead.progress || 0} className="h-3 bg-primary/5" />
                    </div>
                  </div>
                  <Button asChild className="mt-10 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 h-16 text-xl font-headline italic transition-transform active:scale-95">
                    <Link href={`/book/${currentRead.id}`}>
                      <PenTool className="mr-3 h-6 w-6" /> Reprendre le voyage
                    </Link>
                  </Button>
                </CardContent>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-24 text-center border-dashed border-primary/20 bg-white/20 group">
              <BookOpen className="h-20 w-20 mx-auto text-primary/20 mb-6 group-hover:scale-110 group-hover:text-primary/40 transition-all duration-700" />
              <p className="text-primary/60 italic font-headline text-3xl mb-2">Sanctuaire paisible.</p>
              <p className="text-muted-foreground italic text-xl">Aucune lecture en cours pour le moment.</p>
              <Button asChild variant="outline" className="mt-10 rounded-2xl border-primary/20 text-primary h-14 px-12 text-lg shadow-sm hover:bg-white">
                <Link href="/add">Explorer vos étagères</Link>
              </Button>
            </Card>
          )}
        </section>

        <section className="space-y-12">
          <div className="space-y-8">
            <h2 className="text-4xl font-headline flex items-center gap-4 italic">
              <Bookmark className="h-8 w-8 text-primary/40" /> Raccourcis
            </h2>
            <div className="grid gap-6">
              <Link href="/library" className="flex items-center gap-8 p-8 rounded-[3rem] bg-secondary/10 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-5 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Library className="h-8 w-8 text-secondary" />
                </div>
                <span className="font-headline text-3xl italic">Ma Bibliothèque</span>
              </Link>
              <Link href="/profile/badges" className="flex items-center gap-8 p-8 rounded-[3rem] bg-primary/5 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-5 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <span className="font-headline text-3xl italic">Mes Badges</span>
              </Link>
              <Link href="/coeur-de-plume" className="flex items-center gap-8 p-8 rounded-[3rem] bg-amber-50 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-5 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Heart className="h-8 w-8 text-amber-500 fill-amber-500/20" />
                </div>
                <span className="font-headline text-3xl italic">De Plume</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
