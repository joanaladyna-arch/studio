
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/tabs";
import { Input } from "@/components/ui/input";
import { Search, Filter, Heart, Diamond, Crown, Star, Sparkles, BookText, Wind, Trash2, DoorOpen, Pause, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";

export type RankType = 'diamant' | 'royale' | 'doree' | 'argentee' | 'simple' | 'froissee' | 'brisee' | 'dnf';
export type EmotionBadgeType = 'obsession' | 'larmes' | 'doudou' | 'epicee' | 'plot-twist' | 'addictif' | 'inoubliable' | 'reflexion' | 'romance-mem' | 'fantasy';
export type BookStatus = "pal" | "progress" | "read" | "dnf" | "pause" | "reread";

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  favorite: boolean;
  cover: string;
  rank?: RankType;
  badges?: EmotionBadgeType[];
  review?: string;
  citation?: string;
  progress?: number;
}

export const RANKS: Record<RankType, { label: string, icon: any, color: string, description: string }> = {
  diamant: { label: "Diamant de Plume", icon: Diamond, color: "text-cyan-400", description: "Coup de cœur absolu" },
  royale: { label: "Plume Royale", icon: Crown, color: "text-amber-500", description: "Livre exceptionnel" },
  doree: { label: "Plume Dorée", icon: Star, color: "text-yellow-400", description: "Excellente lecture" },
  argentee: { label: "Plume Argentée", icon: Sparkles, color: "text-slate-300", description: "Très bonne lecture" },
  simple: { label: "Plume Simple", icon: BookText, color: "text-primary", description: "Lecture agréable" },
  froissee: { label: "Plume Froissée", icon: Wind, color: "text-muted-foreground", description: "Avis mitigé" },
  brisee: { label: "Plume Brisée", icon: Trash2, color: "text-destructive", description: "Je n'ai pas aimé" },
  dnf: { label: "DNF", icon: DoorOpen, color: "text-slate-800", description: "Livre non terminé ou pas aimé" },
};

export const EMOTIONS: Record<EmotionBadgeType, { label: string, color: string, icon: string }> = {
  obsession: { label: "Obsession Littéraire", color: "bg-purple-50 text-purple-700 border-purple-100", icon: "🔥" },
  larmes: { label: "Larmes Garanties", color: "bg-blue-50 text-blue-700 border-blue-100", icon: "😭" },
  doudou: { label: "Livre Doudou", color: "bg-green-50 text-green-700 border-green-100", icon: "☕" },
  epicee: { label: "Romance Épicée", color: "bg-red-50 text-red-700 border-red-100", icon: "🌶️" },
  "plot-twist": { label: "Plot Twist Mémorable", color: "bg-orange-50 text-orange-700 border-orange-100", icon: "🎭" },
  addictif: { label: "Univers Addictif", color: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: "🌍" },
  inoubliable: { label: "Personnages Inoubliables", color: "bg-pink-50 text-pink-700 border-pink-100", icon: "🫶" },
  reflexion: { label: "M'a fait réfléchir", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: "🧠" },
  "romance-mem": { label: "Romance mémorable", color: "bg-rose-50 text-rose-700 border-rose-100", icon: "💘" },
  fantasy: { label: "Fantasy immersive", color: "bg-sky-50 text-sky-700 border-sky-100", icon: "🐉" },
};

export const STATUSES: Record<BookStatus, { label: string, icon: any, color: string }> = {
  pal: { label: "PAL", icon: BookText, color: "bg-slate-400" },
  progress: { label: "En cours", icon: RefreshCw, color: "bg-blue-400" },
  read: { label: "Lu", icon: Sparkles, color: "bg-emerald-400" },
  dnf: { label: "DNF", icon: DoorOpen, color: "bg-rose-400" },
  pause: { label: "Pause", icon: Pause, color: "bg-amber-400" },
  reread: { label: "Relecture", icon: RefreshCw, color: "bg-purple-400" },
};

export const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "En cours" },
  { id: "read", label: "Lu" },
  { id: "dnf", label: "DNF" },
  { id: "pause", label: "Pause" },
  { id: "reread", label: "Relecture" },
  { id: "favorite", label: "Favoris" },
];

