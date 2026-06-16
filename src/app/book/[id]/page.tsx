
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
  Layers
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
  GENRES_LIST, 
  TROPES_LIST, 
  BookStatus, 
  BookFormat, 
  RankType 
} from "@/app/library/page";

const LANGUAGE_MAP: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  de: "Allemand",
  it: "Italien",
  pt: "Portugais",
  nl: "Néerlandais",
  ja: "Japonais",
  ko: "Coréen",
  zh: "Chinois",
};

const getLanguageName = (code: string | undefined) => {
  if (!code) return "Inconnue";
  const cleanCode = code.toLowerCase().trim();
  return LANGUAGE_MAP[cleanCode] || code.toUpperCase();
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

  // States for local editing
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [editedData, setEditedData] = useState<Partial<Book>>({});
  const [suggestedEditions, setSuggestedEditions] = useState<any[]>([]);

  useEffect(() => {
    if (book) {
      setEditedData(book as Book);
    }
  }, [book]);

  const toggleItem = (field: "genres" | "tropes" | "emotions", item: string) => {
    const list = editedData[field] || [];
    if (list.includes(item)) {
      setEditedData({ ...editedData, [field]: list.filter(i => i !== item) });
    } else {
      setEditedData({ ...editedData, [field]: [...list, item] });
    }
  };

  const handleSave = async () => {
    if (!bookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(bookRef, {
        ...editedData,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Modifications enregistrées", description: "Votre pépite a été mise à jour." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bookRef) return;
    if (!confirm("Voulez-vous vraiment retirer ce livre de votre bibliothèque ?")) return;
    try {
      await deleteDoc(bookRef);
      router.push("/library");
      toast({ title: "Livre supprimé", description: "La pépite a été retirée." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Suppression impossible." });
    }
  };

  const enrichData = async () => {
    if (!editedData.title || !editedData.author) return;
    setIsEnriching(true);
    
    let found = false;
    const cleanTitle = editedData.title;
    const cleanAuthor = editedData.author;
    const isbn = editedData.isbn;

    try {
      // 1. Google Books Priority
      let query = isbn && isbn !== "N/A" ? `isbn:${isbn}` : `intitle:${cleanTitle}+inauthor:${cleanAuthor}`;
      const gResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`);
      const gData = await gResponse.json();

      if (gData.items?.[0]) {
        const info = gData.items[0].volumeInfo;
        const updates: Partial<Book> = {};
        
        if (!editedData.publisher) updates.publisher = info.publisher;
        if (!editedData.pages) updates.pages = info.pageCount;
        if (!editedData.description) updates.description = info.description;
        if (!editedData.publicationDate) updates.publicationDate = info.publishedDate;
        if (!editedData.cover) updates.cover = info.imageLinks?.thumbnail?.replace("http://", "https://");
        if (!editedData.genres || editedData.genres.length === 0) updates.genres = info.categories;
        if (!editedData.language) updates.language = getLanguageName(info.language);
        if (!editedData.isbn || editedData.isbn === "N/A") {
          updates.isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.[0]?.identifier;
        }

        setEditedData(prev => ({ ...prev, ...updates }));
        found = true;
      }

      // 2. Open Library Secondary
      const olResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cleanTitle + " " + cleanAuthor)}&limit=1`);
      const olData = await olResponse.json();
      if (olData.docs?.[0]) {
        const doc = olData.docs[0];
        const updates: Partial<Book> = {};
        if (!editedData.pages && doc.number_of_pages_median) updates.pages = doc.number_of_pages_median;
        if (!editedData.publisher && doc.publisher) updates.publisher = doc.publisher?.[0];
        if (!editedData.publicationDate && doc.first_publish_year) updates.publicationDate = doc.first_publish_year?.toString();
        if (!editedData.cover && doc.cover_i) updates.cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        if (!editedData.language && doc.language) updates.language = getLanguageName(doc.language?.[0]);
        
        setEditedData(prev => ({ ...prev, ...updates }));
        found = true;

        // Fetch other editions
        if (doc.key) {
           const edResponse = await fetch(`https://openlibrary.org${doc.key}/editions.json?limit=5`);
           const edData = await edResponse.json();
           if (edData.entries) {
              setSuggestedEditions(edData.entries.map((e: any) => ({
                publisher: e.publishers?.[0],
                year: e.publish_date,
                isbn: e.isbn_13?.[0] || e.isbn_10?.[0],
                pages: e.number_of_pages,
                cover: e.covers ? `https://covers.openlibrary.org/b/id/${e.covers[0]}-M.jpg` : null
              })));
           }
        }
      }

      if (found) {
        toast({ title: "Informations enrichies", description: "Les données manquantes ont été complétées depuis le web." });
      } else {
        toast({ variant: "destructive", title: "Information", description: "Aucune donnée supplémentaire trouvée sur le web." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Service de recherche indisponible." });
    } finally {
      setIsEnriching(false);
    }
  };

  if (bookLoading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
      <p className="font-headline italic text-primary/60">Ouverture de votre écrin...</p>
    </div>
  );

  if (!book) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <p className="font-headline italic text-primary/60">Cette pépite n'existe plus.</p>
      <Button asChild variant="ghost"><Link href="/library">Retour à la bibliothèque</Link></Button>
    </div>
  );

  return (
    <div className="space-y-10 animate-paper pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary">
          <Link href="/library"><ArrowLeft className="h-4 w-4 mr-2" /> Ma Bibliothèque</Link>
        </Button>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={enrichData} 
            disabled={isEnriching}
            className="rounded-full border-primary/10 hover:bg-primary/5 italic h-10 px-6 flex-1 sm:flex-none"
          >
            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
            Enrichir
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="rounded-full bg-primary hover:bg-primary/90 h-10 px-8 shadow-lg shadow-primary/10 font-headline italic flex-1 sm:flex-none"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[340px_1fr] gap-12 items-start">
        {/* Sidebar: Visuals & Fast Status */}
        <div className="space-y-8 flex flex-col items-center lg:items-start">
          <div className="relative w-full max-w-[180px] sm:max-w-[240px] max-h-[360px] aspect-[2/3] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5 flex items-center justify-center p-4">
             <div className="relative w-full h-full">
                <Image 
                  src={editedData.cover || "https://picsum.photos/seed/placeholder/400/600"} 
                  alt={editedData.title || ""} 
                  fill 
                  className="object-contain"
                  sizes="(max-width: 640px) 180px, 240px"
                  priority
                />
             </div>
          </div>
          
          <Card className="glass-card p-6 border-none bg-white/40 space-y-6 w-full max-w-[340px]">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Statut actuel</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUSES).map(([key, val]) => (
                  <Button 
                    key={key} 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditedData({ ...editedData, status: key as BookStatus })}
                    className={cn(
                      "rounded-full border-primary/10 text-[9px] h-8 px-3", 
                      editedData.status === key ? "bg-primary text-white border-primary" : "bg-white/60"
                    )}
                  >
                    {val.label}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Format choisi</Label>
              <div className="flex gap-2">
                {Object.entries(FORMATS).map(([key, val]) => {
                  const Icon = val.icon;
                  return (
                    <Button 
                      key={key} 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditedData({ ...editedData, format: key as BookFormat })}
                      className={cn(
                        "rounded-xl border-primary/10 h-11 flex-1", 
                        editedData.format === key ? "bg-primary text-white border-primary" : "bg-white/40"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" /> {val.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-primary/5 flex items-center justify-between">
              <span className="text-xs italic text-muted-foreground">Ajouter aux favoris</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setEditedData({ ...editedData, favorite: !editedData.favorite })}
                className={cn("rounded-full", editedData.favorite ? "text-primary bg-primary/5" : "text-muted-foreground/20")}
              >
                <Heart className={cn("h-6 w-6", editedData.favorite && "fill-primary")} />
              </Button>
            </div>
          </Card>

          <Button 
            variant="ghost" 
            onClick={handleDelete} 
            className="w-full max-w-[340px] text-destructive hover:bg-destructive/5 rounded-2xl h-12 italic"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Retirer de ma bibliothèque
          </Button>
        </div>

        {/* Main Content: Info, Journal, Series */}
        <div className="space-y-12">
          <section className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-5xl sm:text-6xl font-headline italic tracking-tight leading-tight">{editedData.title || ""}</h1>
              <Link 
                href={`/author/${encodeURIComponent(editedData.author || "")}`}
                className="inline-block text-2xl text-primary font-bold uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
              >
                {editedData.author || ""}
              </Link>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-2">
               {editedData.rank && (
                 <Badge className={cn("rounded-full px-5 py-2 font-headline italic text-sm shadow-sm border-none", RANKS[editedData.rank].color, "bg-white/80")}>
                    <Sparkles className="h-4 w-4 mr-2" /> {RANKS[editedData.rank].label}
                 </Badge>
               )}
               {editedData.format && (
                 <Badge variant="secondary" className={cn("rounded-full px-5 py-2 text-xs font-bold uppercase border-none", FORMATS[editedData.format].badgeClass)}>
                    {FORMATS[editedData.format].label}
                 </Badge>
               )}
            </div>
          </section>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-primary/5 px-0 gap-10 h-12 justify-start rounded-none mb-10 overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-xl whitespace-nowrap">L'Œuvre</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-xl whitespace-nowrap">Mon Journal</TabsTrigger>
              <TabsTrigger value="series" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-xl whitespace-nowrap">Saga & Éditions</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-xl whitespace-nowrap">Paramètres</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="m-0 space-y-12 animate-paper">
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-[11px] font-bold uppercase tracking-widest opacity-60">
                 <div className="flex items-center gap-3"><BookOpen className="h-4 w-4" /> {editedData.pages ? `${editedData.pages} pages` : "Nombre de pages inconnu"}</div>
                 <div className="flex items-center gap-3"><CalendarIcon className="h-4 w-4" /> {editedData.publicationDate || "Date inconnue"}</div>
                 <div className="flex items-center gap-3"><Hash className="h-4 w-4" /> {editedData.isbn || "ISBN N/A"}</div>
                 <div className="flex items-center gap-3"><Globe className="h-4 w-4" /> {editedData.language ? getLanguageName(editedData.language) : "Langue N/A"}</div>
               </div>

               <div className="space-y-6">
                 <h3 className="font-headline italic text-3xl flex items-center gap-3">
                   <Sparkles className="h-6 w-6 text-primary/40" /> Résumé
                 </h3>
                 <div className="relative p-8 rounded-[2rem] bg-white/40 shadow-inner border border-white/60">
                    <ScrollArea className="h-auto max-h-[400px] pr-8">
                       <p className="text-muted-foreground italic text-lg leading-relaxed whitespace-pre-wrap">
                         {editedData.description?.replace(/<[^>]*>?/gm, '') || "Aucun résumé disponible."}
                       </p>
                    </ScrollArea>
                 </div>
               </div>

               <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="font-headline italic text-2xl flex items-center gap-2"><Tag className="h-5 w-5 text-primary/40" /> Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {editedData.genres?.map(g => (
                        <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold uppercase tracking-widest px-4 py-2">
                          {g}
                        </Badge>
                      ))}
                      {(!editedData.genres || editedData.genres.length === 0) && <p className="text-sm italic text-muted-foreground opacity-40">Aucun genre renseigné</p>}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="font-headline italic text-2xl flex items-center gap-2"><Layers className="h-5 w-5 text-secondary" /> Tropes</h3>
                    <div className="flex flex-wrap gap-2">
                      {editedData.tropes?.map(t => (
                        <Badge key={t} variant="secondary" className="bg-secondary text-secondary-foreground border-none text-[10px] font-bold uppercase tracking-widest px-4 py-2">
                          {t}
                        </Badge>
                      ))}
                      {(!editedData.tropes || editedData.tropes.length === 0) && <p className="text-sm italic text-muted-foreground opacity-40">Aucun trope renseigné</p>}
                    </div>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 space-y-12 animate-paper">
               <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 italic text-sm opacity-60"><CalendarIcon className="h-4 w-4" /> Débuté le</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-2xl border-none bg-white/40 h-14 italic text-lg shadow-sm", !editedData.startDate && "text-muted-foreground")}>
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
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 italic text-sm opacity-60"><CheckCircle2 className="h-4 w-4" /> Terminé le</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-2xl border-none bg-white/40 h-14 italic text-lg shadow-sm", !editedData.endDate && "text-muted-foreground")}>
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

               <div className="space-y-6">
                 <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Note de lecture</Label>
                 <div className="flex gap-4">
                   {[1, 2, 3, 4, 5].map((s) => (
                     <Star 
                       key={s} 
                       onClick={() => setEditedData({ ...editedData, rating: s })}
                       className={cn("h-10 w-10 cursor-pointer transition-all hover:scale-125", s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/10")} 
                     />
                   ))}
                 </div>
               </div>

               <div className="space-y-8">
                 <div className="space-y-4">
                   <Label className="flex items-center gap-2 italic text-2xl font-headline"><MessageSquare className="h-5 w-5 text-primary/40" /> Mon avis personnel</Label>
                   <Textarea 
                      value={editedData.review || ""} 
                      onChange={(e) => setEditedData({ ...editedData, review: e.target.value })}
                      placeholder="Comment ce voyage a-t-il résonné en vous ?"
                      className="min-h-[180px] bg-white/40 border-none rounded-[2rem] p-8 italic text-lg shadow-inner focus-visible:ring-primary/20"
                   />
                 </div>

                 <div className="space-y-4">
                   <Label className="flex items-center gap-2 italic text-2xl font-headline"><Quote className="h-5 w-5 text-primary/40" /> Citation fétiche</Label>
                   <Textarea 
                      value={editedData.favoriteQuote || ""} 
                      onChange={(e) => setEditedData({ ...editedData, favoriteQuote: e.target.value })}
                      placeholder="Une phrase à ne jamais oublier..."
                      className="min-h-[100px] bg-white/40 border-none rounded-3xl p-8 italic border-l-8 border-primary/10 shadow-sm"
                   />
                 </div>

                 <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 italic opacity-60"><PersonStanding className="h-4 w-4" /> Personnages favoris</Label>
                      <Input 
                        value={editedData.favoriteCharacters || ""} 
                        onChange={(e) => setEditedData({ ...editedData, favoriteCharacters: e.target.value })}
                        className="h-14 bg-white/40 border-none rounded-2xl italic text-lg shadow-sm"
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 italic opacity-60"><MapPin className="h-4 w-4" /> Scène marquante</Label>
                      <Input 
                        value={editedData.memorableScene || ""} 
                        onChange={(e) => setEditedData({ ...editedData, memorableScene: e.target.value })}
                        className="h-14 bg-white/40 border-none rounded-2xl italic text-lg shadow-sm"
                      />
                    </div>
                 </div>
               </div>
            </TabsContent>

            <TabsContent value="series" className="m-0 space-y-12 animate-paper">
               <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline italic text-3xl">La Saga</h3>
                    <Badge variant="outline" className="rounded-full px-4 italic border-primary/20 text-primary">Série : {editedData.series || "Non définie"}</Badge>
                  </div>
                  
                  {editedData.series ? (
                    <div className="p-8 rounded-[2rem] bg-secondary/5 border border-white/60 space-y-4">
                       <p className="text-sm italic text-muted-foreground">Volume {editedData.volume || "inconnu"} de la série {editedData.series}.</p>
                       <Button asChild variant="outline" className="rounded-xl border-primary/20 h-11 italic">
                          <Link href={`/add?q=${encodeURIComponent(editedData.series)}`}><Layers className="h-4 w-4 mr-2" /> Chercher d'autres tomes</Link>
                       </Button>
                    </div>
                  ) : (
                    <div className="p-12 text-center glass-card border-dashed bg-white/20 space-y-4">
                       <p className="italic text-muted-foreground">Aucune série n'est renseignée pour ce livre.</p>
                       <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Vous pouvez l'ajouter manuellement dans les paramètres.</p>
                    </div>
                  )}
               </div>

               <div className="space-y-8">
                  <h3 className="font-headline italic text-3xl">Autres éditions connues</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {suggestedEditions.length > 0 ? suggestedEditions.map((ed, i) => (
                      <Card key={i} className="bg-white/40 border-none p-4 flex gap-4 items-center">
                        <div className="relative h-20 w-14 shrink-0 rounded-lg overflow-hidden bg-secondary/10">
                           {ed.cover ? <Image src={ed.cover} alt="edition" fill className="object-cover" sizes="60px" /> : <BookOpen className="h-6 w-6 m-auto opacity-10" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{ed.publisher}</p>
                          <p className="text-xs italic font-medium">{ed.year}</p>
                          <p className="text-[9px] opacity-40">ISBN: {ed.isbn}</p>
                        </div>
                      </Card>
                    )) : (
                      <div className="col-span-full py-12 text-center text-xs italic text-muted-foreground opacity-40">
                         Cliquez sur "Enrichir" pour tenter de récupérer les éditions depuis Open Library.
                      </div>
                    )}
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0 space-y-12 animate-paper">
               <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">Bibliothèque & Édition</h3>
                    <div className="space-y-5">
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Titre précis</Label>
                         <Input value={editedData.title || ""} onChange={(e) => setEditedData({ ...editedData, title: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                       </div>
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Auteur</Label>
                         <Input value={editedData.author || ""} onChange={(e) => setEditedData({ ...editedData, author: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                       </div>
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Éditeur / Maison</Label>
                         <Input value={editedData.publisher || ""} onChange={(e) => setEditedData({ ...editedData, publisher: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Langue</Label>
                           <Input value={editedData.language || ""} onChange={(e) => setEditedData({ ...editedData, language: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Pages</Label>
                           <Input type="number" value={editedData.pages ?? ""} onChange={(e) => setEditedData({ ...editedData, pages: Number(e.target.value) })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                         </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">Saga & Audio</h3>
                    <div className="space-y-5">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Série</Label>
                           <Input value={editedData.series || ""} onChange={(e) => setEditedData({ ...editedData, series: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tome n°</Label>
                           <Input value={editedData.volume || ""} onChange={(e) => setEditedData({ ...editedData, volume: e.target.value })} className="bg-white/40 border-none h-12 rounded-xl italic" />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Classement Prestige</Label>
                         <select 
                            value={editedData.rank || ""} 
                            onChange={(e) => setEditedData({ ...editedData, rank: e.target.value as RankType })}
                            className="w-full h-12 rounded-xl bg-white/40 border-none px-4 italic text-sm focus:ring-primary/20"
                         >
                            <option value="">Aucun grade</option>
                            {Object.entries(RANKS).map(([k, v]) => (
                               <option key={k} value={k}>{v.label}</option>
                            ))}
                         </select>
                       </div>
                    </div>
                  </div>
               </div>

               <div className="space-y-10">
                 <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">Thématiques Littéraires</h3>
                 <div className="space-y-6">
                    <p className="text-sm italic text-primary/60">Genres suggérés</p>
                    <div className="flex flex-wrap gap-2">
                      {GENRES_LIST.map(g => (
                        <button 
                          key={g} 
                          onClick={() => toggleItem("genres", g)}
                          className={cn(
                            "text-[10px] px-5 py-2.5 rounded-full border transition-all uppercase tracking-widest font-bold",
                            editedData.genres?.includes(g) ? "bg-primary text-white border-primary shadow-md" : "bg-white/60 border-transparent hover:bg-white"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-6">
                    <p className="text-sm italic text-secondary-foreground/60">Tropes de cœur</p>
                    <div className="flex flex-wrap gap-2">
                      {TROPES_LIST.map(t => (
                        <button 
                          key={t} 
                          onClick={() => toggleItem("tropes", t)}
                          className={cn(
                            "text-[10px] px-5 py-2.5 rounded-full border transition-all uppercase tracking-widest font-bold",
                            editedData.tropes?.includes(t) ? "bg-secondary text-secondary-foreground border-secondary shadow-md" : "bg-white/60 border-transparent hover:bg-white"
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
