
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
import { 
  Settings, 
  Share2, 
  Crown, 
  BadgeCheck, 
  FileArchive, 
  Sparkles, 
  Award, 
  Medal, 
  TrendingUp, 
  BookOpen, 
  Clock, 
  DoorOpen, 
  Star, 
  Book as BookIcon, 
  Tablet, 
  Headphones, 
  Timer, 
  Plus, 
  Smartphone, 
  Apple, 
  LogOut,
  Mail,
  Camera,
  Loader2,
  User as UserIcon,
  Pencil,
  BookMarked,
  Tags,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useCollection, useAuth, useStorage } from '@/firebase';
import { doc, collection, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Book, GENRES_LIST, TROPES_LIST, FORMATS, BookFormat } from '@/app/library/page';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const readBooks = allBooks.filter(b => b.status === 'read' || b.status === 'reread');
    const palBooks = allBooks.filter(b => b.status === 'pal');
    const progressBooks = allBooks.filter(b => b.status === 'progress');
    const dnfBooks = allBooks.filter(b => b.status === 'dnf');
    
    const paperCount = allBooks.filter(b => b.format === 'papier' || !b.format).length;
    const ebookCount = allBooks.filter(b => b.format === 'ebook').length;
    const audioCount = allBooks.filter(b => b.format === 'audio').length;

    const pagesRead = readBooks.reduce((acc, b) => acc + (b.pages || 0), 0);
    const listeningHours = readBooks.reduce((acc, b) => acc + (b.format === 'audio' ? (b.duration || 0) : 0), 0);
    
    return {
      readCount: readBooks.length,
      palCount: palBooks.length,
      progressCount: progressBooks.length,
      dnfCount: dnfBooks.length,
      paperCount,
      ebookCount,
      audioCount,
      pagesRead,
      listeningHours
    };
  }, [books]);

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
  
  const annualGoal = profile?.annualGoal || 24;
  const annualPageGoal = profile?.annualPageGoal || 10000;
  const annualHourGoal = profile?.annualHourGoal || 100;

  const bookProgressPercent = Math.min(100, Math.round((stats.readCount / annualGoal) * 100));
  const pageProgressPercent = Math.min(100, Math.round((stats.pagesRead / annualPageGoal) * 100));
  const hourProgressPercent = Math.min(100, Math.round((stats.listeningHours / annualHourGoal) * 100));

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
              {profile?.pseudo && (
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                   @{profile.pseudo}
                </div>
              )}
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
                <p className="text-xs text-muted-foreground italic">Installez l'application pour une expérience optimale.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                  <Apple className="h-3 w-3" /> Sur iPhone / iPad
                </div>
                <p className="text-[11px] font-medium leading-relaxed italic text-muted-foreground">Appuyez sur "Partager" puis sur <b>"Sur l'écran d'accueil"</b>.</p>
              </div>
              <div className="p-4 bg-white/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                  <Smartphone className="h-3 w-3" /> Sur Android
                </div>
                <p className="text-[11px] font-medium leading-relaxed italic text-muted-foreground">Appuyez sur les <b>trois points ⋮</b> puis sur <b>"Installer l'application"</b>.</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full rounded-xl text-primary/40" onClick={() => setShowPwaInfo(false)}>Masquer</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        <h2 className="text-3xl font-headline flex items-center gap-3 italic">
          <Target className="h-8 w-8 text-primary/40" /> Objectifs de l'année
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Livres</p>
              <Badge className="bg-primary/10 text-primary border-none text-[10px]">{bookProgressPercent}%</Badge>
            </div>
            <p className="text-2xl font-headline italic">{stats.readCount} / {annualGoal}</p>
            <Progress value={bookProgressPercent} className="h-1.5 bg-primary/5" />
          </Card>
          
          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pages</p>
              <Badge className="bg-emerald-50 text-emerald-600 border-none text-[10px]">{pageProgressPercent}%</Badge>
            </div>
            <p className="text-2xl font-headline italic">{stats.pagesRead.toLocaleString()} / {annualPageGoal.toLocaleString()}</p>
            <Progress value={pageProgressPercent} className="h-1.5 bg-emerald-50" />
          </Card>

          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Heures Audio</p>
              <Badge className="bg-amber-50 text-amber-600 border-none text-[10px]">{hourProgressPercent}%</Badge>
            </div>
            <p className="text-2xl font-headline italic">{Math.round(stats.listeningHours)} / {annualHourGoal}</p>
            <Progress value={hourProgressPercent} className="h-1.5 bg-amber-50" />
          </Card>
        </div>
      </div>

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
              {profile?.preferredGenres?.length ? profile.preferredGenres.map((g: string) => (
                <Badge key={g} className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold tracking-widest px-3 py-1">
                  {g}
                </Badge>
              )) : <p className="italic text-muted-foreground text-sm">Sélectionnez vos genres préférés.</p>}
            </div>
          </Card>
          <Card className="glass-card p-8 border-none bg-white/40">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-secondary" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tropes fétiches</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.preferredTropes?.length ? profile.preferredTropes.map((t: string) => (
                <Badge key={t} className="bg-secondary/20 text-secondary-foreground border-none text-[10px] uppercase font-bold tracking-widest px-3 py-1">
                  {t}
                </Badge>
              )) : <p className="italic text-muted-foreground text-sm">Sélectionnez vos tropes fétiches.</p>}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform bg-white/60">
          <BookOpen className="h-8 w-8 mx-auto text-primary" />
          <p className="text-3xl font-headline italic">{stats.readCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Livres lus</p>
        </Card>
        <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform bg-white/60">
          <Clock className="h-8 w-8 mx-auto text-blue-400" />
          <p className="text-3xl font-headline italic">{stats.progressCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">En cours</p>
        </Card>
        <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform bg-white/60">
          <FileArchive className="h-8 w-8 mx-auto text-emerald-400" />
          <p className="text-3xl font-headline italic">{stats.pagesRead.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pages parcourues</p>
        </Card>
        <Card className="glass-card p-6 border-none text-center space-y-2 hover:scale-105 transition-transform bg-white/60">
          <Timer className="h-8 w-8 mx-auto text-amber-500" />
          <p className="text-3xl font-headline italic">{Math.round(stats.listeningHours)}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Heures audio</p>
        </Card>
      </section>
    </div>
  );
}

function EditProfileDialog({ profile }: { profile: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [pseudo, setPseudo] = useState(profile?.pseudo || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [annualGoal, setAnnualGoal] = useState(profile?.annualGoal || 24);
  const [annualPageGoal, setAnnualPageGoal] = useState(profile?.annualPageGoal || 10000);
  const [annualHourGoal, setAnnualHourGoal] = useState(profile?.annualHourGoal || 100);
  const [format, setFormat] = useState<BookFormat>(profile?.preferredFormat || 'papier');
  const [genres, setGenres] = useState<string[]>(profile?.preferredGenres || []);
  const [tropes, setTropes] = useState<string[]>(profile?.preferredTropes || []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPseudo(profile.pseudo || '');
      setBio(profile.bio || '');
      setAnnualGoal(profile.annualGoal || 24);
      setAnnualPageGoal(profile.annualPageGoal || 10000);
      setAnnualHourGoal(profile.annualHourGoal || 100);
      setFormat(profile.preferredFormat || 'papier');
      setGenres(profile.preferredGenres || []);
      setTropes(profile.preferredTropes || []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!db || !user) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connectée pour enregistrer votre profil.' });
      return;
    }
    
    const updatedData = {
      name: name.trim(),
      pseudo: pseudo.trim(),
      bio: bio.trim(),
      annualGoal: Number(annualGoal),
      annualPageGoal: Number(annualPageGoal),
      annualHourGoal: Number(annualHourGoal),
      preferredFormat: format,
      preferredGenres: genres,
      preferredTropes: tropes,
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
      toast({ title: 'Profil mis à jour', description: 'Vos préférences ont été enregistrées.' });
      setOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder votre profil.' });
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
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Prénom / Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-white/40 border-none italic" placeholder="Votre nom d'affichage" />
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Pseudo Unique</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 font-bold">@</span>
                  <Input value={pseudo} onChange={(e) => setPseudo(e.target.value)} className="h-12 pl-8 rounded-xl bg-white/40 border-none italic" placeholder="lectrice_passionnee" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Bio de Lectrice</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[100px] rounded-2xl bg-white/40 border-none italic p-4" placeholder="Décrivez votre univers littéraire..." />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Livres</Label>
                <Input type="number" value={annualGoal} onChange={(e) => setAnnualGoal(Number(e.target.value))} className="h-12 rounded-xl bg-white/40 border-none italic" />
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Pages</Label>
                <Input type="number" value={annualPageGoal} onChange={(e) => setAnnualPageGoal(Number(e.target.value))} className="h-12 rounded-xl bg-white/40 border-none italic" />
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Objectif Heures Audio</Label>
                <Input type="number" value={annualHourGoal} onChange={(e) => setAnnualHourGoal(Number(e.target.value))} className="h-12 rounded-xl bg-white/40 border-none italic" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Format Préféré</Label>
              <div className="flex gap-2">
                {Object.entries(FORMATS).map(([key, val]) => {
                  const Icon = val.icon;
                  return (
                    <Button 
                      key={key} 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFormat(key as BookFormat)}
                      className={cn(
                        "rounded-xl border-primary/10 h-12 flex-1", 
                        format === key ? "bg-primary text-white border-primary" : "bg-white/40"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" /> {val.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Genres de Prédilection</Label>
              <div className="flex flex-wrap gap-2">
                {GENRES_LIST.map(g => (
                  <button 
                    key={g} 
                    onClick={() => toggleItem(genres, setGenres, g)}
                    className={cn(
                      "text-[10px] px-4 py-2 rounded-full border transition-all uppercase tracking-widest",
                      genres.includes(g) ? "bg-primary text-white border-primary" : "bg-white/50 border-transparent"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Tropes Fétiches</Label>
              <div className="flex flex-wrap gap-2">
                {TROPES_LIST.map(t => (
                  <button 
                    key={t} 
                    onClick={() => toggleItem(tropes, setTropes, t)}
                    className={cn(
                      "text-[10px] px-4 py-2 rounded-full border transition-all uppercase tracking-widest",
                      tropes.includes(t) ? "bg-secondary text-secondary-foreground border-secondary" : "bg-white/50 border-transparent"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 border-t border-primary/5 bg-white/60">
          <div className="flex w-full justify-end gap-4">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl h-12 px-8">Annuler</Button>
            <Button onClick={handleSave} className="rounded-2xl bg-primary hover:bg-primary/90 font-headline italic text-xl px-12 h-14 shadow-xl shadow-primary/20">
              Enregistrer mon Profil
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
