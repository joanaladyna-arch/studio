
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Heart, 
  Trash2, 
  Save, 
  Star, 
  Quote, 
  MessageSquare, 
  PersonStanding, 
  MapPin, 
  Loader2,
  CheckCircle2,
  Globe,
  Tag,
  Hash,
  Layers,
  Clock,
  User as UserIcon,
  ChevronRight,
  Bookmark,
  Book as BookIcon,
  Smartphone,
  Tablet,
  Headphones
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Book, 
  STATUSES, 
  FORMATS, 
  RANKS, 
  BookStatus, 
  BookFormat, 
  RankType,
  GENRES_LIST,
  TROPES_LIST
} from "@/app/library/page";

const LANGUAGE_MAP: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Español",
  de: "Allemand",
  it: "Italien",
  pt: "Portugais",
  nl: "Néerlandais",
  ja: "Japonais",
  ko: "Coréen",
  zh: "Chinois",
};

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const bookRef = useMemo(() => {
    if (!db || !user || !bookId) return null;
    return doc(db, "users", user.uid, "books", bookId);
  }, [db, user, bookId]);

  const { data: book, loading: bookLoading } = useDoc(bookRef);

  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [editedData, setEditedData] = useState<Partial<Book>>({});

  useEffect(() => {
    if (book) {
      setEditedData(book as Book);
    }
  }, [book]);

  const handleSave = async () => {
    if (!bookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(bookRef, {
        ...editedData,
        lastUpdated: serverTimestamp()
      });
      toast({ title: "Sanctuaire mis à jour", description: "Vos modifications ont été gravées." });
    } catch (e) {
      console.error("PLUME Firestore Error:", e);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bookRef) return;
    if (!confirm("Voulez-vous vraiment retirer cette pépite ?")) return;
    try {
      await deleteDoc(bookRef);
      router.push("/library");
      toast({ title: "Pépite retirée", description: "L'œuvre a quitté votre collection." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Suppression impossible." });
    }
  };

  const enrichMetadata = async () => {
    if (!editedData.title || !editedData.author) return;
    setIsEnriching(true);
    
    try {
      const searchStr = editedData.isbn && editedData.isbn !== "N/A" ? editedData.isbn : `${editedData.title} ${editedData.author}`;
      const gResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchStr)}&maxResults=1`);
      const gData = await gResponse.json();

      if (gData.items?.[0]) {
        const info = gData.items[0].volumeInfo;
        const updates: Partial<Book> = {};
        
        if (!editedData.publisher) updates.publisher = info.publisher;
        if (!editedData.pages && info.pageCount > 0 && info.pageCount < 3000) updates.pages = info.pageCount;
        if (!editedData.description) updates.description = info.description;
        if (!editedData.publicationDate) updates.publicationDate = info.publishedDate;
        if (!editedData.cover) updates.cover = info.imageLinks?.thumbnail?.replace("http://", "https://");
        if (!editedData.genres || editedData.genres.length === 0) updates.genres = info.categories;
        if (!editedData.language && info.language) updates.language = LANGUAGE_MAP[info.language.toLowerCase()] || info.language.toUpperCase();
        if (!editedData.isbn || editedData.isbn === "N/A") {
          updates.isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.[0]?.identifier;
        }

        setEditedData(prev => ({ ...prev, ...updates }));
        toast({ title: "Pépite enrichie", description: "Les métadonnées ont été fusionnées." });
      } else {
        toast({ variant: "destructive", title: "Information", description: "Aucune donnée supplémentaire trouvée." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Service indisponible." });
    } finally {
      setIsEnriching(false);
    }
  };

  const toggleTag = (field: "genres" | "tropes" | "themes", value: string) => {
    const current = editedData[field] || [];
    if (current.includes(value)) {
      setEditedData({ ...editedData, [field]: current.filter(v => v !== value) });
    } else {
      setEditedData({ ...editedData, [field]: [...current, value] });
    }
  };

  if (bookLoading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
      <p className="font-headline italic text-primary/60 text-2xl">Ouverture de votre écrin...</p>
    </div>
  );

  if (!book) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
      <p className="font-headline italic text-primary/60 text-3xl">Cette pépite n'existe plus.</p>
      <Button asChild variant="outline" className="rounded-2xl border-primary/20 h-14 px-10"><Link href="/library">Retourner au sanctuaire</Link></Button>
    </div>
  );

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-7xl mx-auto px-4">
      <header className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-6">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary text-lg font-headline italic">
          <Link href="/library"><ArrowLeft className="h-5 w-5 mr-3" /> Ma Bibliothèque</Link>
        </Button>
        <div className="flex gap-4 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={enrichMetadata} 
            disabled={isEnriching}
            className="rounded-2xl border-primary/10 hover:bg-white italic h-14 px-8 shadow-sm"
          >
            {isEnriching ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Globe className="h-5 w-5 mr-3" />}
            Enrichir la pépite
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="rounded-2xl bg-primary hover:bg-primary/90 h-14 px-10 shadow-xl shadow-primary/10 font-headline italic text-xl"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Save className="h-5 w-5 mr-3" />}
            Graver les modifications
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[400px_1fr] gap-16 items-start">
        {/* Sidebar: Media & Quick Status */}
        <div className="space-y-10 flex flex-col items-center lg:items-start">
          <div className="relative w-full max-w-[240px] aspect-[2/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5 group">
             <Image 
               src={editedData.cover || "https://picsum.photos/seed/placeholder/600/900"} 
               alt={editedData.title || ""} 
               fill 
               className="object-contain transition-transform duration-1000 group-hover:scale-105"
               priority
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <Card className="glass-card p-10 border-none bg-white/60 space-y-10 w-full shadow-sm">
            <div className="space-y-5">
              <Label className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50">Statut Actuel</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUSES).map(([key, val]) => (
                  <Button 
                    key={key} 
                    variant="outline" 
                    onClick={() => setEditedData({ ...editedData, status: key as BookStatus })}
                    className={cn(
                      "rounded-full border-primary/5 text-[9px] h-9 px-4 uppercase font-bold tracking-widest transition-all", 
                      editedData.status === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/40 hover:bg-white"
                    )}
                  >
                    {val.label}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-5">
              <Label className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50">Format choisi</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(FORMATS).map(([key, val]) => {
                  const Icon = val.icon;
                  return (
                    <Button 
                      key={key} 
                      variant="outline" 
                      onClick={() => setEditedData({ ...editedData, format: key as BookFormat })}
                      className={cn(
                        "rounded-xl border-primary/5 h-12 flex items-center justify-start px-4 gap-3 transition-all", 
                        editedData.format === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/40 hover:bg-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-headline italic">{val.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-primary/5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-headline italic">De Plume</span>
                <p className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Favori absolu</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setEditedData({ ...editedData, dePlume: !editedData.dePlume })}
                className={cn("rounded-full h-12 w-12 transition-all", editedData.dePlume ? "text-primary bg-primary/10 shadow-inner" : "text-muted-foreground/20")}
              >
                <Heart className={cn("h-6 w-6", editedData.dePlume && "fill-primary")} />
              </Button>
            </div>
          </Card>

          <Button 
            variant="ghost" 
            onClick={handleDelete} 
            className="w-full text-destructive hover:bg-destructive/5 rounded-2xl h-14 italic font-headline text-lg group transition-all"
          >
            <Trash2 className="h-5 w-5 mr-3 group-hover:animate-bounce" /> Retirer du sanctuaire
          </Button>
        </div>

        {/* Main Content: Info, Journal, Series */}
        <div className="space-y-16">
          <section className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-6xl sm:text-7xl font-headline italic tracking-tight leading-[1.1]">{editedData.title || "Titre Inconnu"}</h1>
              {editedData.subtitle && <p className="text-2xl font-headline italic text-primary/60 opacity-80">{editedData.subtitle}</p>}
              <Link 
                href={`/author/${encodeURIComponent(editedData.author || "")}`}
                className="inline-flex items-center gap-3 text-3xl text-primary font-bold uppercase tracking-[0.3em] hover:opacity-70 transition-all group"
              >
                {editedData.author || "Auteur Inconnu"}
                <ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-4">
               {editedData.rank && (
                 <Badge className={cn("rounded-full px-8 py-3 font-headline italic text-lg shadow-xl border-none transition-all hover:scale-105", RANKS[editedData.rank].color, "bg-white/80")}>
                    <Sparkles className="h-5 w-5 mr-3" /> {RANKS[editedData.rank].label}
                 </Badge>
               )}
               {editedData.series && (
                 <Badge variant="outline" className="rounded-full px-8 py-3 text-sm font-headline italic bg-white/40 border-primary/10 text-primary/80">
                   {editedData.series} #{editedData.volume}
                 </Badge>
               )}
            </div>
          </section>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-primary/5 px-0 gap-12 h-16 justify-start rounded-none mb-12 overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary px-0 font-headline italic text-2xl whitespace-nowrap transition-all opacity-40 data-[state=active]:opacity-100 pb-4">L'Œuvre</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary px-0 font-headline italic text-2xl whitespace-nowrap transition-all opacity-40 data-[state=active]:opacity-100 pb-4">Mon Journal</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary px-0 font-headline italic text-2xl whitespace-nowrap transition-all opacity-40 data-[state=active]:opacity-100 pb-4">Paramètres</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="m-0 space-y-16 animate-paper">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">
                 <div className="flex flex-col gap-2"><div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary/40" /> Pages</div><span className="text-lg italic font-headline text-foreground">{editedData.pages || "Inconnu"}</span></div>
                 <div className="flex flex-col gap-2"><div className="flex items-center gap-3"><CalendarIcon className="h-5 w-5 text-primary/40" /> Parution</div><span className="text-lg italic font-headline text-foreground">{editedData.publicationDate || "Inconnue"}</span></div>
                 <div className="flex flex-col gap-2"><div className="flex items-center gap-3"><Hash className="h-5 w-5 text-primary/40" /> ISBN</div><span className="text-lg italic font-headline text-foreground">{editedData.isbn || "N/A"}</span></div>
                 <div className="flex flex-col gap-2"><div className="flex items-center gap-3"><Globe className="h-5 w-5 text-primary/40" /> Éditeur</div><span className="text-lg italic font-headline text-foreground truncate">{editedData.publisher || "Inconnu"}</span></div>
               </div>

               <div className="space-y-8">
                 <h3 className="font-headline italic text-4xl flex items-center gap-4">
                   <Bookmark className="h-8 w-8 text-primary/40" /> Résumé
                 </h3>
                 <div className="relative p-10 rounded-[3rem] bg-white/40 shadow-inner border border-white/60">
                    <ScrollArea className="h-auto max-h-[500px] pr-8">
                       <p className="text-muted-foreground italic text-xl leading-relaxed whitespace-pre-wrap">
                         {editedData.description?.replace(/<[^>]*>?/gm, '') || "Aucun résumé n'a encore été capturé pour cette pépite."}
                       </p>
                    </ScrollArea>
                 </div>
               </div>

               <div className="grid md:grid-cols-2 gap-16">
                  <div className="space-y-8">
                    <h3 className="font-headline italic text-3xl flex items-center gap-3"><Tag className="h-6 w-6 text-primary/40" /> Thématiques & Tropes</h3>
                    <div className="flex flex-wrap gap-2">
                      {editedData.genres?.map(g => (
                        <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full">
                          {g}
                        </Badge>
                      ))}
                      {editedData.tropes?.map(t => (
                        <Badge key={t} variant="secondary" className="bg-secondary/20 text-secondary-foreground border-none text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full">
                          {t}
                        </Badge>
                      ))}
                      {editedData.themes?.map(th => (
                        <Badge key={th} variant="outline" className="border-primary/10 text-primary/60 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full">
                          {th}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <h3 className="font-headline italic text-3xl flex items-center gap-3"><Clock className="h-6 w-6 text-secondary" /> Chronologie</h3>
                    <div className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 space-y-4 shadow-sm">
                       <div className="flex justify-between items-center italic text-sm">
                         <span className="opacity-60">Ajouté le</span>
                         <span className="font-bold">{editedData.dateAdded ? format(editedData.dateAdded.toDate(), "PPP", { locale: fr }) : "Maintenant"}</span>
                       </div>
                       {editedData.startDate && (
                         <div className="flex justify-between items-center italic text-sm">
                           <span className="opacity-60">Débuté le</span>
                           <span className="font-bold">{format(new Date(editedData.startDate), "PPP", { locale: fr })}</span>
                         </div>
                       )}
                       {editedData.endDate && (
                         <div className="flex justify-between items-center italic text-sm">
                           <span className="opacity-60">Terminé le</span>
                           <span className="font-bold text-emerald-600">{format(new Date(editedData.endDate), "PPP", { locale: fr })}</span>
                         </div>
                       )}
                    </div>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 space-y-16 animate-paper">
               <div className="grid sm:grid-cols-2 gap-10">
                  <div className="space-y-5">
                    <Label className="flex items-center gap-3 italic text-lg opacity-60"><CalendarIcon className="h-5 w-5" /> Date de début</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-2xl border-none bg-white/40 h-16 italic text-xl shadow-sm hover:bg-white", !editedData.startDate && "text-muted-foreground")}>
                          {editedData.startDate ? format(new Date(editedData.startDate), "PPP", { locale: fr }) : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 glass-card">
                        <Calendar 
                          mode="single" 
                          selected={editedData.startDate ? new Date(editedData.startDate) : undefined} 
                          onSelect={(d) => setEditedData({ ...editedData, startDate: d ? format(d, "yyyy-MM-dd") : undefined })} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-5">
                    <Label className="flex items-center gap-3 italic text-lg opacity-60"><CheckCircle2 className="h-5 w-5" /> Date de fin</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-2xl border-none bg-white/40 h-16 italic text-xl shadow-sm hover:bg-white", !editedData.endDate && "text-muted-foreground")}>
                          {editedData.endDate ? format(new Date(editedData.endDate), "PPP", { locale: fr }) : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 glass-card">
                        <Calendar 
                          mode="single" 
                          selected={editedData.endDate ? new Date(editedData.endDate) : undefined} 
                          onSelect={(d) => setEditedData({ ...editedData, endDate: d ? format(d, "yyyy-MM-dd") : undefined })} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
               </div>

               <div className="space-y-8">
                 <Label className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-60">Note de la Pépite</Label>
                 <div className="flex gap-6">
                   {[1, 2, 3, 4, 5].map((s) => (
                     <Star 
                       key={s} 
                       onClick={() => setEditedData({ ...editedData, rating: s })}
                       className={cn("h-14 w-14 cursor-pointer transition-all hover:scale-125", s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/10")} 
                     />
                   ))}
                 </div>
               </div>

               <div className="space-y-12">
                 <div className="space-y-5">
                   <Label className="flex items-center gap-3 italic text-3xl font-headline"><MessageSquare className="h-6 w-6 text-primary/40" /> Mon avis personnel</Label>
                   <Textarea 
                      value={editedData.review || ""} 
                      onChange={(e) => setEditedData({ ...editedData, review: e.target.value })}
                      placeholder="Quels souvenirs cette lecture a-t-elle gravés ?"
                      className="min-h-[250px] bg-white/40 border-none rounded-[3rem] p-10 italic text-xl shadow-inner focus-visible:ring-primary/20 resize-none"
                   />
                 </div>

                 <div className="space-y-5">
                   <Label className="flex items-center gap-3 italic text-3xl font-headline"><Quote className="h-6 w-6 text-primary/40" /> Citation fétiche</Label>
                   <Textarea 
                      value={editedData.favoriteQuote || ""} 
                      onChange={(e) => setEditedData({ ...editedData, favoriteQuote: e.target.value })}
                      placeholder="Une phrase qui ne quittera plus votre esprit..."
                      className="min-h-[120px] bg-white/40 border-none rounded-3xl p-10 italic border-l-8 border-primary/20 shadow-sm resize-none text-xl"
                   />
                 </div>

                 <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-5">
                      <Label className="flex items-center gap-3 italic opacity-60 text-lg"><PersonStanding className="h-5 w-5" /> Personnages favoris</Label>
                      <Input 
                        value={editedData.favoriteCharacters || ""} 
                        onChange={(e) => setEditedData({ ...editedData, favoriteCharacters: e.target.value })}
                        className="h-16 bg-white/40 border-none rounded-2xl italic text-xl shadow-sm hover:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-5">
                      <Label className="flex items-center gap-3 italic opacity-60 text-lg"><MapPin className="h-5 w-5" /> Scène marquante</Label>
                      <Input 
                        value={editedData.memorableScene || ""} 
                        onChange={(e) => setEditedData({ ...editedData, memorableScene: e.target.value })}
                        className="h-16 bg-white/40 border-none rounded-2xl italic text-xl shadow-sm hover:bg-white transition-all"
                      />
                    </div>
                 </div>
               </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0 space-y-16 animate-paper">
               <div className="grid md:grid-cols-2 gap-16">
                  <div className="space-y-10">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] opacity-60">Bibliothèque & Édition</h3>
                    <div className="space-y-6">
                       <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Titre précis</Label>
                         <Input value={editedData.title || ""} onChange={(e) => setEditedData({ ...editedData, title: e.target.value })} className="bg-white/40 border-none h-14 rounded-xl italic text-lg" />
                       </div>
                       <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Auteur</Label>
                         <Input value={editedData.author || ""} onChange={(e) => setEditedData({ ...editedData, author: e.target.value })} className="bg-white/40 border-none h-14 rounded-xl italic text-lg" />
                       </div>
                       <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Éditeur</Label>
                         <Input value={editedData.publisher || ""} onChange={(e) => setEditedData({ ...editedData, publisher: e.target.value })} className="bg-white/40 border-none h-14 rounded-xl italic text-lg" />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] opacity-60">Saga & Classement</h3>
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-3">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Série</Label>
                           <Input value={editedData.series || ""} onChange={(e) => setEditedData({ ...editedData, series: e.target.value })} className="bg-white/40 border-none h-14 rounded-xl italic text-lg" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tome n°</Label>
                            <Input value={editedData.volume || ""} onChange={(e) => setEditedData({ ...editedData, volume: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                         </div>
                       </div>
                       <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Grade de Prestige</Label>
                         <select 
                            value={editedData.rank || ""} 
                            onChange={(e) => setEditedData({ ...editedData, rank: e.target.value as RankType })}
                            className="w-full h-14 rounded-xl bg-white/40 border-none px-6 italic text-lg focus:ring-primary/20 transition-all cursor-pointer"
                         >
                            <option value="">Aucun grade</option>
                            {Object.entries(RANKS).map(([k, v]) => (
                               <option key={k} value={k}>{v.label}</option>
                            ))}
                         </select>
                       </div>
                       <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Pages (0-3000)</Label>
                         <Input 
                           type="number" 
                           min="0" 
                           max="3000" 
                           value={editedData.pages || 0} 
                           onChange={(e) => {
                             const val = parseInt(e.target.value);
                             if (!isNaN(val) && val >= 0 && val <= 3000) {
                               setEditedData({ ...editedData, pages: val });
                             }
                           }} 
                           className="bg-white/40 border-none h-14 rounded-xl italic text-lg" 
                         />
                       </div>
                    </div>
                  </div>
               </div>

               <div className="space-y-12">
                 <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] opacity-60">Genres & Tropes de cœur</h3>
                 <div className="space-y-8">
                    <p className="text-lg italic text-primary/60 font-headline">Genres suggérés</p>
                    <div className="flex flex-wrap gap-3">
                      {GENRES_LIST.map(g => (
                        <button 
                          key={g} 
                          onClick={() => toggleTag("genres", g)}
                          className={cn(
                            "text-[10px] px-6 py-3 rounded-full border transition-all uppercase tracking-[0.2em] font-bold",
                            editedData.genres?.includes(g) ? "bg-primary text-white border-primary shadow-xl scale-105" : "bg-white/60 border-transparent hover:bg-white"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-8">
                    <p className="text-lg italic text-secondary-foreground/60 font-headline">Tropes fétiches</p>
                    <div className="flex flex-wrap gap-3">
                      {TROPES_LIST.map(t => (
                        <button 
                          key={t} 
                          onClick={() => toggleTag("tropes", t)}
                          className={cn(
                            "text-[10px] px-6 py-3 rounded-full border transition-all uppercase tracking-[0.2em] font-bold",
                            editedData.tropes?.includes(t) ? "bg-secondary text-secondary-foreground border-secondary shadow-xl scale-105" : "bg-white/60 border-transparent hover:bg-white"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                 </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
