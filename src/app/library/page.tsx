
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Heart, Diamond, Crown, Star, Sparkles, BookText, Wind, Trash2, DoorOpen, Pause, RefreshCw, Plus, PlusCircle } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export type RankType = 'diamant' | 'royale' | 'doree' | 'argentee' | 'simple' | 'froissee' | 'brisee' | 'dnf';
export type BookStatus = "pal" | "progress" | "read" | "dnf" | "pause" | "reread";

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  favorite: boolean;
  cover: string;
  rank?: RankType;
  genres?: string[];
  tropes?: string[];
  review?: string;
  citation?: string;
  progress?: number;
  totalPages?: number;
  pagesRead?: number;
  description?: string;
  isbn?: string;
  dateAdded?: string;
}

export const GENRES_LIST = [
  "Romance", "Dark Romance", "Thriller", "Fantasy", "Romantasy", "Sci-Fi", "Contemporain", "Historique", "Horreur", "Classiques", "Manga", "Non Fiction"
];

export const TROPES_LIST = [
  "Soulmates", "Forbidden Love", "Enemies to Lovers", "Fake Dating", "Slow Burn", "Found Family", "Morally Grey", "Small Town"
];

export const RANKS: Record<RankType, { label: string, icon: any, color: string, description: string }> = {
  diamant: { label: "Diamant de Plume", icon: Diamond, color: "text-cyan-400", description: "Coup de cœur absolu" },
  royale: { label: "Plume Royale", icon: Crown, color: "text-amber-500", description: "Livre exceptionnel" },
  doree: { label: "Plume Dorée", icon: Star, color: "text-yellow-400", description: "Excellente lecture" },
  argentee: { label: "Plume Argentée", icon: Sparkles, color: "text-slate-300", description: "Très bonne lecture" },
  simple: { label: "Plume Simple", icon: BookText, color: "text-primary", description: "Lecture agréable" },
  froissee: { label: "Plume Froissée", icon: Wind, color: "text-muted-foreground", description: "Avis mitigé" },
  brisee: { label: "Plume Brisée", icon: Trash2, color: "text-destructive", description: "Je n'ai pas aimé" },
  dnf: { label: "DNF", icon: DoorOpen, color: "text-slate-800", description: "Livre non terminé" },
};

export const STATUSES: Record<BookStatus, { label: string, icon: any, color: string }> = {
  pal: { label: "PAL", icon: BookText, color: "bg-slate-400" },
  progress: { label: "En cours", icon: RefreshCw, color: "bg-blue-400" },
  read: { label: "Lu", icon: Sparkles, color: "bg-emerald-400" },
  dnf: { label: "DNF", icon: DoorOpen, color: "bg-rose-400" },
  pause: { label: "Pause", icon: Pause, color: "bg-amber-400" },
  reread: { label: "Relecture", icon: RefreshCw, color: "bg-purple-400" },
};

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "En cours" },
  { id: "read", label: "Lu" },
  { id: "favorite", label: "Favoris" },
];

