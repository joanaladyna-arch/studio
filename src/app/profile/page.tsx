
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactAdminDialog } from "@/components/contact-admin-dialog";
import { PublisherSubmissionDialog } from "@/components/publisher-submission-dialog";
import { ThemeBackgroundDialog } from "@/components/theme-background-dialog";
import { sortBySaga } from "@/lib/utils";
import { siWattpad } from "simple-icons";
import { 
  Share2,
  ShoppingBag,
  Crown, 
  Sparkles, 
  Trophy,
  BarChart3,
  Headphones, 
  LogOut,
  Camera,
  Loader2,
  Pencil,
  BookMarked,
  Target,
  FileText,
  ChevronRight,
  Shield,
  ShieldCheck,
  Medal,
  Award,
  Heart,
  Feather,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn, toArray, ADMIN_EMAILS, FOUNDER_EMAILS } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useCollection, useAuth, useStorage } from '@/firebase';
import { BookCover } from '@/components/book-cover';
import { BookShelf } from '@/components/book-shelf';
import { doc, collection, setDoc, serverTimestamp, updateDoc, deleteDoc, getDoc, getCountFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Book, GENRES_LIST, TROPES_LIST, FORMATS, BookFormat } from '@/app/library/page';
import { signOut, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

// Titre de lectrice évolutif, basé sur le total de livres lus toutes
// catégories confondues — du plus léger au plus dévorant, à la demande
// explicite de l'utilisatrice.
const READER_TITLES = [
  { min: 0, label: "Lectrice Lectoria" },
  { min: 10, label: "Lectrice Curieuse" },
  { min: 25, label: "Lectrice Passionnée" },
  { min: 50, label: "Lectrice Assidue" },
  { min: 100, label: "Lectrice Insatiable" },
  { min: 200, label: "Lectrice Addict" },
];

function getReaderTitle(count: number): string {
  let current = READER_TITLES[0];
  for (const tier of READER_TITLES) {
    if (count >= tier.min) current = tier;
  }
  return current.label;
}

export default function ProfilePage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, loading: profileLoading } = useDoc(profileRef);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'books');
  }, [db, user]);

  const { data: booksRaw = [] } = useCollection(booksQuery);

  const stats = useMemo(() => {
    const allBooks = toArray<Book>(booksRaw);
    const readBooks = allBooks.filter(b => b.status === 'read' || b.status === 'reread');
    const palBooks = sortBySaga(allBooks.filter(b => b.status === 'pal'));
    const wishlistBooks = sortBySaga(allBooks.filter(b => b.status === 'envie'));
    
    // Seuls les livres pour lesquels l'utilisatrice a confirmé qu'ils
    // comptent (case cochée à l'ajout) alimentent les objectifs — readCount
    // reste lui non filtré, car il alimente le titre de lectrice et les
    // badges, qui reflètent l'historique complet, pas seulement la
    // période d'objectif en cours.
    const goalEligibleBooks = readBooks.filter(b => (b as any).countTowardGoals !== false);

    const pagesRead = goalEligibleBooks.reduce((acc, b) => acc + (Number(b.pagesRead) || 0), 0);
    const audioHours = goalEligibleBooks.reduce((acc, b) => {
      const isAudio = ['audio', 'audible', 'audiolib'].includes(b.format || '');
      return acc + (isAudio ? (Number(b.pagesRead) || 0) / 50 : 0);
    }, 0);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRead = goalEligibleBooks.filter(b => {
      if (!b.dateAdded) return false;
      const d = b.dateAdded.toDate ? b.dateAdded.toDate() : new Date(b.dateAdded);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const goals = {
      annual: Number(profile?.annualGoal) || 24,
      monthly: Number(profile?.monthlyGoal) || 2,
      pages: Number(profile?.annualGoalPages) || 10000,
      audio: Number(profile?.annualAudioGoal) || 100
    };

    const genreCounts: Record<string, number> = {};
    const tropeCounts: Record<string, number> = {};
    
    readBooks.forEach(b => {
      toArray<string>(b.genres).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
      toArray<string>(b.tropes).forEach(t => tropeCounts[t] = (tropeCounts[t] || 0) + 1);
    });

    const unlockedGenres = Object.entries(genreCounts).filter(([_, count]) => count >= 5);
    const unlockedTropes = Object.entries(tropeCounts).filter(([_, count]) => count >= 5);
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      readCount: readBooks.length,
      annualReadCount: goalEligibleBooks.length,
      monthlyReadCount: monthlyRead.length,
      palBooks,
      wishlistBooks,
      pagesRead,
      audioHours: Math.round(audioHours),
      goals,
      annualProgress: Math.min(100, Math.round((goalEligibleBooks.length / (goals.annual || 1)) * 100)),
      monthlyProgress: Math.min(100, Math.round((monthlyRead.length / (goals.monthly || 1)) * 100)),
      pagesProgress: Math.min(100, Math.round((pagesRead / (goals.pages || 1)) * 100)),
      audioProgress: Math.min(100, Math.round((audioHours / (goals.audio || 1)) * 100)),
      unlockedGenres,
      unlockedTropes,
      topGenre
    };
  }, [booksRaw, profile]);

  // Nombre d'abonnées : lu depuis followers/{monUid}/entries plutôt que
  // depuis les documents privés d'autres utilisatrices (impossible avec
  // les règles actuelles) — chaque entrée y a été écrite par la lectrice
  // qui suit, jamais par la lectrice suivie.
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  useEffect(() => {
    if (!db || !user) return;
    getCountFromServer(collection(db, "followers", user.uid, "entries"))
      .then((snap) => setFollowerCount(snap.data().count))
      .catch(() => setFollowerCount(null));
  }, [db, user]);

  // Résolution des auteurs suivis (slugs) vers leur fiche complète, pour
  // un aperçu direct sur le profil — jusqu'ici il fallait déjà savoir
  // quels auteurs on suivait pour retrouver leur fiche un par un.
  const [followedAuthorsInfo, setFollowedAuthorsInfo] = useState<any[]>([]);
  useEffect(() => {
    if (!db) { setFollowedAuthorsInfo([]); return; }
    const slugs = toArray<string>(profile?.followedAuthors);
    if (slugs.length === 0) { setFollowedAuthorsInfo([]); return; }
    let cancelled = false;
    Promise.all(slugs.map((slug) => getDoc(doc(db, "authors", slug)).then((d) => (d.exists() ? { slug, ...d.data() } : { slug, name: slug }))))
      .then((results) => { if (!cancelled) setFollowedAuthorsInfo(results); })
      .catch(() => { if (!cancelled) setFollowedAuthorsInfo([]); });
    return () => { cancelled = true; };
  }, [db, profile?.followedAuthors]);

  const isFounder = Boolean(user?.email && FOUNDER_EMAILS.includes(user.email));

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push('/login');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur lors de la déconnexion' });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user || !db) return;
    setUploading(true);
    const storageRef = ref(storage, `users/${user.uid}/profile/avatar-${Date.now()}`);
    try {
      // Timeout de 15s : si Firebase Storage bloque la requête sans
      // renvoyer d'erreur (règles trop restrictives, problème réseau),
      // le spinner s'arrêterait sinon à l'infini.
      await Promise.race([
        uploadBytes(storageRef, file),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))
      ]);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { avatarUrl: url });
      if (auth?.currentUser) await updateProfile(auth.currentUser, { photoURL: url });
      toast({ title: 'Photo mise à jour', description: 'Votre nouvelle identité est gravée.' });
    } catch (error: any) {
      console.error("Profile Upload Error:", error);
      const isTimeout = error?.message === "timeout";
      const isPermission = error?.code === "storage/unauthorized";
      toast({
        variant: 'destructive',
        title: isTimeout ? 'Délai dépassé' : isPermission ? 'Permission refusée' : 'Erreur d\'importation',
        description: isTimeout
          ? 'Vérifiez les règles Firebase Storage dans la console.'
          : isPermission
          ? 'Les règles Firebase Storage bloquent l\'upload.'
          : 'La photo n\'a pas pu être envoyée. Réessaie.',
      });
    } finally {
      setUploading(false);
    }
  };

  if (profileLoading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
      <p className="font-headline italic text-primary/60">Ouverture de votre réserve...</p>
    </div>
  );

  const userName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Lectrice Lectoria';
  const userPhoto = profile?.avatarUrl || user?.photoURL || `https://picsum.photos/seed/${user?.uid || 'lectoria'}/200/200`;

  return (
    <div className="space-y-16 animate-paper pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center pt-4 md:pt-8 gap-6 md:gap-10">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="relative group">
            <Avatar className="h-28 w-28 md:h-44 md:w-44 border-4 border-white shadow-2xl overflow-hidden transition-transform duration-500 group-hover:scale-105">
              <AvatarImage src={userPhoto} className="object-cover" />
              <AvatarFallback className="font-headline italic text-xl md:text-3xl">PL</AvatarFallback>
            </Avatar>
            {/* Overlay desktop (hover) */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full z-10 hidden md:flex"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
            </button>
            {/* Bouton toujours visible sur mobile — le hover n'existe pas
                sur écran tactile, donc l'overlay ci-dessus resterait
                invisible à jamais pour les lectrices sur iPhone/Android. */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="md:hidden absolute -bottom-1.5 -left-1.5 bg-primary text-white rounded-full p-2 border-4 border-white shadow-xl z-20 flex items-center justify-center"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            <div className="absolute -bottom-1.5 -right-1.5 md:-bottom-2 md:-right-2 bg-amber-500 text-white rounded-full p-2 md:p-3 border-4 border-white shadow-xl z-20">
              <Crown className="h-5 w-5 md:h-7 md:w-7" />
            </div>
            {isFounder && (
              <div className="absolute -top-1 -left-1 md:-top-2 md:-left-2 bg-copper text-primary-foreground rounded-full p-1.5 md:p-2 border-2 md:border-4 border-white shadow-xl z-20" title="Lectrice Fondatrice — bêta de la première heure">
                <Sparkles className="h-3.5 w-3.5 md:h-5 md:w-5" />
              </div>
            )}
          </div>
          <div className="space-y-2 md:space-y-3 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-headline italic tracking-tight break-words">{userName}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <Badge className="rounded-full bg-primary/10 text-primary border-none px-4 py-1.5 italic font-headline text-xs md:text-sm gap-2">
                <Feather className="h-3.5 w-3.5" /> {getReaderTitle(stats.readCount)}
              </Badge>
              {isFounder && (
                <Badge className="rounded-full bg-copper/10 text-copper border-none px-4 py-1.5 italic font-headline text-xs md:text-sm gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Lectrice Fondatrice
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground italic text-sm md:text-lg leading-relaxed max-w-xl">
              "{profile?.profileQuote || "Chaque page tournée est un souvenir gravé."}"
            </p>
            <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              {user?.metadata?.creationTime && (
                <span>Membre depuis {new Date(user.metadata.creationTime).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              )}
              {followerCount !== null && followerCount > 0 && (
                <Link href="/community" className="hover:text-rose transition-colors">{followerCount} abonnée{followerCount > 1 ? "s" : ""}</Link>
              )}
            </div>
            {profile?.bio && <p className="text-muted-foreground italic text-sm md:text-xl max-w-xl leading-relaxed">{profile.bio}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="flex gap-3 items-center justify-center md:justify-start flex-wrap">
              <EditProfileDialog profile={profile} />
              <ContactAdminDialog />
            </div>
            <div className="flex justify-center md:justify-start">
              <PublisherSubmissionDialog />
            </div>
            <Button variant="ghost" asChild className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors">
                <Link href="/passport"><Trophy className="h-5 w-5 mr-3" /> Passeport de lectrice</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors">
                <Link href="/stats"><BarChart3 className="h-5 w-5 mr-3" /> Bilan de lecture</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors">
                <Link href="/share"><Share2 className="h-5 w-5 mr-3" /> Exporter vers les réseaux</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors">
                <Link href="/community"><Users className="h-5 w-5 mr-3" /> Communauté de lectrices</Link>
            </Button>
            <ThemeBackgroundDialog currentTheme={profile?.themeBackground} />
            {(profile?.wattpadUrl || profile?.amazonUrl) && (
              <div className="flex gap-3 justify-center md:justify-start px-2">
                {profile?.wattpadUrl && (
                  <a
                    href={profile.wattpadUrl} target="_blank" rel="noopener noreferrer"
                    title="Mon profil Wattpad"
                    className="h-12 w-12 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                    style={{ backgroundColor: `#${siWattpad.hex}` }}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d={siWattpad.path} /></svg>
                  </a>
                )}
                {profile?.amazonUrl && (
                  <a
                    href={profile.amazonUrl} target="_blank" rel="noopener noreferrer"
                    title="Ma page auteur Amazon"
                    className="h-12 w-12 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform bg-[#FF9900]"
                  >
                    <ShoppingBag className="h-5 w-5 text-white" />
                  </a>
                )}
              </div>
            )}
            {user?.email && ADMIN_EMAILS.includes(user.email) && (
              <Button variant="ghost" asChild className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors">
                  <Link href="/admin"><ShieldCheck className="h-5 w-5 mr-3" /> Administration</Link>
              </Button>
            )}
            <Button variant="ghost" onClick={handleLogout} className="rounded-full h-14 px-8 text-destructive hover:bg-rose-50 font-headline italic text-lg transition-colors">
                <LogOut className="h-5 w-5 mr-3" /> Déconnexion
            </Button>
        </div>
      </header>

      {/* Tableau de bord — aperçu condensé du Bilan/Passeport/Badges,
          des genres & tropes favoris (fréquence réelle de lecture) et
          des auteurs suivis, directement visible sans clic. Répond au
          constat bêta : le suivi d'auteur notamment était largement
          ignoré faute de visibilité. */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <Link href="/stats" className="block">
          <Card className="glass-card border-none bg-white/60 p-5 md:p-6 hover:shadow-lg transition-shadow h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline italic text-lg">Bilan de lecture</h3>
              <ChevronRight className="h-4 w-4 text-primary/40" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 text-center bg-primary/5 rounded-xl py-3">
                <p className="font-headline italic text-xl text-copper">{stats.readCount}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mt-1">Livres lus</p>
              </div>
              <div className="flex-1 text-center bg-primary/5 rounded-xl py-3 px-1">
                <p className="font-headline italic text-sm text-copper truncate">{stats.topGenre || "—"}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mt-1">Genre dominant</p>
              </div>
              <div className="flex-1 text-center bg-primary/5 rounded-xl py-3">
                <p className="font-headline italic text-xl text-copper">{stats.monthlyReadCount}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mt-1">Ce mois</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/profile/badges" className="block">
          <Card className="glass-card border-none bg-white/60 p-5 md:p-6 hover:shadow-lg transition-shadow h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline italic text-lg">Derniers badges</h3>
              <ChevronRight className="h-4 w-4 text-primary/40" />
            </div>
            {(stats.unlockedGenres.length + stats.unlockedTropes.length) > 0 ? (
              <div className="flex gap-3">
                {[...stats.unlockedTropes, ...stats.unlockedGenres]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([label]) => (
                    <div key={label} className="flex-1 text-center bg-copper/5 rounded-xl py-3 px-1">
                      <Medal className="h-4 w-4 mx-auto text-copper mb-1" />
                      <p className="text-[8px] font-bold uppercase tracking-wide leading-tight truncate">{label}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">5 livres d'un même genre ou trope débloquent votre premier badge.</p>
            )}
          </Card>
        </Link>
      </div>

      {(stats.unlockedGenres.length + stats.unlockedTropes.length) > 0 && (
        <div className="space-y-4">
          <h3 className="font-headline italic text-lg px-2">Genres & tropes favoris</h3>
          <Card className="glass-card border-none bg-white/40 p-6">
            <div className="flex flex-wrap gap-2 items-center justify-center">
              {[...stats.unlockedGenres, ...stats.unlockedTropes]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([label, count], i) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-full font-headline italic px-3 py-1",
                      i === 0 ? "bg-rose text-primary text-lg" : i < 3 ? "bg-copper/80 text-white text-sm" : "bg-primary/80 text-white text-xs"
                    )}
                  >
                    {label}
                  </span>
                ))}
            </div>
          </Card>
        </div>
      )}

      {followedAuthorsInfo.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-headline italic text-lg">Auteurs suivis ({followedAuthorsInfo.length})</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-2 pb-1">
            {followedAuthorsInfo.map((a) => (
              <Link key={a.slug} href={`/author/${encodeURIComponent(a.name || a.slug)}`} className="shrink-0 w-16 text-center group">
                <Avatar className="h-12 w-12 mx-auto border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                  <AvatarImage src={a.avatarUrl} className="object-cover" />
                  <AvatarFallback className="font-headline italic text-xs bg-primary/5">{(a.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <p className="text-[9px] mt-1.5 truncate leading-tight">{a.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile?.favoriteQuote && (
        <Card className="glass-card border-none bg-white/40 p-12 text-center space-y-6 shadow-sm">
          <p className="text-3xl font-headline italic text-primary leading-relaxed">"{profile.favoriteQuote}"</p>
          {profile?.favoriteAuthor && <p className="text-[10px] uppercase font-bold tracking-[0.5em] opacity-40">— {profile.favoriteAuthor}</p>}
        </Card>
      )}

      <section className="space-y-10">
        <h2 className="text-4xl font-headline flex items-center gap-4 italic">
          <Target className="h-8 w-8 text-primary/40" /> Mes Défis
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: "Annuel", icon: Trophy, value: `${stats.annualReadCount} / ${stats.goals.annual}`, progress: stats.annualProgress, color: "text-amber-500", bg: "bg-amber-50" },
            { label: "Mensuel", icon: Target, value: `${stats.monthlyReadCount} / ${stats.goals.monthly}`, progress: stats.monthlyProgress, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Pages", icon: FileText, value: `${stats.pagesRead.toLocaleString()}`, progress: stats.pagesProgress, color: "text-emerald-500", bg: "bg-emerald-50" },
            { label: "Audio", icon: Headphones, value: `${stats.audioHours}h`, progress: stats.audioProgress, color: "text-purple-400", bg: "bg-purple-50" }
          ].map((item, i) => (
            <Card key={i} className="glass-card p-8 border-none bg-white/60 space-y-6 hover:shadow-lg transition-all duration-500">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 italic">{item.label}</p>
                <item.icon className={cn("h-7 w-7", item.color)} />
              </div>
              <p className="text-3xl font-headline italic">{item.value}</p>
              <div className="space-y-3">
                <Progress value={item.progress} className={cn("h-2", item.bg)} />
                <p className={cn("text-[10px] font-bold uppercase", item.color)}>{item.progress}% atteint</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-headline italic flex items-center gap-4">
            <Award className="h-8 w-8 text-primary/40" /> Badges & Médailles
          </h2>
          <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic text-lg">
            <Link href="/profile/badges">Voir tous mes exploits <ChevronRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <Card className="glass-card border-none bg-white/40 p-8 space-y-6">
            <h3 className="font-headline italic text-2xl flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary/40" /> Genres de Prédilection
            </h3>
            {toArray<string>(profile?.favoriteGenres).length > 0 && (
              <div className="flex flex-wrap gap-1.5 -mt-2">
                {toArray<string>(profile?.favoriteGenres).map((g: string) => (
                  <Badge key={g} variant="outline" className="rounded-full border-primary/15 text-primary/60 text-[9px] px-2.5 py-0.5 italic font-normal">
                    {g}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {stats.unlockedGenres.length > 0 ? (
                stats.unlockedGenres.slice(0, 6).map(([genre]) => (
                  <div key={genre} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/60 min-w-[100px] border border-primary/5">
                    <Shield className="h-8 w-8 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase text-center truncate w-full">{genre}</span>
                  </div>
                ))
              ) : (
                <p className="italic text-muted-foreground text-sm">Continuez à lire pour débloquer vos premiers badges de genre.</p>
              )}
            </div>
          </Card>

          <Card className="glass-card border-none bg-white/40 p-8 space-y-6">
            <h3 className="font-headline italic text-2xl flex items-center gap-3">
              <Medal className="h-6 w-6 text-rose" /> Tropes Favoris
            </h3>
            {toArray<string>(profile?.favoriteTropes).length > 0 && (
              <div className="flex flex-wrap gap-1.5 -mt-2">
                {toArray<string>(profile?.favoriteTropes).map((t: string) => (
                  <Badge key={t} variant="outline" className="rounded-full border-rose/25 text-rose text-[9px] px-2.5 py-0.5 italic font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {stats.unlockedTropes.length > 0 ? (
                stats.unlockedTropes.slice(0, 6).map(([trope]) => (
                  <div key={trope} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/60 min-w-[100px] border border-rose/10">
                    <Medal className="h-8 w-8 text-rose" />
                    <span className="text-[10px] font-bold uppercase text-center truncate w-full">{trope}</span>
                  </div>
                ))
              ) : (
                <p className="italic text-muted-foreground text-sm">Vos thématiques récurrentes apparaîtront ici sous forme de médailles.</p>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-10 pt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-headline italic flex items-center gap-4">
            <BookMarked className="h-8 w-8 text-primary/40" /> Mon étagère PAL
          </h2>
          <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic text-lg">
            <Link href="/library">Voir toute ma PAL <ChevronRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
        {stats.palBooks.length > 0 ? (
          <BookShelf books={stats.palBooks} />
        ) : (
          <div className="w-full text-center py-16 opacity-40">
            <p className="italic font-headline text-xl">Votre étagère PAL est encore vide.</p>
          </div>
        )}
      </section>

      <section className="space-y-10 pt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-headline italic flex items-center gap-4">
            <Heart className="h-8 w-8 text-primary/40" /> Ma Wishlist
          </h2>
          <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic text-lg">
            <Link href="/library">Voir tout <ChevronRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
        {stats.wishlistBooks.length > 0 ? (
          <BookShelf books={stats.wishlistBooks} />
        ) : (
          <div className="w-full text-center py-16 opacity-40">
            <p className="italic font-headline text-xl">Les livres à acheter ou à lire plus tard s'empileront ici — choisissez "Envie" en les ajoutant.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function EditProfileDialog({ profile }: { profile: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [profileQuote, setProfileQuote] = useState('');
  const [favoriteQuote, setFavoriteQuote] = useState('');
  const [favoriteAuthor, setFavoriteAuthor] = useState('');
  const [annualGoal, setAnnualGoal] = useState(24);
  const [monthlyGoal, setMonthlyGoal] = useState(2);
  const [annualGoalPages, setAnnualGoalPages] = useState(10000);
  const [annualAudioGoal, setAnnualAudioGoal] = useState(100);
  const [favoriteFormat, setFavoriteFormat] = useState<BookFormat>('papier');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [favoriteTropes, setFavoriteTropes] = useState<string[]>([]);
  const [wattpadUrl, setWattpadUrl] = useState('');
  const [amazonUrl, setAmazonUrl] = useState('');
  const [communityVisible, setCommunityVisible] = useState(false);

  useEffect(() => {
    if (profile && open) {
      setName(profile.name || '');
      setBio(profile.bio || '');
      setProfileQuote(profile.profileQuote || '');
      setFavoriteQuote(profile.favoriteQuote || '');
      setFavoriteAuthor(profile.favoriteAuthor || '');
      setAnnualGoal(Number(profile.annualGoal) || 24);
      setMonthlyGoal(Number(profile.monthlyGoal) || 2);
      setAnnualGoalPages(Number(profile.annualGoalPages) || 10000);
      setAnnualAudioGoal(Number(profile.annualAudioGoal) || 100);
      setFavoriteFormat(profile.favoriteFormat || 'papier');
      setFavoriteGenres(toArray<string>(profile.favoriteGenres));
      setFavoriteTropes(toArray<string>(profile.favoriteTropes));
      setWattpadUrl(profile.wattpadUrl || '');
      setAmazonUrl(profile.amazonUrl || '');
      setCommunityVisible(Boolean(profile.communityVisible));
    }
  }, [profile, open]);

  const handleSave = async () => {
    if (!db || !user) return;
    setLoading(true);
    const data = {
      name, bio, profileQuote, favoriteQuote, favoriteAuthor,
      annualGoal, monthlyGoal, annualGoalPages, annualAudioGoal,
      favoriteFormat, favoriteGenres, favoriteTropes,
      wattpadUrl: wattpadUrl.trim(), amazonUrl: amazonUrl.trim(),
      communityVisible,
      lastUpdated: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
      // Miroir public minimal, uniquement si la lectrice a coché la
      // visibilité communauté — sans ça, aucune donnée personnelle ne
      // doit être lisible par d'autres lectrices. On n'y copie jamais
      // les objectifs, la bibliothèque ou quoi que ce soit d'autre.
      if (communityVisible) {
        await setDoc(doc(db, 'publicProfiles', user.uid), {
          name: name || 'Lectrice Lectoria',
          avatarUrl: profile?.avatarUrl || '',
          bio,
          favoriteGenres,
          updatedAt: serverTimestamp(),
        }, { merge: false });
      } else {
        // Suppression complète (pas un simple merge avec hidden:true) :
        // la collection publicProfiles est lisible par n'importe qui
        // (allow read: if true), donc laisser les anciens champs
        // nom/photo/bio dessous d'un indicateur "hidden" les rendrait
        // quand même récupérables par une lecture directe de la
        // collection. Un document absent ne peut rien révéler.
        try {
          await deleteDoc(doc(db, 'publicProfiles', user.uid));
        } catch (delErr) {
          // Le document n'existait peut-être simplement pas encore —
          // rien d'anormal, on ne bloque jamais la sauvegarde du
          // profil pour ça.
        }
      }
      toast({ title: 'Profil mis à jour', description: 'Vos préférences ont été enregistrées avec succès.' });
      setOpen(false);
    } catch (e) {
      console.error("Profile Save Error:", e);
      toast({ variant: 'destructive', title: 'Erreur de sauvegarde' });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (list: string[], setList: (l: string[]) => void, item: string) => {
    const currentList = list || [];
    setList(currentList.includes(item) ? currentList.filter(i => i !== item) : [...currentList, item]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-5 text-sm md:h-16 md:px-12 rounded-2xl md:rounded-[2rem] bg-primary text-white font-headline italic md:text-2xl shadow-xl transition-transform active:scale-95">
          <Pencil className="h-4 w-4 md:h-6 md:w-6 mr-2 md:mr-4" /> Modifier le Profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] h-[90vh] glass-card border-none flex flex-col p-0 overflow-hidden bg-white/95 backdrop-blur-3xl shadow-2xl">
        <DialogHeader className="p-6 sm:p-8 border-b bg-white/40 shrink-0">
          <DialogTitle className="font-headline text-3xl sm:text-4xl italic">Identité Lectoria</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className="p-5 sm:p-8 space-y-12 sm:space-y-16 pb-12">
            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary/60 border-b pb-4">Informations Personnelles</h3>
              <div className="grid gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Prénom ou Pseudo</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-14 rounded-2xl bg-white/40 border-none italic text-lg focus-visible:ring-1 focus-visible:ring-primary/20" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Ma citation de profil</Label>
                  <Input
                    value={profileQuote}
                    onChange={(e) => setProfileQuote(e.target.value)}
                    placeholder="Chaque page tournée est un souvenir gravé."
                    maxLength={120}
                    className="h-14 rounded-2xl bg-white/40 border-none italic text-lg focus-visible:ring-1 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Bio de Lectrice</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[120px] rounded-2xl bg-white/40 border-none italic p-6 text-lg focus-visible:ring-1 focus-visible:ring-primary/20 resize-none" />
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Citation Favorite</Label>
                    <Input value={favoriteQuote} onChange={(e) => setFavoriteQuote(e.target.value)} className="h-14 rounded-2xl bg-white/40 border-none italic focus-visible:ring-1 focus-visible:ring-primary/20" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Auteur de Référence</Label>
                    <Input value={favoriteAuthor} onChange={(e) => setFavoriteAuthor(e.target.value)} className="h-14 rounded-2xl bg-white/40 border-none italic focus-visible:ring-1 focus-visible:ring-primary/20" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Mon profil Wattpad</Label>
                    <Input value={wattpadUrl} onChange={(e) => setWattpadUrl(e.target.value)} placeholder="https://www.wattpad.com/user/..." className="h-14 rounded-2xl bg-white/40 border-none italic focus-visible:ring-1 focus-visible:ring-primary/20" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Ma page auteur Amazon</Label>
                    <Input value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} placeholder="https://www.amazon.fr/..." className="h-14 rounded-2xl bg-white/40 border-none italic focus-visible:ring-1 focus-visible:ring-primary/20" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-rose/5 border border-rose/10">
                  <div className="space-y-0.5">
                    <span className="block font-headline italic text-lg">
                      {communityVisible ? "Profil visible" : "Profil bloqué"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {communityVisible ? "Les autres lectrices peuvent te trouver et te suivre." : "Invisible pour les autres lectrices."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommunityVisible(!communityVisible)}
                    className={cn(
                      "shrink-0 rounded-full px-6 h-11 font-headline italic text-sm transition-colors",
                      communityVisible ? "bg-rose text-primary" : "bg-white/60 text-muted-foreground border border-rose/20"
                    )}
                  >
                    {communityVisible ? "Visible" : "Bloqué"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary/60 border-b pb-4">Mes Défis de Lecture</h3>
              <div className="grid sm:grid-cols-2 gap-8 sm:gap-12">
                <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                  <Label className="text-[10px] uppercase font-bold opacity-60 flex justify-between">
                    Livres / An <span className="text-primary italic font-headline text-lg">{annualGoal}</span>
                  </Label>
                  <div className="w-full overflow-hidden pr-1">
                    <Slider value={[annualGoal]} min={1} max={500} onValueChange={(v) => setAnnualGoal(v[0])} />
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                  <Label className="text-[10px] uppercase font-bold opacity-60 flex justify-between">
                    Livres / Mois <span className="text-primary italic font-headline text-lg">{monthlyGoal}</span>
                  </Label>
                  <div className="w-full overflow-hidden pr-1">
                    <Slider value={[monthlyGoal]} min={1} max={50} onValueChange={(v) => setMonthlyGoal(v[0])} />
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                  <Label className="text-[10px] uppercase font-bold opacity-60 flex justify-between">
                    Pages / An <span className="text-primary italic font-headline text-lg">{annualGoalPages.toLocaleString()}</span>
                  </Label>
                  <div className="w-full overflow-hidden pr-1">
                    <Slider value={[annualGoalPages]} min={1000} max={100000} step={1000} onValueChange={(v) => setAnnualGoalPages(v[0])} />
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                  <Label className="text-[10px] uppercase font-bold opacity-60 flex justify-between">
                    Audio / An (heures) <span className="text-primary italic font-headline text-lg">{annualAudioGoal}h</span>
                  </Label>
                  <div className="w-full overflow-hidden pr-1">
                    <Slider value={[annualAudioGoal]} min={1} max={1000} onValueChange={(v) => setAnnualAudioGoal(v[0])} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary/60 border-b pb-4">Mon Univers Littéraire</h3>
              <div className="space-y-10">
                <div className="space-y-4">
                  <Label className="text-[10px] uppercase font-bold opacity-60">Format Préféré</Label>
                  <Select value={favoriteFormat} onValueChange={(v) => setFavoriteFormat(v as BookFormat)}>
                    <SelectTrigger className="h-14 rounded-2xl bg-white/40 border-none italic text-lg focus:ring-1 focus:ring-primary/20">
                      <SelectValue placeholder="Choisir un format" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMATS).map(([k,v]) => (
                        <SelectItem key={k} value={k} className="italic font-headline text-lg">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold opacity-60">Genres de Cœur</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {GENRES_LIST.map(g => (
                      <div 
                        key={g} 
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-2xl cursor-pointer transition-all border",
                          (favoriteGenres || []).includes(g) ? "bg-primary/10 border-primary/20 shadow-sm" : "bg-white/40 border-transparent hover:bg-white/60"
                        )} 
                        onClick={() => toggle(favoriteGenres, setFavoriteGenres, g)}
                      >
                        <Checkbox checked={(favoriteGenres || []).includes(g)} className="border-primary/20 data-[state=checked]:bg-primary" /> 
                        <span className="italic font-headline text-sm">{g}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold opacity-60">Tropes de Cœur</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TROPES_LIST.map(t => (
                      <div 
                        key={t} 
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-2xl cursor-pointer transition-all border",
                          (favoriteTropes || []).includes(t) ? "bg-secondary/10 border-secondary/20 shadow-sm" : "bg-white/40 border-transparent hover:bg-white/60"
                        )} 
                        onClick={() => toggle(favoriteTropes, setFavoriteTropes, t)}
                      >
                        <Checkbox checked={(favoriteTropes || []).includes(t)} className="border-secondary/20 data-[state=checked]:bg-secondary" /> 
                        <span className="italic font-headline text-sm">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-8 border-t bg-white/60 shrink-0 gap-4 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="h-14 font-headline italic text-xl px-8 rounded-2xl">Annuler</Button>
          <Button onClick={handleSave} disabled={loading} className="h-16 px-16 rounded-[2rem] bg-primary text-2xl font-headline italic shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Graver mon identité"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
