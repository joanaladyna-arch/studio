
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Search, 
  Star, 
  Quote, 
  MessageSquare, 
  PersonStanding, 
  MapPin, 
  Loader2,
  CheckCircle2,
  Globe,
  Mic,
  Tag,
  Hash
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
  EMOTIONS, 
  GENRES_LIST, 
  TROPES_LIST, 
  BookStatus, 
  BookFormat, 
  RankType 
} from "@/app/library/page";

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
      let query = isbn !== "N/A" ? `isbn:${isbn}` : `intitle:${cleanTitle}+inauthor:${cleanAuthor}`;
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
        if (editedData.genres?.length === 0) updates.genres = info.categories;
        if (!editedData.isbn || editedData.isbn === "N/A") {
          updates.isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.[0]?.identifier;
        }

        setEditedData(prev => ({ ...prev, ...updates }));
        found = true;
      }

      // 2. Open Library Secondary
      if (!found) {
        const olResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cleanTitle + " " + cleanAuthor)}&limit=1`);
        const olData = await olResponse.json();
        if (olData.docs?.[0]) {
          const doc = olData.docs[0];
          const updates: Partial<Book> = {};
          if (!editedData.pages) updates.pages = doc.number_of_pages_median;
          if (!editedData.publisher) updates.publisher = doc.publisher?.[0];
          if (!editedData.publicationDate) updates.publicationDate = doc.first_publish_year?.toString();
          if (!editedData.cover && doc.cover_i) updates.cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          
          setEditedData(prev => ({ ...prev, ...updates }));
          found = true;
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
    <div className="space-y-10 animate-paper pb-20 max-w-5xl mx-auto">
      <header className="flex justify-between items-center pt-4">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary">
          <Link href="/library"><ArrowLeft className="h-4 w-4 mr-2" /> Ma Bibliothèque</Link>
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={enrichData} 
            disabled={isEnriching}
            className="rounded-full border-primary/10 hover:bg-primary/5 italic h-10 px-6"
          >
            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
            Compléter les informations
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="rounded-full bg-primary hover:bg-primary/90 h-10 px-8 shadow-lg shadow-primary/10 font-headline italic"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </header>

      <div className="grid md:grid-cols-[300px_1fr] gap-12 items-start">
        {/* Cover Section */}
        <div className="space-y-6">
          <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-2xl border border-white/40 bg-secondary/5 flex items-center justify-center p-4">
             <div className="relative w-full h-full">
                <Image 
                  src={editedData.cover || "https://picsum.photos/seed/placeholder/400/600"} 
                  alt={editedData.title || ""} 
                  fill 
                  className="object-contain"
                  sizes="400px"
                  priority
                />
             </div>
          </div>
          
          <Card className="glass-card p-6 border-none bg-white/40 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Statut de lecture</Label>
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
            
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Format</Label>
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
                        "rounded-xl border-primary/10 h-10 flex-1", 
                        editedData.format === key ? "bg-primary text-white border-primary" : "bg-white/40"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs italic text-muted-foreground">Favori</Label>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setEditedData({ ...editedData, favorite: !editedData.favorite })}
                className={cn("rounded-full", editedData.favorite ? "text-primary" : "text-muted-foreground/20")}
              >
                <Heart className={cn("h-6 w-6", editedData.favorite && "fill-primary")} />
              </Button>
            </div>
          </Card>

          <Button 
            variant="ghost" 
            onClick={handleDelete} 
            className="w-full text-destructive hover:bg-destructive/5 rounded-2xl h-12 italic"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Supprimer de ma bibliothèque
          </Button>
        </div>

        {/* Content Section */}
        <div className="space-y-10">
          <section className="space-y-4">
            <div>
              <h1 className="text-5xl font-headline italic tracking-tight leading-tight">{editedData.title}</h1>
              <p className="text-xl text-primary font-bold uppercase tracking-[0.2em] mt-2">{editedData.author}</p>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-2">
               {editedData.rank && (
                 <Badge className={cn("rounded-full px-4 py-1.5 font-headline italic text-sm shadow-sm border-none", RANKS[editedData.rank].color, "bg-white/80")}>
                    <Sparkles className="h-4 w-4 mr-2" /> {RANKS[editedData.rank].label}
                 </Badge>
               )}
               {editedData.format && (
                 <Badge variant="secondary" className={cn("rounded-full px-4 py-1.5 text-xs font-bold uppercase border-none", FORMATS[editedData.format].badgeClass)}>
                    {FORMATS[editedData.format].label}
                 </Badge>
               )}
            </div>
          </section>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-primary/5 px-0 gap-8 h-12 justify-start rounded-none mb-8">
              <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-lg">Résumé & Détails</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-lg">Mon Journal</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 font-headline italic text-lg">Paramètres</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="m-0 space-y-8 animate-paper">
               <div className="grid sm:grid-cols-2 gap-8 text-[11px] font-bold uppercase tracking-widest opacity-60">
                 <div className="flex items-center gap-3"><BookOpen className="h-4 w-4" /> {editedData.pages || 0} pages</div>
                 <div className="flex items-center gap-3"><CalendarIcon className="h-4 w-4" /> {editedData.publicationDate || "Date inconnue"}</div>
                 <div className="flex items-center gap-3"><Hash className="h-4 w-4" /> ISBN: {editedData.isbn || "N/A"}</div>
                 <div className="flex items-center gap-3"><Tag className="h-4 w-4" /> {editedData.publisher || "Éditeur inconnu"}</div>
               </div>

               <div className="space-y-4">
                 <h3 className="font-headline italic text-2xl flex items-center gap-2">
                   <Sparkles className="h-5 w-5 text-primary/40" /> Résumé
                 </h3>
                 <ScrollArea className="h-auto max-h-[300px] pr-6">
                    <p className="text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
                      {editedData.description?.replace(/<[^>]*>?/gm, '') || "Aucun résumé disponible pour le moment."}
                    </p>
                 </ScrollArea>
               </div>

               <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-headline italic text-xl">Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {editedData.genres?.map(g => (
                        <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[9px] font-bold uppercase">
                          {g}
                        </Badge>
                      ))}
                      {editedData.genres?.length === 0 && <p className="text-xs italic text-muted-foreground opacity-40">Aucun genre sélectionné</p>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-headline italic text-xl">Tropes</h3>
                    <div className="flex flex-wrap gap-2">
                      {editedData.tropes?.map(t => (
                        <Badge key={t} variant="secondary" className="bg-secondary text-secondary-foreground border-none text-[9px] font-bold uppercase">
                          {t}
                        </Badge>
                      ))}
                      {editedData.tropes?.length === 0 && <p className="text-xs italic text-muted-foreground opacity-40">Aucun trope sélectionné</p>}
                    </div>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 space-y-10 animate-paper">
               <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 italic"><CalendarIcon className="h-4 w-4 text-primary/40" /> Débuté le</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl border-none bg-white/40 h-12", !editedData.startDate && "text-muted-foreground")}>
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
                    <Label className="flex items-center gap-2 italic"><CheckCircle2 className="h-4 w-4 text-emerald-400/40" /> Terminé le</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl border-none bg-white/40 h-12", !editedData.endDate && "text-muted-foreground")}>
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
                 <div className="flex gap-3">
                   {[1, 2, 3, 4, 5].map((s) => (
                     <Star 
                       key={s} 
                       onClick={() => setEditedData({ ...editedData, rating: s })}
                       className={cn("h-8 w-8 cursor-pointer transition-all", s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400 scale-110" : "text-muted-foreground/20")} 
                     />
                   ))}
                 </div>
               </div>

               <div className="space-y-6">
                 <div className="space-y-4">
                   <Label className="flex items-center gap-2 italic text-lg"><MessageSquare className="h-4 w-4 text-primary/40" /> Mon avis</Label>
                   <Textarea 
                      value={editedData.review} 
                      onChange={(e) => setEditedData({ ...editedData, review: e.target.value })}
                      placeholder="Quelles émotions ce voyage a-t-il laissé en vous ?"
                      className="min-h-[150px] bg-white/40 border-none rounded-3xl p-6 italic text-lg shadow-inner"
                   />
                 </div>

                 <div className="space-y-4">
                   <Label className="flex items-center gap-2 italic text-lg"><Quote className="h-4 w-4 text-primary/40" /> Citation fétiche</Label>
                   <Textarea 
                      value={editedData.favoriteQuote} 
                      onChange={(e) => setEditedData({ ...editedData, favoriteQuote: e.target.value })}
                      placeholder="Une phrase gravée dans votre mémoire..."
                      className="min-h-[80px] bg-white/40 border-none rounded-3xl p-6 italic border-l-4 border-primary/20"
                   />
                 </div>

                 <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 italic"><PersonStanding className="h-4 w-4 text-primary/40" /> Personnages favoris</Label>
                      <Input 
                        value={editedData.favoriteCharacters} 
                        onChange={(e) => setEditedData({ ...editedData, favoriteCharacters: e.target.value })}
                        className="h-12 bg-white/40 border-none rounded-2xl italic"
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2 italic"><MapPin className="h-4 w-4 text-primary/40" /> Scène marquante</Label>
                      <Input 
                        value={editedData.memorableScene} 
                        onChange={(e) => setEditedData({ ...editedData, memorableScene: e.target.value })}
                        className="h-12 bg-white/40 border-none rounded-2xl italic"
                      />
                    </div>
                 </div>
               </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0 space-y-10 animate-paper">
               <div className="grid sm:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Bibliothèque</h3>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Titre</Label>
                         <Input value={editedData.title} onChange={(e) => setEditedData({ ...editedData, title: e.target.value })} className="bg-white/40 border-none h-11" />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Auteur</Label>
                         <Input value={editedData.author} onChange={(e) => setEditedData({ ...editedData, author: e.target.value })} className="bg-white/40 border-none h-11" />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Éditeur</Label>
                         <Input value={editedData.publisher} onChange={(e) => setEditedData({ ...editedData, publisher: e.target.value })} className="bg-white/40 border-none h-11" />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Saga & Format</h3>
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Série</Label>
                           <Input value={editedData.series} onChange={(e) => setEditedData({ ...editedData, series: e.target.value })} className="bg-white/40 border-none h-11" />
                         </div>
                         <div className="space-y-1.5">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tome</Label>
                           <Input value={editedData.volume} onChange={(e) => setEditedData({ ...editedData, volume: e.target.value })} className="bg-white/40 border-none h-11" />
                         </div>
                       </div>
                       {editedData.format === 'audio' && (
                         <div className="space-y-1.5">
                           <Label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Narrateur</Label>
                           <div className="relative">
                              <Mic className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/40" />
                              <Input value={editedData.narrator} onChange={(e) => setEditedData({ ...editedData, narrator: e.target.value })} className="pl-9 bg-white/40 border-none h-11" />
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                 <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60">Genres & Tropes</h3>
                 <div className="space-y-4">
                    <p className="text-xs italic text-muted-foreground">Genres</p>
                    <div className="flex flex-wrap gap-2">
                      {GENRES_LIST.map(g => (
                        <button 
                          key={g} 
                          onClick={() => toggleItem("genres", g)}
                          className={cn(
                            "text-[10px] px-4 py-2 rounded-full border transition-all uppercase tracking-widest",
                            editedData.genres?.includes(g) ? "bg-primary text-white border-primary" : "bg-white/50 border-transparent"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-xs italic text-muted-foreground">Tropes</p>
                    <div className="flex flex-wrap gap-2">
                      {TROPES_LIST.map(t => (
                        <button 
                          key={t} 
                          onClick={() => toggleItem("tropes", t)}
                          className={cn(
                            "text-[10px] px-4 py-2 rounded-full border transition-all uppercase tracking-widest",
                            editedData.tropes?.includes(t) ? "bg-secondary text-secondary-foreground border-secondary" : "bg-white/50 border-transparent"
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
