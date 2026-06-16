
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Heart, 
  Diamond, 
  Crown, 
  Star, 
  Sparkles, 
  BookText, 
  Wind, 
  Trash2, 
  DoorOpen, 
  Pause, 
  RefreshCw, 
  Plus, 
  Book as BookIcon, 
  Tablet, 
  Headphones, 
  SlidersHorizontal, 
  Loader2,
  Bookmark,
  Smartphone,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";

export type RankType = 'diamant' | 'royale' | 'doree' | 'argentee' | 'simple' | 'froissee' | 'brisee' | 'dnf';
export type BookStatus = "pal" | "progress" | "read" | "dnf" | "pause" | "reread";
export type BookFormat = "papier" | "ebook" | "kindle" | "kobo" | "audio" | "audible" | "audiolib" | "autre";

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  collection?: string;
  isbn?: string;
  publicationDate?: string;
  language?: string;
  series?: string;
  volume?: string;
  cover: string;
  description?: string;
  genres?: string[];
  tropes?: string[];
  themes?: string[];
  pages?: number;
  format?: BookFormat;
  status: BookStatus;
  favorite: boolean;
  dePlume: boolean;
  rank?: RankType;
  progress?: number;
  pagesRead?: number;
  rating?: number;
  review?: string;
  favoriteQuote?: string;
  favoriteCharacters?: string;
  memorableScene?: string;
  emotions?: string[];
  startDate?: string;
  endDate?: string;
  dateAdded?: any;
}

export const GENRES_LIST = [
  "Romance contemporaine", "Dark romance", "Fantasy", "Romantasy", "New romance", 
  "Young adult", "New adult", "Thriller", "Suspense", "Policier", 
  "Mystère", "Science-fiction", "Dystopie", "Historique", "Drame", 
  "Développement personnel", "Témoignage", "Biographie", "Manga", "BD", "Poésie"
];

export const TROPES_LIST = [
  "Enemies to lovers", "Friends to lovers", "Slow burn", "Fake dating", 
  "Forced proximity", "Grumpy x sunshine", "Second chance", "Found family", 
  "Age gap", "Brother’s best friend", "Best friend’s brother", "Marriage of convenience", 
  "Forbidden love", "Workplace romance", "Sports romance", "Small town", 
  "Billionaire", "Mafia", "Royal romance", "Single parent", "Roommates", 
  "Academic rivals", "Love triangle", "Soulmates", "Protector", "Revenge", 
  "Secret identity", "Childhood friends", "Opposites attract", "He falls first", 
  "She falls first", "Touch her and you die"
];

export const FORMATS: Record<BookFormat, { label: string, icon: any, color: string, badgeClass: string }> = {
  papier: { label: "Papier", icon: BookIcon, color: "text-amber-800", badgeClass: "bg-orange-50 text-orange-700 border-orange-100" },
  ebook: { label: "Ebook", icon: Tablet, color: "text-blue-500", badgeClass: "bg-blue-50 text-blue-700 border-blue-100" },
  kindle: { label: "Kindle", icon: Smartphone, color: "text-slate-800", badgeClass: "bg-slate-100 text-slate-800 border-slate-200" },
  kobo: { label: "Kobo", icon: Tablet, color: "text-purple-500", badgeClass: "bg-purple-50 text-purple-700 border-purple-100" },
  audio: { label: "Audio", icon: Headphones, color: "text-primary", badgeClass: "bg-primary/5 text-primary border-primary/10" },
  audible: { label: "Audible", icon: Headphones, color: "text-orange-500", badgeClass: "bg-orange-50 text-orange-600 border-orange-100" },
  audiolib: { label: "Audiolib", icon: Headphones, color: "text-blue-400", badgeClass: "bg-blue-50 text-blue-500 border-blue-100" },
  autre: { label: "Autre", icon: Bookmark, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
};

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
  pal: { label: "PAL", icon: Bookmark, color: "bg-slate-400" },
  progress: { label: "En cours", icon: RefreshCw, color: "bg-blue-400" },
  read: { label: "Lu", icon: CheckCircle2, color: "bg-emerald-400" },
  dnf: { label: "DNF", icon: DoorOpen, color: "bg-rose-400" },
  pause: { label: "Pause", icon: Pause, color: "bg-amber-400" },
  reread: { label: "Relecture", icon: RefreshCw, color: "bg-purple-400" },
};

