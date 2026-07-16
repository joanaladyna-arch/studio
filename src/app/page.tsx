
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Trophy, 
  PenTool, 
  Sparkles,
  Plus,
  Loader2,
  ChevronRight,
  Target,
  FileText,
  Calendar,
  Headphones,
  TrendingUp,
  Bell,
  Quote,
  Star,
  Heart
} from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { BookCover } from '@/components/book-cover';
import { StarRating } from '@/components/star-rating';
import { BookShelf } from '@/components/book-shelf';
import { cleanBookTitle, cleanAuthorName, cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { useAmbientDark } from '@/hooks/use-ambient-dark';
import { collection, doc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DailyQuoteModal } from '@/components/daily-quote-modal';
import { TrackAppOpen } from '@/components/track-app-open';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);
  const isAmbientDark = useAmbientDark();

  // Indice affiché une seule fois pour signaler ce à quoi sert la cloche
  // — la moitié des testeuses bêta ne l'avait pas remarquée. Se ferme
  // dès qu'on clique dessus (le lien vers /actualites) ou ailleurs sur
  // la page, et ne réapparaît jamais une fois vue.
  const [showBellHint, setShowBellHint] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("lectoria_bell_hint_seen")) {
      const t = setTimeout(() => setShowBellHint(true), 800);
      return () => clearTimeout(t);
    }
  }, []);
  const dismissBellHint = () => {
    setShowBellHint(false);
    if (typeof window !== "undefined") localStorage.setItem("lectoria_bell_hint_seen", "1");
  };

  const userName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'cher lecteur';
  const userPhoto = profile?.avatarUrl || user?.photoURL || `https://picsum.photos/seed/${user?.uid || 'lectoria'}/200/200`;

  const allBooksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'books');
  }, [db, user]);

  const { data: allBooks = [], loading: readingLoading } = useCollection(allBooksQuery);
  // "Lecture Actuelle" est déjà incluse dans allBooks — pas besoin d'un
  // second écouteur Firestore juste pour ce sous-ensemble.
  const currentRead = useMemo(() => allBooks.find((b: any) => b.status === 'progress'), [allBooks]);

  // Cloche "actualité" : compte les actualités publiées après la dernière
  // visite de la page /actualites (lastSeenActualityAt), toutes confondues
  // (pas seulement les auteurs suivis) — c'est une notification générale,
  // pas le badge ciblé déjà existant dans la barre de navigation.
  const actualitesQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'actualites');
  }, [db]);
  const { data: allActualites = [] } = useCollection(actualitesQuery);
  const unseenActualitesCount = useMemo(() => {
    const lastSeenMillis = profile?.lastSeenActualityAt?.toMillis?.() || 0;
    return allActualites.filter((a: any) => (a.publishedAt?.toMillis?.() || 0) > lastSeenMillis).length;
  }, [allActualites, profile]);

  // Dernier avis rédigé, pour le mettre en avant en bas de l'accueil —
  // basé sur la date d'ajout du livre concerné, faute de date dédiée à
  // la rédaction de l'avis lui-même dans le modèle de données actuel.
  const lastReviewedBook = useMemo(() => {
    return allBooks
      .filter((b: any) => (b.review || '').toString().trim())
      .sort((a: any, b: any) => {
        const da = a.dateAdded?.toMillis?.() || 0;
        const db2 = b.dateAdded?.toMillis?.() || 0;
        return db2 - da;
      })[0] || null;
  }, [allBooks]);

  const readBooks = useMemo(() => {
    return allBooks
      .filter(b => b.status === 'read' || b.status === 'reread')
      .sort((a, b) => {
        const rawA = (a as any).dateRead || a.dateAdded;
        const rawB = (b as any).dateRead || b.dateAdded;
        const da = rawA?.toDate ? rawA.toDate() : new Date(rawA || 0);
        const db = rawB?.toDate ? rawB.toDate() : new Date(rawB || 0);
        return db.getTime() - da.getTime();
      });
  }, [allBooks]);

  const lastRead = readBooks[0] || null;
  const nextRead = useMemo(() => {
    return allBooks.find((b: any) => b.status === 'pal' && b.isNextRead) || null;
  }, [allBooks]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Seuls les livres pour lesquels l'utilisatrice a confirmé qu'ils
    // comptent (case cochée à l'ajout) alimentent les objectifs — un
    // livre déjà lu par le passé, ajouté seulement pour archive, ne doit
    // jamais gonfler artificiellement les objectifs en cours. Et ne
    // comptent que ceux réellement lus PENDANT L'ANNÉE/LE MOIS en cours
    // (pas tout l'historique) — c'était le bug précis remonté : le
    // compteur annuel incluait à tort des livres lus les années
    // précédentes. Priorité de date : fin > début > dateRead > dateAdded
    // (ce dernier uniquement pour les livres non exclus).
    const getGenuineDate = (b: any): Date | null => {
      if (b.countTowardGoals === false) return null;
      const raw = b.readEndDate || b.readStartDate || b.dateRead || b.dateAdded;
      if (!raw) return null;
      const d = raw?.toDate ? raw.toDate() : new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    const goalEligibleBooks = readBooks.filter((b: any) => {
      const d = getGenuineDate(b);
      return d !== null && d.getFullYear() === currentYear;
    });

    const monthlyRead = readBooks.filter((b: any) => {
      const d = getGenuineDate(b);
      return d !== null && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Pages : uniquement les formats papier/ebook/liseuse (le champ
    // pagesRead n'a de sens que pour ceux-ci). Heures d'écoute : champ
    // dédié audioHoursListened, saisi directement en heures — avant ce
    // correctif, le calcul divisait à tort pagesRead par 50 pour les
    // livres audio, un champ qui n'était jamais rempli pour eux (d'où
    // les 0h systématiques remontés en retour bêta).
    const pagesRead = goalEligibleBooks.reduce((acc, b) => {
      const isAudio = ['audio', 'audible', 'audiolib'].includes(b.format || '');
      return acc + (isAudio ? 0 : (Number((b as any).pagesRead) || 0));
    }, 0);
    const audioHours = goalEligibleBooks.reduce((acc, b) => {
      const isAudio = ['audio', 'audible', 'audiolib'].includes(b.format || '');
      return acc + (isAudio ? (Number((b as any).audioHoursListened) || 0) : 0);
    }, 0);

    const goals = {
      annual: profile?.annualGoal || 24,
      monthly: profile?.monthlyGoal || 2,
      pages: profile?.annualGoalPages || 10000,
      audio: profile?.annualAudioGoal || 100
    };

    return {
      annualCount: goalEligibleBooks.length,
      monthlyCount: monthlyRead.length,
      pagesCount: pagesRead,
      audioCount: Math.round(audioHours),
      goals,
      annualProgress: Math.min(100, Math.round((goalEligibleBooks.length / goals.annual) * 100)),
      monthlyProgress: Math.min(100, Math.round((monthlyRead.length / goals.monthly) * 100)),
      pagesProgress: Math.min(100, Math.round((pagesRead / (goals.pages || 1)) * 100)),
      audioProgress: Math.min(100, Math.round((audioHours / (goals.audio || 1)) * 100))
    };
  }, [allBooks, profile]);

  if (authLoading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
      <p className="font-headline italic text-primary/60 text-2xl">Ouverture de votre réserve...</p>
    </div>
  );

  return (
    <div className="space-y-8 md:space-y-16 animate-paper">
      <DailyQuoteModal />
      <TrackAppOpen />
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 pt-4 md:pt-10">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
          <Link href="/profile" className="relative group">
            <Avatar className="h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 border-4 border-white shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <AvatarImage src={userPhoto} className="object-cover" />
              <AvatarFallback className="bg-primary/5 text-primary text-xl md:text-3xl font-headline">PL</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1.5 -right-1.5 lg:-bottom-2 lg:-right-2 bg-primary text-white p-1.5 lg:p-2.5 rounded-full border-2 border-white shadow-xl animate-pulse">
              <Sparkles className="h-3.5 w-3.5 lg:h-5 lg:w-5" />
            </div>
          </Link>
          <div className="space-y-1 lg:space-y-2">
            <h1 className={cn("text-2xl sm:text-3xl lg:text-5xl font-headline italic tracking-tight leading-tight break-words", isAmbientDark ? "text-[#F5F1E8]" : "text-foreground")}>Bonjour, {userName}</h1>
            <p className={cn("italic text-sm lg:text-lg", isAmbientDark ? "text-[#F5F1E8]/70" : "text-muted-foreground opacity-80")}>“Chaque page tournée est un souvenir gravé.”</p>
          </div>
        </div>
        
        <div className="flex gap-2 lg:gap-4 items-center">
          <Link
            href="/actualites"
            onClick={dismissBellHint}
            className="relative h-11 w-11 lg:h-16 lg:w-16 rounded-xl lg:rounded-2xl border border-primary/10 bg-white/60 hover:bg-white shadow-sm flex items-center justify-center transition-colors shrink-0"
            title="Actualités"
          >
            <Bell className="h-4 w-4 lg:h-6 lg:w-6 text-primary/70" />
            {unseenActualitesCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-rose text-primary text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {unseenActualitesCount > 9 ? "9+" : unseenActualitesCount}
              </span>
            )}
            {showBellHint && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-primary text-primary-foreground text-xs rounded-2xl p-3 shadow-2xl z-50 font-sans not-italic normal-case tracking-normal text-left animate-in fade-in slide-in-from-top-2 duration-300">
                <button onClick={(e) => { e.preventDefault(); dismissBellHint(); }} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-primary flex items-center justify-center text-[10px] shadow-md">✕</button>
                🔔 Suis tes auteurs préférés depuis leur fiche pour être alertée ici de leurs prochaines sorties.
                <div className="absolute -top-1.5 right-4 h-3 w-3 bg-primary rotate-45" />
              </div>
            )}
          </Link>
          <Button asChild variant="outline" className="rounded-xl lg:rounded-2xl border-primary/10 hover:bg-white h-11 px-4 text-sm lg:h-16 lg:px-10 font-headline italic lg:text-xl shadow-sm">
            <Link href="/journal">Mon Journal</Link>
          </Button>
          <Button asChild className="rounded-xl lg:rounded-2xl bg-primary hover:bg-primary/90 h-11 px-4 text-sm lg:h-16 lg:px-12 font-headline italic lg:text-xl shadow-2xl shadow-primary/20 transition-transform active:scale-95">
            <Link href="/add"><Plus className="mr-1.5 lg:mr-3 h-4 w-4 lg:h-6 lg:w-6" /> Ajouter</Link>
          </Button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className={cn("text-lg md:text-2xl font-headline flex items-center gap-2 md:gap-3 italic", isAmbientDark && "text-[#F5F1E8]")}>
            <Target className="h-4 w-4 md:h-6 md:w-6 text-primary/40" /> Objectif de lecture
          </h2>
          <Link href="/stats" className="text-[10px] font-bold uppercase tracking-widest text-primary/50 hover:text-primary transition-colors">
            Détails
          </Link>
        </div>
        <Card className="glass-card p-4 md:p-6 border-none bg-white/60">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Trophy className="h-5 w-5 md:h-7 md:w-7 text-copper shrink-0" />
            <div className="flex-1 min-w-[160px] space-y-2">
              <div className="flex justify-between items-baseline">
                <h3 className="text-base md:text-xl font-headline italic">{stats.annualCount} / {stats.goals.annual} <span className="text-xs font-sans not-italic opacity-50">livres cette année</span></h3>
                <span className="text-xs font-bold text-copper">{stats.annualProgress}%</span>
              </div>
              <Progress value={stats.annualProgress} className="h-2 bg-primary/5" indicatorClassName="bg-copper" />
            </div>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-copper/70" /> {stats.monthlyCount}/{stats.goals.monthly} ce mois</span>
              <span className="hidden sm:flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-copper/70" /> {stats.pagesCount.toLocaleString()} pages</span>
              <span className="hidden sm:flex items-center gap-1.5"><Headphones className="h-3.5 w-3.5 text-copper/70" /> {stats.audioCount}h</span>
            </div>
          </div>
        </Card>
      </section>


      <section className="space-y-6 md:space-y-8">
        <div className="flex justify-between items-center px-2">
          <h2 className={cn("text-xl md:text-4xl font-headline flex items-center gap-2 md:gap-4 italic", isAmbientDark && "text-[#F5F1E8]")}>
            <BookOpen className="h-5 w-5 md:h-8 md:w-8 text-primary/40" /> Votre pile de lectures
          </h2>
          {readBooks.length > 0 && (
            <Button asChild variant="link" className="text-primary italic text-sm md:text-lg group">
              <Link href="/library" className="flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1 md:ml-2 group-hover:translate-x-2 transition-transform" /></Link>
            </Button>
          )}
        </div>
        {readBooks.length > 0 ? (
          <BookShelf books={readBooks} />
        ) : (
          <p className="text-muted-foreground italic px-2">Vos lectures terminées s'empileront ici, une à une.</p>
        )}
      </section>

      {(lastRead || nextRead) && (
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <div className="flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-2xl md:rounded-[2rem] bg-white/40 border border-white/60 shadow-sm">
            <div className="relative h-14 w-10 md:h-20 md:w-14 rounded-lg md:rounded-xl overflow-hidden shrink-0 bg-secondary/5 shadow-sm">
              {lastRead && <BookCover src={(lastRead as any).cover} alt={(lastRead as any).title || ""} className="object-cover" />}
            </div>
            <div className="min-w-0 space-y-0.5 md:space-y-1">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-primary/40">Tu viens de terminer</p>
              {lastRead ? (
                <Link href={`/book/${(lastRead as any).id}`} className="block">
                  <p className="font-headline italic text-sm md:text-lg leading-tight truncate hover:text-primary transition-colors">{cleanBookTitle((lastRead as any).title)}</p>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground truncate">{cleanAuthorName((lastRead as any).author)}</p>
                </Link>
              ) : (
                <p className="text-xs md:text-sm italic opacity-40">Aucune lecture terminée pour le moment.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-2xl md:rounded-[2rem] bg-white/40 border border-white/60 shadow-sm">
            <div className="relative h-14 w-10 md:h-20 md:w-14 rounded-lg md:rounded-xl overflow-hidden shrink-0 bg-secondary/5 shadow-sm">
              {nextRead && <BookCover src={(nextRead as any).cover} alt={(nextRead as any).title || ""} className="object-cover" />}
            </div>
            <div className="min-w-0 space-y-0.5 md:space-y-1">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-primary/40">À suivre</p>
              {nextRead ? (
                <Link href={`/book/${(nextRead as any).id}`} className="block">
                  <p className="font-headline italic text-sm md:text-lg leading-tight truncate hover:text-primary transition-colors">{cleanBookTitle((nextRead as any).title)}</p>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground truncate">{cleanAuthorName((nextRead as any).author)}</p>
                </Link>
              ) : (
                <Link href="/library" className="text-xs md:text-sm italic text-primary/50 hover:text-primary transition-colors">
                  Épingle un livre de ta PAL →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.8fr_1fr] gap-8 lg:gap-12">
        <section className="space-y-4 md:space-y-8">
          <div className="flex justify-between items-center">
            <h2 className={cn("text-xl md:text-4xl font-headline flex items-center gap-2 md:gap-4 italic", isAmbientDark && "text-[#F5F1E8]")}>
              <Sparkles className="h-5 w-5 md:h-8 md:w-8 text-primary/40" /> Lecture Actuelle
            </h2>
            {currentRead && (
               <Button asChild variant="link" className="text-primary italic text-sm md:text-lg group">
                 <Link href="/library" className="flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1 md:ml-2 group-hover:translate-x-2 transition-transform" /></Link>
               </Button>
            )}
          </div>
          {readingLoading ? (
            <div className="h-60 flex items-center justify-center"><Loader2 className="animate-spin text-primary/20 h-10 w-10" /></div>
          ) : currentRead ? (
            <Card className="glass-card overflow-hidden border-none group transition-all duration-1000 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
              <div className="grid sm:grid-cols-[280px_1fr] gap-0">
                <div className="relative aspect-[3/2] sm:aspect-[2/3] overflow-hidden">
                  <BookCover
                    src={currentRead.cover}
                    alt={currentRead.title}
                    className="object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent mix-blend-overlay" />
                </div>
                <CardContent className="p-5 md:p-12 flex flex-col justify-between bg-gradient-to-br from-white to-white/50">
                  <div className="space-y-4 md:space-y-8">
                    <div>
                      <h3 className="text-xl md:text-4xl font-headline italic leading-tight group-hover:text-primary transition-colors">
                        {cleanBookTitle(currentRead.title)}{currentRead.volume ? ` — ${currentRead.volume}` : ""}
                      </h3>
                      <p className="text-xs md:text-md text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1.5 md:mt-3">{cleanAuthorName(currentRead.author)}</p>
                    </div>
                    <div className="space-y-2 md:space-y-5">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60 italic">
                        <span>Progression</span>
                        <span>{currentRead.progress || 0}%</span>
                      </div>
                      <Progress value={currentRead.progress || 0} className="h-2 md:h-3 bg-primary/5" />
                    </div>
                  </div>
                  <Button asChild className="mt-6 md:mt-10 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 h-11 md:h-16 text-sm md:text-xl font-headline italic transition-transform active:scale-95">
                    <Link href={`/book/${currentRead.id}`}>
                      <PenTool className="mr-2 md:mr-3 h-4 w-4 md:h-6 md:w-6" /> Reprendre le voyage
                    </Link>
                  </Button>
                </CardContent>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-10 md:p-24 text-center border-dashed border-primary/20 bg-white/20 group">
              <BookOpen className="h-12 w-12 md:h-20 md:w-20 mx-auto text-primary/20 mb-4 md:mb-6 group-hover:scale-110 group-hover:text-primary/40 transition-all duration-700" />
              <p className="text-primary/60 italic font-headline text-lg md:text-3xl mb-2">Réserve paisible.</p>
              <p className="text-muted-foreground italic text-sm md:text-xl">Aucune lecture en cours pour le moment.</p>
              <Button asChild variant="outline" className="mt-6 md:mt-10 rounded-xl md:rounded-2xl border-primary/20 text-primary h-10 md:h-14 px-6 md:px-12 text-sm md:text-lg shadow-sm hover:bg-white">
                <Link href="/add">Explorer vos étagères</Link>
              </Button>
            </Card>
          )}
        </section>

        <section className="space-y-6 lg:space-y-12">
          <div className="space-y-4 lg:space-y-8">
            <h2 className={cn("text-xl lg:text-4xl font-headline flex items-center gap-2 lg:gap-4 italic", isAmbientDark && "text-[#F5F1E8]")}>
              <TrendingUp className="h-5 w-5 lg:h-8 lg:w-8 text-primary/40" /> Raccourcis
            </h2>
            <div className="grid gap-3 lg:gap-6">
              <Link href="/library" className="flex items-center gap-4 lg:gap-8 p-4 lg:p-8 rounded-2xl lg:rounded-[3rem] bg-primary/5 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-2.5 lg:p-5 rounded-xl lg:rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <BookOpen className="h-5 w-5 lg:h-8 lg:w-8 text-primary" />
                </div>
                <span className="font-headline text-lg lg:text-3xl italic">Bibliothèque</span>
              </Link>
              <Link href="/profile/badges" className="flex items-center gap-4 lg:gap-8 p-4 lg:p-8 rounded-2xl lg:rounded-[3rem] bg-copper/5 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-2.5 lg:p-5 rounded-xl lg:rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Trophy className="h-5 w-5 lg:h-8 lg:w-8 text-copper" />
                </div>
                <span className="font-headline text-lg lg:text-3xl italic">Mes Badges</span>
              </Link>
              <Link href="/coups-de-coeur" className="flex items-center gap-4 lg:gap-8 p-4 lg:p-8 rounded-2xl lg:rounded-[3rem] bg-rose/5 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-2.5 lg:p-5 rounded-xl lg:rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Sparkles className="h-5 w-5 lg:h-8 lg:w-8 text-rose" />
                </div>
                <span className="font-headline text-lg lg:text-3xl italic">Coups de Cœur</span>
              </Link>
              <Link href="/library?filter=envie" className="flex items-center gap-4 lg:gap-8 p-4 lg:p-8 rounded-2xl lg:rounded-[3rem] bg-secondary/40 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-2.5 lg:p-5 rounded-xl lg:rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Heart className="h-5 w-5 lg:h-8 lg:w-8 text-primary" />
                </div>
                <span className="font-headline text-lg lg:text-3xl italic">Ma Wishlist</span>
              </Link>
              <Link href="/journal" className="flex items-center gap-4 lg:gap-8 p-4 lg:p-8 rounded-2xl lg:rounded-[3rem] bg-primary/5 border border-white/60 hover:bg-white transition-all group shadow-sm hover:shadow-2xl">
                <div className="p-2.5 lg:p-5 rounded-xl lg:rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Quote className="h-5 w-5 lg:h-8 lg:w-8 text-primary" />
                </div>
                <span className="font-headline text-lg lg:text-3xl italic">Mes Recommandations</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {lastReviewedBook && (
        <section className="space-y-4 md:space-y-6 pt-4 border-t border-primary/5">
          <h2 className={cn("text-lg md:text-3xl font-headline flex items-center gap-2 md:gap-4 italic px-2", isAmbientDark && "text-[#F5F1E8]")}>
            <Quote className="h-4 w-4 md:h-7 md:w-7 text-primary/40" /> Mon dernier avis
          </h2>
          <Link href={`/book/${lastReviewedBook.id}`}>
            <Card className="glass-card border-none bg-white/60 hover:shadow-xl transition-all duration-700 overflow-hidden">
              <CardContent className="p-4 md:p-8 flex gap-4 md:gap-6 items-start">
                <div className="relative h-20 w-14 md:h-28 md:w-20 shrink-0 rounded-xl overflow-hidden shadow-md">
                  <BookCover src={lastReviewedBook.cover} alt={lastReviewedBook.title || ""} className="object-cover" />
                </div>
                <div className="space-y-1.5 md:space-y-2 min-w-0">
                  <h3 className="font-headline italic text-base md:text-xl leading-tight">
                    {cleanBookTitle(lastReviewedBook.title)}{lastReviewedBook.volume ? ` — ${lastReviewedBook.volume}` : ""}
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{cleanAuthorName(lastReviewedBook.author)}</p>
                  <StarRating rating={lastReviewedBook.rating || 0} size={12} gap="gap-1" colorClass="text-copper fill-copper" emptyClass="text-muted-foreground/20" />
                  <p className="text-xs md:text-sm italic text-muted-foreground leading-relaxed line-clamp-3">"{lastReviewedBook.review}"</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}
    </div>
  );
}
