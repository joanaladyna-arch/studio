
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Heart, Diamond, Crown, Star, Sparkles, BookText, Wind, Trash2, DoorOpen, Pause, RefreshCw, Plus, Book as BookIcon, Tablet, Headphones, SlidersHorizontal, Loader2 } from "lucide-react";
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
export type BookFormat = "papier" | "ebook" | "audio";

export interface Book {
  id: string;
  title: string;
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
  pages?: number;
  duration?: number;
  narrator?: string;
  format?: BookFormat;
  status: BookStatus;
  favorite: boolean;
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
  createdAt?: any;
}

export const GENRES_LIST = [
  "Romance", "Dark Romance", "Thriller", "Fantasy", "Romantasy", "Sci-Fi", "Contemporain", "Historique", "Horreur", "Classiques", "Manga", "Non Fiction"
];

export const TROPES_LIST = [
  "Soulmates", "Forbidden Love", "Enemies to Lovers", "Fake Dating", "Slow Burn", "Found Family", "Morally Grey", "Small Town"
];

export const FORMATS: Record<BookFormat, { label: string, icon: any, color: string, badgeClass: string }> = {
  papier: { label: "Papier", icon: BookIcon, color: "text-amber-800", badgeClass: "bg-orange-50 text-orange-700 border-orange-100" },
  ebook: { label: "Ebook", icon: Tablet, color: "text-accent-foreground", badgeClass: "bg-accent/10 text-accent-foreground border-accent/20" },
  audio: { label: "Audio", icon: Headphones, color: "text-primary", badgeClass: "bg-primary/5 text-primary border-primary/10" },
};

export const EMOTIONS: Record<string, { label: string, icon: string }> = {
  "Bouleversé": { label: "Bouleversé", icon: "🎭" },
  "Inspiré": { label: "Inspiré", icon: "✨" },
  "Passionné": { label: "Passionné", icon: "❤️" },
  "Amusé": { label: "Amusé", icon: "😊" },
  "Intrigué": { label: "Intrigué", icon: "🔍" },
  "Serein": { label: "Serein", icon: "🌿" },
  "Mélancolique": { label: "Mélancolique", icon: "🎻" },
  "Révolté": { label: "Révolté", icon: "⚡" },
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
  { id: "dnf", label: "DNF" },
  { id: "pause", label: "Pause" },
  { id: "favorite", label: "Favoris" },
];