export default function LibraryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const counts = useMemo(() => {
    const res: Record<string, number> = {
      all: books.length,
      pal: 0,
      progress: 0,
      read: 0,
      dnf: 0,
      pause: 0,
      reread: 0,
      favorite: 0,
    };
    books.forEach(b => {
      if (b.status) res[b.status]++;
      if (b.favorite) res.favorite++;
    });
    return res;
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = (book.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (book.author || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      if (activeTab === "all") return true;
      if (activeTab === "favorite") return book.favorite;
      return book.status === activeTab;
    });
  }, [activeTab, searchQuery, books]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <Navigation />

      <header className="space-y-6">
        <div className="text-center">
          <h1 className="text-5xl font-headline tracking-tight">Ma Bibliothèque</h1>
          <p className="text-primary/60 italic mt-2 font-medium">“Chaque livre est un souvenir précieux.”</p>
        </div>
        
        <div className="flex gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Chercher une pépite..." 
              className="pl-10 h-12 bg-white/40 border-white/60 focus-visible:ring-primary/30 rounded-2xl shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="h-12 w-12 flex items-center justify-center bg-white/40 border border-white/60 rounded-2xl hover:bg-white/60 transition-all shadow-sm">
            <Filter className="h-5 w-5 text-primary/40" />
          </button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b border-primary/5 p-0 rounded-none gap-6 no-scrollbar mb-8">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 font-headline text-lg px-2 flex items-center gap-2 whitespace-nowrap transition-all opacity-50 data-[state=active]:opacity-100"
            >
              {cat.label}
              <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] bg-primary/5 text-primary border-none font-bold">
                {counts[cat.id] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="py-32 text-center text-muted-foreground italic">Chargement de votre bibliothèque...</div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
              {filteredBooks.map((book) => (
                <BookCard key={book.id} book={book as Book} />
              ))}
            </div>
          ) : (
            <div className="py-32 text-center space-y-6">
               <BookText className="h-16 w-16 mx-auto text-primary/10" />
               <p className="text-muted-foreground italic text-lg">Aucun livre ne correspond à tes critères.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BookCard({ book }: { book: Book }) {
  const rank = book.rank ? RANKS[book.rank] : null;
  const RankIcon = rank?.icon;

  return (
    <div className="space-y-4 group">
      <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-sm border border-white/40 group-hover:shadow-2xl transition-all duration-700 group-hover:-translate-y-2">
        <Image src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={book.title} fill className="object-cover transition-transform duration-1000 group-hover:scale-110" />
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <StatusBadge status={book.status} />
          {book.favorite && (
            <div className="bg-white/95 p-1.5 rounded-full shadow-lg border border-primary/10">
              <Heart className="h-3 w-3 text-primary fill-primary" />
            </div>
          )}
          {rank && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white/95 p-2 rounded-full shadow-lg border border-primary/5 transition-transform duration-500 hover:rotate-12">
                    <RankIcon className={cn("h-4 w-4", rank.color)} />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-white/95 backdrop-blur-xl text-foreground border shadow-2xl rounded-2xl p-3">
                  <p className="font-headline text-lg">{rank.label}</p>
                  <p className="text-xs italic opacity-70">{rank.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/30 backdrop-blur-md border-t border-white/40 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
           <div className="flex flex-wrap gap-1.5">
              {book.badges?.slice(0, 2).map(b => (
                <span key={b} className="text-[9px] px-2 py-1 rounded-full bg-white/80 text-foreground shadow-sm flex items-center gap-1 font-bold">
                  {EMOTIONS[b]?.icon} {EMOTIONS[b]?.label.split(' ')[0]}
                </span>
              ))}
           </div>
        </div>
      </div>
      <div className="text-center px-1">
        <h3 className="text-lg font-headline line-clamp-1 italic text-foreground/90">{book.title}</h3>
        <p className="text-[10px] text-primary/50 font-bold uppercase tracking-widest mt-0.5">{book.author}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookStatus }) {
  const config = STATUSES[status];
  if (!config) return null;
  return (
    <Badge className={cn("text-[9px] font-bold border-none px-2.5 py-0.5 h-5 text-center text-white rounded-full shadow-lg", config.color)}>
      {config.label}
    </Badge>
  );
}
