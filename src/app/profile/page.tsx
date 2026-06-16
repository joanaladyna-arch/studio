
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Crown, 
  Sparkles, 
  Award, 
  Medal as MedalIcon, 
  BookOpen, 
  Headphones, 
  LogOut,
  Mail,
  Camera,
  Loader2,
  Pencil,
  BookMarked,
  Tags,
  Target,
  Shield,
  Calendar,
  FileText,
  Trophy,
  User as UserIcon,
  Quote,
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useCollection, useAuth, useStorage } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Book, GENRES_LIST, TROPES_LIST, FORMATS, BookFormat } from '@/app/library/page';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

const LEVELS = [
  { label: "Bronze", min: 5, color: "text-amber-600", bg: "bg-amber-100" },
  { label: "Silver", min: 15, color: "text-slate-400", bg: "bg-slate-100" },
  { label: "Gold", min: 30, color: "text-yellow-500", bg: "bg-yellow-100" },
  { label: "Diamond", min: 50, color: "text-cyan-400", bg: "bg-cyan-100" },
];

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

  const { data: books = [] } = useCollection(booksQuery);

  const stats = useMemo(() => {
    const allBooks = (books as unknown as Book[]);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const readBooks = allBooks.filter(b => b.status === 'read' || b.status === 'reread');
    const monthlyRead = readBooks.filter(b => {
      if (!b.endDate) return false;
      const d = new Date(b.endDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const pagesRead = readBooks.reduce((acc, b) => acc + (b.pages || 0), 0);
    const audioHours = readBooks.reduce((acc, b) => acc + (['audio', 'audible', 'audiolib'].includes(b.format || '') ? (b.pages || 0) / 50 : 0), 0);
    
    const genreCounts: Record<string, number> = {};
    const tropeCounts: Record<string, number> = {};
    
    readBooks.forEach(b => {
      b.genres?.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
      b.tropes?.forEach(t => { tropeCounts[t] = (tropeCounts[t] || 0) + 1; });
    });

    const goals = {
      annual: profile?.annualGoal || 24,
      monthly: profile?.monthlyGoal || 2,
      pages: profile?.annualGoalPages || 10000,
      audio: profile?.annualAudioGoal || 100
    };

    return {
      readCount: readBooks.length,
      monthlyCount: monthlyRead.length,
      pagesRead,
      audioHours: Math.round(audioHours),
      genreCounts,
      tropeCounts,
      goals,
      annualProgress: Math.min(100, Math.round((readBooks.length / goals.annual) * 100)),
      monthlyProgress: Math.min(100, Math.round((monthlyRead.length / goals.monthly) * 100)),
      pagesProgress: Math.min(100, Math.round((pagesRead / goals.pages) * 100)),
      audioProgress: Math.min(100, Math.round((audioHours / goals.audio) * 100))
    };
  }, [books, profile]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ title: 'Déconnexion', description: 'À bientôt sur Plume !' });
      router.push('/login');
    } catch (error) {
      console.error('PLUME Auth Error', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user || !db) return;

    setUploading(true);
    const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
    
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'users', user.uid), { avatarUrl: url }, { merge: true });
      toast({ title: 'Photo mise à jour', description: 'Votre nouvel avatar a été enregistré.' });
    } catch (error) {
      console.error('Upload error', error);
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'importer l'image." });
    } finally {
      setUploading(false);
    }
  };

  const userName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Lectrice Plume';
  const userPseudo = profile?.pseudo || '';
  const userPhoto = profile?.avatarUrl || user?.photoURL || `https://picsum.photos/seed/${user?.uid}/200/200`;

  if (profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="font-headline italic text-primary/60">Ouverture de votre sanctuaire...</p>
      </div>
    );
  }

  const earnedBadges = Object.entries(stats.genreCounts)
    .filter(([_, count]) => count >= 5)
    .map(([genre, count]) => ({ genre, count }));

  const earnedMedals = Object.entries(stats.tropeCounts)
    .filter(([_, count]) => count >= 5)
    .map(([trope, count]) => ({ trope, count }));

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center pt-8 gap-10 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <Avatar className="h-40 w-40 border-4 border-white shadow-2xl overflow-hidden ring-1 ring-primary/5">
              <AvatarImage src={userPhoto} className="object-cover" />
              <AvatarFallback className="bg-primary/5 text-primary text-3xl font-headline italic">PL</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white rounded-full p-2.5 border-4 border-white shadow-xl">
              <Crown className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-5xl font-headline italic tracking-tight">{userName}</h1>
              {userPseudo && <p className="text-primary/60 font-medium italic text-lg">@{userPseudo}</p>}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-4 text-muted-foreground italic text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 opacity-40" /> {user?.email}</div>
            </div>
            {profile?.bio && <p className="text-muted-foreground italic text-lg max-w-xl leading-relaxed">{profile.bio}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
            <EditProfileDialog profile={profile} />
            <Button variant="ghost" onClick={handleLogout} className="rounded-full h-14 px-8 text-destructive hover:bg-destructive/5 font-headline italic text-lg">
                <LogOut className="h-5 w-5 mr-3" /> Déconnexion
            </Button>
        </div>
      </header>

      {profile?.favoriteQuote && (
        <Card className="glass-card border-none bg-white/40 p-10 relative overflow-hidden group">
          <Quote className="absolute -top-4 -left-4 h-24 w-24 text-primary/5 -rotate-12 transition-transform group-hover:rotate-0 duration-700" />
          <div className="relative z-10 text-center space-y-4">
            <p className="text-2xl font-headline italic text-primary leading-relaxed">"{profile.favoriteQuote}"</p>
            {profile.favoriteAuthor && <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-40">— {profile.favoriteAuthor}</p>}
          </div>
        </Card>
      )}

      <section className="space-y-10">
        <h2 className="text-4xl font-headline flex items-center gap-4 italic">
          <Target className="h-8 w-8 text-primary/40" /> Mes Objectifs de Lecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: "Annuel", icon: Trophy, value: `${stats.readCount} / ${stats.goals.annual}`, progress: stats.annualProgress, color: "text-amber-500", bg: "bg-primary/5" },
            { label: "Mensuel", icon: Calendar, value: `${stats.monthlyCount} / ${stats.goals.monthly}`, progress: stats.monthlyProgress, color: "text-blue-400", bg: "bg-blue-50" },
            { label: "Pages", icon: FileText, value: `${stats.pagesRead.toLocaleString()} / ${stats.goals.pages.toLocaleString()}`, progress: stats.pagesProgress, color: "text-emerald-500", bg: "bg-emerald-50" },
            { label: "Audio", icon: Headphones, value: `${stats.audioHours}h / ${stats.goals.audio}h`, progress: stats.audioProgress, color: "text-purple-400", bg: "bg-purple-50" }
          ].map((item, i) => (
            <Card key={i} className="glass-card p-8 border-none bg-white/60 space-y-6 hover:shadow-xl transition-all duration-700">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40">{item.label}</p>
                <item.icon className={cn("h-6 w-6", item.color)} />
              </div>
              <p className="text-3xl font-headline italic">{item.value}</p>
              <div className="space-y-3">
                <Progress value={item.progress} className={cn("h-2", item.bg)} />
                <p className={cn("text-[10px] font-bold uppercase tracking-widest", item.color)}>{item.progress}% atteint</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <h2 className="text-3xl font-headline flex items-center gap-3 italic">
            <Tags className="h-6 w-6 text-primary/40" /> Thématiques de Cœur
          </h2>
          <Card className="glass-card p-10 border-none bg-white/40 space-y-8">
            <div className="space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 italic">Genres favoris</p>
              <div className="flex flex-wrap gap-2">
                {profile?.favoriteGenres?.length ? profile.favoriteGenres.map((g: string) => (
                  <Badge key={g} className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-full">
                    {g}
                  </Badge>
                )) : <p className="italic text-muted-foreground text-sm opacity-60">Aucun genre défini.</p>}
              </div>
            </div>
            <div className="space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 italic">Tropes fétiches</p>
              <div className="flex flex-wrap gap-2">
                {profile?.favoriteTropes?.length ? profile.favoriteTropes.map((t: string) => (
                  <Badge key={t} className="bg-secondary/20 text-secondary-foreground border-none text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-full">
                    {t}
                  </Badge>
                )) : <p className="italic text-muted-foreground text-sm opacity-60">Aucun trope défini.</p>}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-headline flex items-center gap-3 italic">
            <Star className="h-6 w-6 text-amber-500/40" /> Préférences & Format
          </h2>
          <Card className="glass-card p-10 border-none bg-white/40 flex flex-col justify-center gap-8">
             <div className="flex items-center gap-6">
               <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
                 <BookMarked className="h-8 w-8" />
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Format préféré</p>
                 <p className="text-2xl font-headline italic">{profile?.preferredFormat ? FORMATS[profile.preferredFormat as BookFormat]?.label : "Non défini"}</p>
               </div>
             </div>
             {profile?.favoriteAuthor && (
               <div className="flex items-center gap-6">
                 <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-secondary">
                   <UserIcon className="h-8 w-8" />
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Auteur de prédilection</p>
                   <p className="text-2xl font-headline italic">{profile.favoriteAuthor}</p>
                 </div>
               </div>
             )}
          </Card>
        </div>
      </section>

      <section className="space-y-16 pt-8">
        <div className="space-y-8">
          <h2 className="text-4xl font-headline flex items-center gap-4 italic">
            <Award className="h-8 w-8 text-primary/40" /> Badges de Genres
          </h2>
          {earnedBadges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {earnedBadges.map(({ genre, count }) => {
                const getLevel = (c: number) => {
                  if (c >= 50) return LEVELS[3];
                  if (c >= 30) return LEVELS[2];
                  if (c >= 15) return LEVELS[1];
                  if (c >= 5) return LEVELS[0];
                  return null;
                };
                const level = getLevel(count);
                const nextGoal = count < 5 ? 5 : count < 15 ? 15 : count < 30 ? 30 : 50;
                const progress = Math.min(100, (count / nextGoal) * 100);
                return (
                  <Card key={genre} className="glass-card border-none bg-white/40 hover:shadow-2xl transition-all duration-700 overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className={cn("p-4 rounded-[1.5rem] shadow-sm", level?.bg)}>
                          <Shield className={cn("h-8 w-8", level?.color)} />
                        </div>
                        <Badge variant="outline" className={cn("rounded-full border-none font-bold tracking-widest uppercase text-[10px] px-4 py-1.5", level?.bg, level?.color)}>
                          {level?.label}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-headline italic">{genre}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{count} pépites lues</p>
                      </div>
                      <div className="space-y-3">
                        <Progress value={progress} className="h-1.5 bg-primary/5" />
                        <p className="text-[8px] font-bold uppercase tracking-tighter opacity-40">Vers le palier {nextGoal}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center glass-card bg-white/20 border-dashed border-primary/20 p-12">
              <p className="italic text-muted-foreground text-xl">Continuez vos lectures pour débloquer vos premières récompenses.</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <h2 className="text-4xl font-headline flex items-center gap-4 italic">
            <MedalIcon className="h-8 w-8 text-secondary/40" /> Médailles de Tropes
          </h2>
          {earnedMedals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {earnedMedals.map(({ trope, count }) => {
                const getLevel = (c: number) => {
                  if (c >= 50) return LEVELS[3];
                  if (c >= 30) return LEVELS[2];
                  if (c >= 15) return LEVELS[1];
                  if (c >= 5) return LEVELS[0];
                  return null;
                };
                const level = getLevel(count);
                const nextGoal = count < 5 ? 5 : count < 15 ? 15 : count < 30 ? 30 : 50;
                const progress = Math.min(100, (count / nextGoal) * 100);
                return (
                  <Card key={trope} className="glass-card border-none bg-white/40 hover:shadow-2xl transition-all duration-700 overflow-hidden">
                    <CardContent className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className={cn("p-4 rounded-[1.5rem] shadow-sm", level?.bg)}>
                          <MedalIcon className={cn("h-8 w-8", level?.color)} />
                        </div>
                        <Badge variant="outline" className={cn("rounded-full border-none font-bold tracking-widest uppercase text-[10px] px-4 py-1.5", level?.bg, level?.color)}>
                          {level?.label}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-headline italic">{trope}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{count} pépites lues</p>
                      </div>
                      <div className="space-y-3">
                        <Progress value={progress} className="h-1.5 bg-secondary/5" />
                        <p className="text-[8px] font-bold uppercase tracking-tighter opacity-40">Vers le palier {nextGoal}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center glass-card bg-white/20 border-dashed border-secondary/20 p-12">
              <p className="italic text-muted-foreground text-xl">Continuez vos lectures pour débloquer vos premières médailles.</p>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-center pt-10">
        <Button asChild variant="ghost" className="rounded-full h-16 px-12 italic font-headline text-2xl text-primary/60 hover:text-primary transition-all group">
          <Link href="/library" className="flex items-center">Accéder à ma bibliothèque complète <BookOpen className="ml-4 h-6 w-6 group-hover:scale-110 transition-transform" /></Link>
        </Button>
      </div>
    </div>
  );
}

function EditProfileDialog({ profile }: { profile: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States pour les champs
  const [name, setName] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteQuote, setFavoriteQuote] = useState('');
  const [favoriteAuthor, setFavoriteAuthor] = useState('');
  const [preferredFormat, setPreferredFormat] = useState<string>('papier');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // Objectifs
  const [annualGoal, setAnnualGoal] = useState(24);
  const [monthlyGoal, setMonthlyGoal] = useState(2);
  const [annualGoalPages, setAnnualGoalPages] = useState(10000);
  const [annualAudioGoal, setAnnualAudioGoal] = useState(100);
  
  // Thématiques
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [favoriteTropes, setFavoriteTropes] = useState<string[]>([]);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPseudo(profile.pseudo || '');
      setBio(profile.bio || '');
      setFavoriteQuote(profile.favoriteQuote || '');
      setFavoriteAuthor(profile.favoriteAuthor || '');
      setPreferredFormat(profile.preferredFormat || 'papier');
      setAnnualGoal(profile.annualGoal || 24);
      setMonthlyGoal(profile.monthlyGoal || 2);
      setAnnualGoalPages(profile.annualGoalPages || 10000);
      setAnnualAudioGoal(profile.annualAudioGoal || 100);
      setFavoriteGenres(profile.favoriteGenres || []);
      setFavoriteTropes(profile.favoriteTropes || []);
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile, open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;
    setUploading(true);
    const storageRef = ref(storage, `avatars/${user.uid}/modal-${Date.now()}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setAvatarUrl(url);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erreur Image', description: "Impossible d'importer la photo." });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!db || !user) return;
    setLoading(true);
    
    const updatedData = {
      name: name.trim(),
      pseudo: pseudo.trim().toLowerCase(),
      bio: bio.trim(),
      favoriteQuote: favoriteQuote.trim(),
      favoriteAuthor: favoriteAuthor.trim(),
      preferredFormat,
      avatarUrl,
      annualGoal: Number(annualGoal),
      monthlyGoal: Number(monthlyGoal),
      annualGoalPages: Number(annualGoalPages),
      annualAudioGoal: Number(annualAudioGoal),
      favoriteGenres,
      favoriteTropes,
      lastUpdated: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
      toast({ title: 'Sanctuaire mis à jour', description: 'Vos préférences ont été gravées.' });
      setOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder votre identité.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-16 px-12 rounded-[2rem] bg-primary hover:bg-primary/90 text-white font-headline italic text-2xl shadow-2xl shadow-primary/20 transition-transform active:scale-95">
          <Pencil className="h-6 w-6 mr-4" /> Modifier le Profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card border-none flex flex-col p-0 overflow-hidden bg-white/95 backdrop-blur-3xl shadow-2xl">
        <DialogHeader className="p-10 border-b border-primary/5 bg-white/40">
          <DialogTitle className="font-headline text-4xl italic">Mon Identité Plume</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-10 space-y-16 pb-20">
            {/* Identity & Photo Section */}
            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 border-b border-primary/5 pb-4">Informations Personnelles</h3>
              <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
                <div className="relative group shrink-0">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                    <AvatarImage src={avatarUrl || `https://picsum.photos/seed/${user?.uid}/200/200`} className="object-cover" />
                    <AvatarFallback className="font-headline italic text-2xl">PL</AvatarFallback>
                  </Avatar>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Prénom / Nom</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="h-14 rounded-2xl bg-white/40 border-none italic text-lg shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Pseudo</Label>
                    <Input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="plume_voyageuse" className="h-14 rounded-2xl bg-white/40 border-none italic text-lg shadow-inner" />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Email (Lecture seule)</Label>
                    <Input value={user?.email || ''} readOnly className="h-14 rounded-2xl bg-primary/5 border-none italic text-lg opacity-60" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Ma Bio de Lectrice</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Décrivez votre univers de lecture en quelques mots..." className="min-h-[120px] rounded-[2rem] bg-white/40 border-none italic p-6 text-lg shadow-inner resize-none" />
              </div>
            </div>

            {/* University & Preferences Section */}
            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 border-b border-primary/5 pb-4">Mon Univers Littéraire</h3>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Citation Favorite</Label>
                  <Textarea value={favoriteQuote} onChange={(e) => setFavoriteQuote(e.target.value)} placeholder="Une phrase gravée dans votre mémoire..." className="min-h-[100px] rounded-2xl bg-white/40 border-none italic p-4 text-sm shadow-inner resize-none" />
                </div>
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Auteur de Prédilection</Label>
                    <Input value={favoriteAuthor} onChange={(e) => setFavoriteAuthor(e.target.value)} className="h-14 rounded-2xl bg-white/40 border-none italic text-lg shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 ml-1">Format de Lecture Favori</Label>
                    <Select value={preferredFormat} onValueChange={setPreferredFormat}>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/40 border-none italic text-lg shadow-inner">
                        <SelectValue placeholder="Choisir un format" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-none">
                        {Object.entries(FORMATS).map(([key, val]) => (
                          <SelectItem key={key} value={key} className="italic font-headline text-lg rounded-xl">{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Goals Section */}
            <div className="space-y-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 border-b border-primary/5 pb-4">Mes Défis</h3>
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Livres / An : <span className="text-primary italic text-lg ml-2">{annualGoal}</span></Label>
                  <Slider value={[annualGoal]} min={1} max={500} step={1} onValueChange={(v) => setAnnualGoal(v[0])} />
                </div>
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Livres / Mois : <span className="text-primary italic text-lg ml-2">{monthlyGoal}</span></Label>
                  <Slider value={[monthlyGoal]} min={1} max={100} step={1} onValueChange={(v) => setMonthlyGoal(v[0])} />
                </div>
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Pages / An : <span className="text-primary italic text-lg ml-2">{annualGoalPages.toLocaleString()}</span></Label>
                  <Slider value={[annualGoalPages]} min={100} max={100000} step={100} onValueChange={(v) => setAnnualGoalPages(v[0])} />
                </div>
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Heures Audio / An : <span className="text-primary italic text-lg ml-2">{annualAudioGoal}h</span></Label>
                  <Slider value={[annualAudioGoal]} min={1} max={1000} step={1} onValueChange={(v) => setAnnualAudioGoal(v[0])} />
                </div>
              </div>
            </div>

            {/* Thematics Section */}
            <div className="space-y-12">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <Tags className="h-5 w-5 text-primary" />
                   <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60">Genres de Prédilection</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {GENRES_LIST.map(g => (
                    <div key={g} className="flex items-center space-x-3 bg-white/40 p-4 rounded-2xl hover:bg-white transition-all cursor-pointer shadow-sm group" onClick={() => toggleItem(favoriteGenres, setFavoriteGenres, g)}>
                      <Checkbox id={`genre-${g}`} checked={favoriteGenres.includes(g)} onCheckedChange={() => {}} className="rounded-full border-primary/20 data-[state=checked]:bg-primary" />
                      <label htmlFor={`genre-${g}`} className="text-sm font-headline italic cursor-pointer group-hover:text-primary transition-colors">
                        {g}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <Sparkles className="h-5 w-5 text-secondary" />
                   <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-secondary-foreground/60">Tropes Fétiches</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {TROPES_LIST.map(t => (
                    <div key={t} className="flex items-center space-x-3 bg-white/40 p-4 rounded-2xl hover:bg-white transition-all cursor-pointer shadow-sm group" onClick={() => toggleItem(favoriteTropes, setFavoriteTropes, t)}>
                      <Checkbox id={`trope-${t}`} checked={favoriteTropes.includes(t)} onCheckedChange={() => {}} className="rounded-full border-secondary/20 data-[state=checked]:bg-secondary" />
                      <label htmlFor={`trope-${t}`} className="text-sm font-headline italic cursor-pointer group-hover:text-secondary-foreground transition-colors">
                        {t}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-10 border-t border-primary/5 bg-white/60">
          <div className="flex w-full justify-end gap-6">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-2xl h-14 px-10 italic font-headline text-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={loading} className="rounded-[2rem] bg-primary hover:bg-primary/90 font-headline italic text-2xl px-16 h-16 shadow-2xl shadow-primary/20 transition-transform active:scale-95">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Graver mes préférences"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