export default function LibraryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const { toast } = useToast();

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const counts = useMemo(() => {
    const res: Record<string, number> = { all: books.length, pal: 0, progress: 0, read: 0, favorite: 0 };
    books.forEach(b => {
      if (b.status === 'pal') res.pal++;
      if (b.status === 'progress') res.progress++;
      if (b.status === 'read') res.read++;
      if (b.favorite) res.favorite++;
    });
    return res;
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = String(book.title).toLowerCase().includes(searchQuery.toLowerCase()) || 
                           String(book.author).toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === "all") return true;
      if (activeTab === "favorite") return book.favorite;
      return book.status === activeTab;
    });
  }, [activeTab, searchQuery, books]);

  const handleUpdateBook = async (updatedData: Partial<Book>) => {
    if (!db || !user || !editingBook) return;
    try {
      const bookRef = doc(db, "users", user.uid, "books", editingBook.id);
      await updateDoc(bookRef, updatedData);
      setEditingBook(null);
      toast({ title: "Livre mis à jour", description: "Vos modifications ont été enregistrées." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour." });
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!db || !user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "books", id));
      setEditingBook(null);
      toast({ title: "Livre supprimé", description: "Le livre a été retiré de votre bibliothèque." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer." });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-32">
      <header className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-headline tracking-tight">Ma Bibliothèque</h1>
          <p className="text-primary/60 italic font-medium">L'écrin précieux de vos aventures littéraires.</p>
        </div>
        
        <div className="flex gap-4 max-w-2xl mx-auto items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Chercher un titre ou un auteur..." 
              className="pl-10 h-12 bg-white/40 border-white/60 focus-visible:ring-primary/20 rounded-2xl shadow-sm italic"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild className="rounded-2xl bg-primary hover:bg-primary/90 h-12 px-6 shadow-lg shadow-primary/10 font-headline italic text-lg hidden sm:flex">
            <Link href="/add">
              <Plus className="mr-2 h-5 w-5" />
              Ajouter
            </Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b border-primary/5 p-0 rounded-none gap-8 no-scrollbar mb-8">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 font-headline text-lg px-2 flex items-center gap-2 whitespace-nowrap transition-all opacity-50 data-[state=active]:opacity-100"
            >
              {cat.label}
              <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] bg-primary/5 text-primary border-none font-bold">
                {counts[cat.id as keyof typeof counts] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="py-32 text-center text-muted-foreground italic">Ouverture de vos étagères...</div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
              {filteredBooks.map((book) => (
                <div key={book.id} onClick={() => setEditingBook(book as Book)} className="cursor-pointer">
                  <BookCard book={book as Book} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center space-y-6">
               <BookText className="h-16 w-16 mx-auto text-primary/10" />
               <div className="space-y-2">
                 <p className="text-muted-foreground italic text-lg">Aucun livre trouvé dans cette section.</p>
                 <Button asChild variant="link" className="text-primary italic">
                   <Link href="/add">Commencer une nouvelle collection ?</Link>
                 </Button>
               </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Link href="/add" className="fixed bottom-24 right-6 z-50 group sm:hidden">
        <Button size="icon" className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/40 group-hover:scale-110 transition-transform">
          <Plus className="h-7 w-7" />
        </Button>
      </Link>
      <div className="hidden sm:block fixed bottom-8 right-8 z-50">
        <Button asChild className="rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/40 h-16 px-8 text-lg font-headline italic">
           <Link href="/add">
              <PlusCircle className="mr-2 h-6 w-6" />
              Ajouter une pépite
           </Link>
        </Button>
      </div>

      {editingBook && (
        <EditBookDialog 
          book={editingBook} 
          onClose={() => setEditingBook(null)} 
          onSave={handleUpdateBook} 
          onDelete={handleDeleteBook}
        />
      )}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const rank = book.rank ? RANKS[book.rank] : null;
  const RankIcon = rank?.icon;

  return (
    <div className="space-y-4 group">
      <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-sm border border-white/40 group-hover:shadow-2xl transition-all duration-700 group-hover:-translate-y-2 bg-muted">
        <Image 
          src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
          alt={book.title} 
          fill 
          className="object-cover transition-transform duration-1000 group-hover:scale-110" 
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <div className={cn(
            "text-[8px] font-bold px-2 py-0.5 rounded-full text-white shadow-lg uppercase",
            STATUSES[book.status]?.color || "bg-slate-400"
          )}>
            {STATUSES[book.status]?.label}
          </div>
          {book.favorite && (
            <div className="bg-white/95 p-1.5 rounded-full shadow-lg border border-primary/10">
              <Heart className="h-3 w-3 text-primary fill-primary" />
            </div>
          )}
          {rank && (
            <div className="bg-white/95 p-2 rounded-full shadow-lg border border-primary/5">
              <RankIcon className={cn("h-4 w-4", rank.color)} />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/40 backdrop-blur-md border-t border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
           <div className="flex flex-wrap gap-1">
              {book.genres?.slice(0, 2).map(g => (
                <span key={g} className="text-[8px] px-2 py-0.5 rounded-full bg-white/80 text-foreground font-bold uppercase tracking-tighter">
                  {g}
                </span>
              ))}
           </div>
        </div>
      </div>
      <div className="text-center px-1">
        <h3 className="text-sm font-headline line-clamp-1 italic">{book.title}</h3>
        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{book.author}</p>
      </div>
    </div>
  );
}

function EditBookDialog({ book, onClose, onSave, onDelete }: { book: Book, onClose: () => void, onSave: (data: Partial<Book>) => void, onDelete: (id: string) => void }) {
  const [genres, setGenres] = useState<string[]>(book.genres || []);
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [rank, setRank] = useState<RankType | undefined>(book.rank);
  const [favorite, setFavorite] = useState(book.favorite);
  const [progress, setProgress] = useState(book.progress || 0);

  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] glass-card border-none flex flex-col p-0 overflow-hidden bg-background/95">
        <DialogHeader className="p-6 border-b border-primary/5">
          <DialogTitle className="font-headline text-3xl italic">Éditer ma pépite</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
               <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden shadow-md bg-muted">
                  <Image src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={book.title} fill className="object-cover" />
               </div>
               <div className="space-y-1">
                  <h3 className="text-xl font-headline italic">{book.title}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                  {book.isbn && <p className="text-[10px] text-muted-foreground">ISBN: {book.isbn}</p>}
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Statut de lecture</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <Button 
                      key={key} 
                      variant="outline" 
                      size="sm"
                      onClick={() => setStatus(key as BookStatus)}
                      className={cn("rounded-full border-primary/10 text-[10px] font-bold h-8 px-4", status === key ? "bg-primary text-white border-primary" : "hover:border-primary/40")}
                    >
                      {val.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Grade Plume</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(RANKS).map(([key, val]) => {
                    const Icon = val.icon;
                    return (
                      <Button 
                        key={key} 
                        variant="outline" 
                        size="sm"
                        onClick={() => setRank(key as RankType)}
                        className={cn("rounded-full border-primary/10 h-8 px-3 text-[10px]", rank === key ? "bg-primary/10 text-primary border-primary" : "hover:border-primary/40")}
                      >
                        <Icon className="h-3 w-3 mr-1.5" /> {val.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Genres littéraires</label>
               <div className="flex flex-wrap gap-2">
                  {GENRES_LIST.map(g => (
                    <button 
                      key={g} 
                      onClick={() => toggleItem(genres, setGenres, g)}
                      className={cn(
                        "text-[10px] px-3 py-1.5 rounded-full border transition-all font-bold uppercase",
                        genres.includes(g) 
                          ? "bg-primary text-white border-primary" 
                          : "bg-white/50 text-muted-foreground border-transparent hover:border-primary/20"
                      )}
                    >
                      {g}
                    </button>
                  ))}
               </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
               <Button 
                variant="ghost" 
                onClick={() => setFavorite(!favorite)}
                className={cn("rounded-2xl h-12 px-6", favorite && "text-primary bg-primary/5")}
               >
                 <Heart className={cn("h-5 w-5 mr-2", favorite && "fill-primary")} /> {favorite ? "Coup de cœur" : "Ajouter aux favoris"}
               </Button>

               <Button variant="ghost" className="text-destructive hover:bg-destructive/5" onClick={() => onDelete(book.id)}>
                 <Trash2 className="h-4 w-4 mr-2" /> Supprimer
               </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t border-primary/5 bg-white/40">
           <Button variant="ghost" onClick={onClose} className="rounded-xl">Annuler</Button>
           <Button 
            onClick={() => onSave({ genres, status, rank, favorite, progress })} 
            className="rounded-xl bg-primary hover:bg-primary/90 font-headline italic text-lg px-8 h-12"
           >
             Enregistrer mes pépites
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
