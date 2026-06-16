
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, 
  Crown, 
  Sparkles, 
  Award, 
  Medal, 
  BookOpen, 
  Clock, 
  Star, 
  Headphones, 
  Timer, 
  Plus, 
  Smartphone, 
  Apple, 
  LogOut,
  Mail,
  Camera,
  Loader2,
  Pencil,
  BookMarked,
  Tags,
  Target,
  Shield,
  Lock,
  Calendar,
  FileText
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
  
  const [showPwaInfo, setShowPwaInfo] = useState(false);
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
      pages: profile?.annualPageGoal || 10000,
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
      console.error('PLUME Auth: Erreur de déconnexion', error);
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
  const userSeed = user?.uid || user?.email || "plume-user";
  const userPhoto = profile?.avatarUrl || user?.photoURL || `https://picsum.photos/seed/${userSeed}/200/200`;

  if (profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="font-headline italic text-primary/60">Chargement de votre sanctuaire...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center pt-8 gap-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl overflow-hidden">
              <AvatarImage src={userPhoto} className="object-cover" />
              <AvatarFallback className="bg-primary/5 text-primary text-2xl font-headline italic">PL</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-2 border-2 border-white shadow-md">
              <Crown className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-headline italic tracking-tight">{userName}</h1>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground italic text-sm">
                <Mail className="h-3 w-3" /> {user?.email}
              </div>
            </div>
            <p className="text-muted-foreground italic text-sm mt-3 max-w-md">
              {profile?.bio || "“Perdue entre deux chapitres.”"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
            <EditProfileDialog profile={profile} />
            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/10 hover:bg-primary/5" onClick={() => setShowPwaInfo(!showPwaInfo)}>
                <Smartphone className="h-5 w-5 text-primary" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-primary/10 hover:bg-primary/5" onClick={handleLogout}>
                <LogOut className="h-5 w-5 text-destructive" />
            </Button>
        </div>
      </header>

      {showPwaInfo && (
        <Card className="glass-card bg-primary/5 border-primary/20 animate-paper">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-headline italic text-xl">Plume sur votre écran</h3>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                  <Apple className="h-3 w-3" /> iOS
                </div>
                <p className="text-[11px] font-medium italic text-muted-foreground">"Partager" > "Sur l'écran d'accueil".</p>
              </div>
              <div className="p-4 bg-white/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                  <Smartphone className="h-3 w-3" /> Android
                </div>
                <p className="text-[11px] font-medium italic text-muted-foreground">Menu ⋮ > "Installer l'application".</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-8">
        <h2 className="text-3xl font-headline flex items-center gap-3 italic">
          <Target className="h-8 w-8 text-primary/40" /> Mes Objectifs de Lecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Annuel</p>
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-headline italic">{stats.readCount} / {stats.goals.annual}</p>
            <div className="space-y-2">
              <Progress value={stats.annualProgress} className="h-1.5 bg-primary/5" />
              <p className="text-[9px] font-bold text-primary/60">{stats.annualProgress}% complété</p>
            </div>
          </Card>
          
          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Mensuel</p>
              <Calendar className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-headline italic">{stats.monthlyCount} / {stats.goals.monthly}</p>
            <div className="space-y-2">
              <Progress value={stats.monthlyProgress} className="h-1.5 bg-blue-50" />
              <p className="text-[9px] font-bold text-blue-400/60">{stats.monthlyProgress}% ce mois</p>
            </div>
          </Card>

          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pages</p>
              <FileText className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-headline italic">{stats.pagesRead.toLocaleString()} / {stats.goals.pages.toLocaleString()}</p>
            <div className="space-y-2">
              <Progress value={stats.pagesProgress} className="h-1.5 bg-emerald-50" />
              <p className="text-[9px] font-bold text-emerald-600/60">{stats.pagesProgress}% atteint</p>
            </div>
          </Card>

          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Heures Audio</p>
              <Headphones className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-2xl font-headline italic">{stats.audioHours} / {stats.goals.audio}</p>
            <div className="space-y-2">
              <Progress value={stats.audioProgress} className="h-1.5 bg-purple-50" />
              <p className="text-[9px] font-bold text-purple-400/60">{stats.audioProgress}% d'écoute</p>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="text-3xl font-headline flex items-center gap-3 italic">
          <BookMarked className="h-8 w-8 text-primary/40" /> Thématiques de Cœur
        </h2>
        <div className="grid sm:grid-cols-2 gap-8">
          <Card className="glass-card p-8 border-none bg-white/40">
            <div className="flex items-center gap-3 mb-4">
              <Tags className="h-5 w-5 text-primary/40" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Genres favoris</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.favoriteGenres?.length ? profile.favoriteGenres.map((g: string) => (
                <Badge key={g} className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold tracking-widest px-3 py-1">
                  {g}
                </Badge>
              )) : <p className="italic text-muted-foreground text-sm">Non défini.</p>}
            </div>
          </Card>
          <Card className="glass-card p-8 border-none bg-white/40">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-secondary" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tropes fétiches</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.favoriteTropes?.length ? profile.favoriteTropes.map((t: string) => (
                <Badge key={t} className="bg-secondary/20 text-secondary-foreground border-none text-[10px] uppercase font-bold tracking-widest px-3 py-1">
                  {t}
                </Badge>
              )) : <p className="italic text-muted-foreground text-sm">Non défini.</p>}
            </div>
          </Card>
        </div>
      </section>

      <div className="flex justify-center">
        <Button asChild variant="ghost" className="rounded-full h-14 px-10 italic font-headline text-xl text-primary/60 hover:text-primary">
          <Link href="/library">Accéder à ma bibliothèque complète <BookOpen className="ml-3 h-5 w-5" /></Link>
        </Button>
      </div>
    </div>
  );
}