export default function LibraryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat | "all">("all");

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const counts = useMemo(() => {
    const res: Record<string, number> = { all: books.length, pal: 0, progress: 0, read: 0, dnf: 0, pause: 0, favorite: 0 };
    books.forEach(b => {
      if (b.status === 'pal') res.pal++;
      if (b.status === 'progress') res.progress++;
      if (b.status === 'read') res.read++;
      if (b.status === 'dnf') res.dnf++;
      if (b.status === 'pause') res.pause++;
      if (b.favorite) res.favorite++;
    });
    return res;
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const b = book as Book;
      const matchesSearch = String(b.title).toLowerCase().includes(searchQuery.toLowerCase()) || 
                           String(b.author).toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      
      const matchesFormat = selectedFormat === "all" || b.format === selectedFormat;
      if (!matchesFormat) return false;

      if (activeTab === "all") return true;
      if (activeTab === "favorite") return b.favorite;
      return b.status === activeTab;
    });
  }, [activeTab, searchQuery, selectedFormat, books]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-32">
      <header className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-headline tracking-tight">Ma Bibliothèque</h1>
          <p className="text-primary/60 italic font-medium">L'écrin précieux de vos aventures littéraires.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 max-w-3xl mx-auto items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Chercher un titre ou un auteur..." 
              className="pl-10 h-12 bg-white/40 border-white/60 focus-visible:ring-primary/20 rounded-2xl shadow-sm italic"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 rounded-2xl bg-white/40 border-white/60 flex gap-2 font-headline italic px-4 shrink-0">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Format: {selectedFormat === 'all' ? 'Tous' : FORMATS[selectedFormat].label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 glass-card border-none p-2" align="end">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" className="justify-start font-headline italic text-sm" onClick={() => setSelectedFormat('all')}>Tous les formats</Button>
                  {Object.entries(FORMATS).map(([key, value]) => (
                    <Button 
                      key={key} 
                      variant="ghost" 
                      className={cn("justify-start font-headline italic text-sm flex gap-2", selectedFormat === key && "bg-primary/5 text-primary")}
                      onClick={() => setSelectedFormat(key as BookFormat)}
                    >
                      <value.icon className="h-4 w-4" />
                      {value.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button asChild className="rounded-2xl bg-primary hover:bg-primary/90 h-12 px-6 shadow-lg shadow-primary/10 font-headline italic text-lg flex-1 sm:flex-none">
              <Link href="/add">
                <Plus className="mr-2 h-5 w-5" />
                Ajouter
              </Link>
            </Button>
          </div>
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
            <div className="py-32 text-center text-muted-foreground italic flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
              Ouverture de vos étagères...
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
              {filteredBooks.map((book) => (
                <Link key={book.id} href={`/book/${book.id}`} className="group">
                  <BookCard book={book as Book} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center space-y-6">
               <BookText className="h-16 w-16 mx-auto text-primary/10" />
               <div className="space-y-2">
                 <p className="text-muted-foreground italic text-lg">Votre bibliothèque est vide dans cette section.</p>
                 <Button asChild variant="link" className="text-primary italic">
                   <Link href="/add">Commencer une nouvelle collection ?</Link>
                 </Button>
               </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Link href="/add" className="fixed bottom-24 right-6 z-50 group sm:hidden">
        <Button size="icon" className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/40 group-hover:scale-110 transition-transform">
          <Plus className="h-7 w-7" />
        </Button>
      </Link>
    </div>
  );
}

export function BookCard({ book }: { book: Book }) {
  const rank = book.rank ? RANKS[book.rank] : null;
  const format = book.format ? FORMATS[book.format] : FORMATS.papier;
  const RankIcon = rank?.icon;
  const FormatIcon = format.icon;

  return (
    <div className="space-y-4 group">
      <div className="relative aspect-[2/3] rounded-[1.5rem] overflow-hidden shadow-sm border border-white/40 group-hover:shadow-xl transition-all duration-700 group-hover:-translate-y-1.5 bg-secondary/5 flex items-center justify-center p-2">
        <div className="relative w-full h-full">
          <Image 
            src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
            alt={book.title} 
            fill 
            className="object-contain transition-transform duration-1000 group-hover:scale-105" 
            data-ai-hint="book cover"
            sizes="200px"
          />
        </div>
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
           <Badge className={cn("text-[7px] font-bold px-2 py-0.5 rounded-full border shadow-sm uppercase backdrop-blur-md", format.badgeClass)}>
             <FormatIcon className="h-2 w-2 mr-1" /> {format.label}
           </Badge>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
          <div className={cn(
            "text-[7px] font-bold px-2 py-0.5 rounded-full text-white shadow-md uppercase",
            STATUSES[book.status]?.color || "bg-slate-400"
          )}>
            {STATUSES[book.status]?.label}
          </div>
          {book.favorite && (
            <div className="bg-white/95 p-1 rounded-full shadow-md border border-primary/10">
              <Heart className="h-2.5 w-2.5 text-primary fill-primary" />
            </div>
          )}
          {rank && (
            <div className="bg-white/95 p-1.5 rounded-full shadow-md border border-primary/5">
              <RankIcon className={cn("h-3 w-3", rank.color)} />
            </div>
          )}
        </div>
      </div>
      <div className="text-center px-1 space-y-0.5">
        <h3 className="text-[13px] font-headline line-clamp-1 italic text-foreground/90 leading-tight">{book.title}</h3>
        <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-80">{book.author}</p>
        <div className="flex flex-col gap-0.5">
           {book.publisher && (
             <p className="text-[7px] text-primary/40 font-bold uppercase tracking-[0.2em] italic truncate">{book.publisher}</p>
           )}
        </div>
      </div>
    </div>
  );
}