const CATEGORIES = [
  { id: "all", label: "TOUS" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "EN COURS" },
  { id: "lu", label: "LU" },
  { id: "termine", label: "TERMINÉ" },
  { id: "dnf", label: "DNF" },
  { id: "pause", label: "PAUSE" },
];

export default function LibraryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: booksRaw = [], loading } = useCollection(booksQuery);

  const books = useMemo(() => {
    return [...booksRaw].sort((a, b) => {
      const dateA = a.dateAdded?.seconds || 0;
      const dateB = b.dateAdded?.seconds || 0;
      return dateB - dateA;
    });
  }, [booksRaw]);

  const counts = useMemo(() => {
    const res: Record<string, number> = { 
      all: books.length, 
      pal: 0, 
      progress: 0, 
      lu: 0, 
      termine: 0,
      dnf: 0,
      pause: 0
    };
    books.forEach(b => {
      if (b.status === 'pal') res.pal++;
      if (b.status === 'progress') res.progress++;
      if (b.status === 'read') {
        res.termine++;
        res.lu++;
      }
      if (b.status === 'reread') res.lu++;
      if (b.status === 'dnf') res.dnf++;
      if (b.status === 'pause') res.pause++;
    });
    return res;
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const b = book as Book;
      const matchesSearch = String(b.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           String(b.author || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                           String(b.isbn || "").includes(searchQuery);
      if (!matchesSearch) return false;
      
      const matchesFormat = selectedFormat === "all" || b.format === selectedFormat;
      if (!matchesFormat) return false;

      if (activeTab === "all") return true;
      if (activeTab === "lu") return b.status === "read" || b.status === "reread";
      if (activeTab === "termine") return b.status === "read";
      return b.status === activeTab;
    });
  }, [activeTab, searchQuery, selectedFormat, books]);

  return (
    <div className="space-y-10 animate-paper pb-32">
      <header className="space-y-8 pt-4">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-headline tracking-tight italic">Ma Bibliothèque</h1>
          <p className="text-primary/60 italic font-medium">Votre univers littéraire centralisé.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Chercher un titre, auteur ou ISBN..." 
              className="pl-12 h-14 bg-white/60 border-white shadow-sm focus-visible:ring-primary/20 rounded-2xl italic text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-14 rounded-2xl bg-white/60 border-white flex gap-3 font-headline italic px-6 shrink-0 shadow-sm hover:bg-white">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Format
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 glass-card border-none p-3" align="end">
                <div className="flex flex-col gap-1.5">
                  <Button variant="ghost" className="justify-start font-headline italic text-sm rounded-xl" onClick={() => setSelectedFormat('all')}>Tous les formats</Button>
                  {Object.entries(FORMATS).map(([key, value]) => (
                    <Button 
                      key={key} 
                      variant="ghost" 
                      className={cn("justify-start font-headline italic text-sm flex gap-3 rounded-xl", selectedFormat === key && "bg-primary/5 text-primary")}
                      onClick={() => setSelectedFormat(key as BookFormat)}
                    >
                      <value.icon className="h-4 w-4" />
                      {value.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex p-1 bg-white/40 rounded-2xl border border-white shrink-0 shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("rounded-xl h-12 w-12", viewMode === 'grid' && "bg-white text-primary shadow-sm")}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("rounded-xl h-12 w-12", viewMode === 'list' && "bg-white text-primary shadow-sm")}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-5 w-5" />
                </Button>
            </div>

            <Button asChild className="rounded-2xl bg-primary hover:bg-primary/90 h-14 px-8 shadow-xl shadow-primary/10 font-headline italic text-xl flex-1 md:flex-none">
              <Link href="/add">
                <Plus className="mr-2 h-6 w-6" />
                Ajouter
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <div className="max-w-4xl mx-auto">
          <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b border-primary/5 p-0 rounded-none gap-10 no-scrollbar mb-10">
            {CATEGORIES.map((cat) => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 font-headline text-xl px-2 flex items-center gap-3 whitespace-nowrap transition-all opacity-40 data-[state=active]:opacity-100"
              >
                {cat.label}
                <Badge variant="secondary" className="h-6 px-2 min-w-[1.5rem] flex items-center justify-center text-xs bg-primary/5 text-primary border-none font-bold rounded-full">
                  {counts[cat.id as keyof typeof counts] || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          {loading ? (
            <div className="py-40 text-center flex flex-col items-center gap-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
              <p className="font-headline italic text-primary/40 text-xl">Exploration de votre sanctuaire...</p>
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className={cn(
              "animate-paper",
              viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10" 
                : "flex flex-col gap-4 max-w-4xl mx-auto"
            )}>
              {filteredBooks.map((book) => (
                <Link key={book.id} href={`/book/${book.id}`} className="group">
                  {viewMode === 'grid' ? (
                    <BookCard book={book as Book} />
                  ) : (
                    <BookListItem book={book as Book} />
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-40 text-center space-y-8 glass-card border-dashed bg-white/20">
               <Bookmark className="h-20 w-20 mx-auto text-primary/10 animate-float" />
               <div className="space-y-3">
                 <p className="text-primary/60 italic font-headline text-3xl mb-2">Sanctuaire paisible.</p>
                 <p className="text-muted-foreground italic text-lg">Cette section attend sa première pépite.</p>
                 <Button asChild variant="link" className="text-primary italic text-lg mt-4">
                   <Link href="/add">Commencer une nouvelle collection ?</Link>
                 </Button>
               </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BookCard({ book }: { book: Book }) {
  const rank = book.rank ? RANKS[book.rank] : null;
  const format = book.format ? FORMATS[book.format] : null;
  const RankIcon = rank?.icon;
  const FormatIcon = format?.icon;

  return (
    <div className="space-y-4 group">
      <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-sm border border-white/60 group-hover:shadow-2xl transition-all duration-700 group-hover:-translate-y-2 bg-secondary/5 flex items-center justify-center p-3">
        <div className="relative w-full h-full">
          <Image 
            src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
            alt={book.title} 
            fill 
            className="object-contain transition-transform duration-1000 group-hover:scale-105" 
            sizes="200px"
          />
        </div>
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="absolute top-3 left-3 flex flex-col gap-2 items-start opacity-0 group-hover:opacity-100 transition-opacity duration-500">
           {format && (
             <Badge className={cn("text-[8px] font-bold px-3 py-1 rounded-full border shadow-lg uppercase backdrop-blur-md", format.badgeClass)}>
               <FormatIcon className="h-2.5 w-2.5 mr-1.5" /> {format.label}
             </Badge>
           )}
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <div className={cn(
            "text-[8px] font-bold px-3 py-1 rounded-full text-white shadow-lg uppercase",
            STATUSES[book.status]?.color || "bg-slate-400"
          )}>
            {STATUSES[book.status]?.label}
          </div>
          {book.dePlume && (
            <div className="bg-white/95 p-2 rounded-full shadow-lg border border-primary/20 animate-pulse">
              <Heart className="h-3 w-3 text-primary fill-primary" />
            </div>
          )}
          {rank && (
            <div className="bg-white/95 p-2 rounded-full shadow-lg border border-primary/10">
              <RankIcon className={cn("h-4 w-4", rank.color)} />
            </div>
          )}
        </div>
      </div>
      <div className="text-center px-2 space-y-1">
        <h3 className="text-sm font-headline line-clamp-1 italic text-foreground/90 leading-tight group-hover:text-primary transition-colors">{book.title}</h3>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-80">{book.author}</p>
        {book.series && (
          <p className="text-[8px] text-primary/40 font-bold uppercase tracking-[0.2em] italic truncate">{book.series} #{book.volume}</p>
        )}
      </div>
    </div>
  );
}

function BookListItem({ book }: { book: Book }) {
  const format = book.format ? FORMATS[book.format] : null;
  const FormatIcon = format?.icon;

  return (
    <Card className="glass-card hover:bg-white/90 transition-all border-none overflow-hidden group">
      <CardContent className="p-4 flex gap-6 items-center">
        <div className="relative h-20 w-14 shrink-0 rounded-xl overflow-hidden shadow-sm bg-secondary/5">
          <Image src={book.cover || "https://picsum.photos/seed/p/200/300"} alt={book.title} fill className="object-cover" sizes="100px" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-headline italic text-lg leading-tight truncate">{book.title}</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{book.author}</p>
          <div className="flex gap-4 pt-1">
            {book.series && <span className="text-[9px] text-primary italic font-bold uppercase tracking-widest">{book.series} #{book.volume}</span>}
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {STATUSES[book.status]?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 pr-2">
           {format && <Badge variant="outline" className={cn("rounded-full text-[8px] px-3", format.badgeClass)}><FormatIcon className="h-2.5 w-2.5 mr-1" /> {format.label}</Badge>}
           {book.dePlume && <Heart className="h-5 w-5 text-primary fill-primary" />}
        </div>
      </CardContent>
    </Card>
}