function EditProfileDialog({ profile }: { profile: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [annualGoal, setAnnualGoal] = useState(profile?.annualGoal || 24);
  const [monthlyGoal, setMonthlyGoal] = useState(profile?.monthlyGoal || 2);
  const [annualPageGoal, setAnnualPageGoal] = useState(profile?.annualPageGoal || 10000);
  const [annualAudioGoal, setAnnualAudioGoal] = useState(profile?.annualAudioGoal || 100);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(profile?.favoriteGenres || []);
  const [favoriteTropes, setFavoriteTropes] = useState<string[]>(profile?.favoriteTropes || []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setBio(profile.bio || '');
      setAnnualGoal(profile.annualGoal || 24);
      setMonthlyGoal(profile.monthlyGoal || 2);
      setAnnualPageGoal(profile.annualPageGoal || 10000);
      setAnnualAudioGoal(profile.annualAudioGoal || 100);
      setFavoriteGenres(profile.favoriteGenres || []);
      setFavoriteTropes(profile.favoriteTropes || []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!db || !user) return;
    
    const updatedData = {
      name: name.trim(),
      bio: bio.trim(),
      annualGoal: Number(annualGoal),
      monthlyGoal: Number(monthlyGoal),
      annualPageGoal: Number(annualPageGoal),
      annualAudioGoal: Number(annualAudioGoal),
      favoriteGenres: favoriteGenres,
      favoriteTropes: favoriteTropes,
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
      toast({ title: 'Profil mis à jour', description: 'Vos préférences ont été enregistrées.' });
      setOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Sauvegarde impossible.' });
    }
  };

  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 rounded-full border-primary/10 hover:bg-primary/5 px-6 font-headline italic">
          <Pencil className="h-4 w-4 mr-2" /> Modifier le Profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card border-none flex flex-col p-0 overflow-hidden bg-background/98">
        <DialogHeader className="p-8 border-b border-primary/5 bg-white/40">
          <DialogTitle className="font-headline text-3xl italic">Mon Identité Plume</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-8 space-y-12">
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Prénom / Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-white/40 border-none italic" />
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Bio de Lectrice</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[100px] rounded-2xl bg-white/40 border-none italic p-4" />
            </div>

            <div className="space-y-10 border-t border-primary/5 pt-8">
              <h3 className="font-headline italic text-2xl flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" /> Mes Objectifs
              </h3>
              
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Annuel : {annualGoal} livres</Label>
                  </div>
                  <Slider 
                    value={[annualGoal]} 
                    min={1} 
                    max={500} 
                    step={1} 
                    onValueChange={(v) => setAnnualGoal(v[0])}
                    className="py-4"
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Mensuel : {monthlyGoal} livres</Label>
                  </div>
                  <Slider 
                    value={[monthlyGoal]} 
                    min={1} 
                    max={100} 
                    step={1} 
                    onValueChange={(v) => setMonthlyGoal(v[0])}
                    className="py-4"
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Pages : {annualPageGoal.toLocaleString()}</Label>
                  </div>
                  <Slider 
                    value={[annualPageGoal]} 
                    min={100} 
                    max={100000} 
                    step={100} 
                    onValueChange={(v) => setAnnualPageGoal(v[0])}
                    className="py-4"
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Audio : {annualAudioGoal} heures</Label>
                  </div>
                  <Slider 
                    value={[annualAudioGoal]} 
                    min={1} 
                    max={1000} 
                    step={1} 
                    onValueChange={(v) => setAnnualAudioGoal(v[0])}
                    className="py-4"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 border-t border-primary/5 pt-8">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 italic">Genres favoris</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {GENRES_LIST.map(g => (
                  <div key={g} className="flex items-center space-x-3 bg-white/40 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer" onClick={() => toggleItem(favoriteGenres, setFavoriteGenres, g)}>
                    <Checkbox id={`genre-${g}`} checked={favoriteGenres.includes(g)} onCheckedChange={() => toggleItem(favoriteGenres, setFavoriteGenres, g)} />
                    <label htmlFor={`genre-${g}`} className="text-sm font-medium leading-none cursor-pointer">
                      {g}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 italic">Tropes fétiches</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {TROPES_LIST.map(t => (
                  <div key={t} className="flex items-center space-x-3 bg-white/40 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer" onClick={() => toggleItem(favoriteTropes, setFavoriteTropes, t)}>
                    <Checkbox id={`trope-${t}`} checked={favoriteTropes.includes(t)} onCheckedChange={() => toggleItem(favoriteTropes, setFavoriteTropes, t)} />
                    <label htmlFor={`trope-${t}`} className="text-sm font-medium leading-none cursor-pointer">
                      {t}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 border-t border-primary/5 bg-white/60">
          <div className="flex w-full justify-end gap-4">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl h-12 px-8">Annuler</Button>
            <Button onClick={handleSave} className="rounded-2xl bg-primary hover:bg-primary/90 font-headline italic text-xl px-12 h-14 shadow-xl shadow-primary/20">
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
