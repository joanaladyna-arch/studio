"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Filter, Heart, Diamond, Crown, Star, Sparkles, BookText, Wind, Trash2, DoorOpen, Pause, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  dnf: { label: "DNF", icon: DoorOpen, color: "text-slate-800", description: "Livre non terminé" },
};

export const EMOTIONS: Record<EmotionBadgeType, { label: string, color: string, icon: string }> = {
  obsession: { label: "Obsession Littéraire", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "🔥" },
  larmes: { label: "Larmes Garanties", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "😭" },
  doudou: { label: "Livre Doudou", color: "bg-green-100 text-green-700 border-green-200", icon: "☕" },
  epicee: { label: "Romance Épicée", color: "bg-red-100 text-red-700 border-red-200", icon: "🌶️" },
  "plot-twist": { label: "Plot Twist Mémorable", color: "bg-orange-100 text-orange-700 border-orange-200", icon: "🎭" },
  addictif: { label: "Univers Addictif", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "🌍" },
  inoubliable: { label: "Personnages Inoubliables", color: "bg-pink-100 text-pink-700 border-pink-200", icon: "🫶" },
  reflexion: { label: "M'a fait réfléchir", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "🧠" },
  "romance-mem": { label: "Romance mémorable", color: "bg-rose-100 text-rose-700 border-rose-200", icon: "💘" },
  fantasy: { label: "Fantasy immersive", color: "bg-sky-100 text-sky-700 border-sky-200", icon: "🐉" },
};

export const STATUSES: Record<BookStatus, { label: string, icon: any, color: string }> = {
  pal: { label: "PAL", icon: BookText, color: "bg-slate-500" },
  progress: { label: "En cours", icon: RefreshCw, color: "bg-blue-500" },
  read: { label: "Lu", icon: Sparkles, color: "bg-emerald-500" },
  dnf: { label: "DNF", icon: DoorOpen, color: "bg-rose-500" },
  pause: { label: "Pause", icon: Pause, color: "bg-amber-500" },
  reread: { label: "Relecture", icon: RefreshCw, color: "bg-purple-500" },
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

// Mock data for initial view
export const MOCK_BOOKS: Book[] = [
  { id: "1", title: "L'élégance du hérisson", author: "Muriel Barbery", status: "progress", favorite: true, cover: "https://picsum.photos/seed/10/200/300", rank: 'diamant', badges: ['obsession', 'inoubliable', 'reflexion'], citation: "Le mouvement de la vie n'a d'intérêt que si on le regarde...", progress: 65 },
  { id: "2", title: "La vérité sur l'affaire Harry Quebert", author: "Joël Dicker", status: "read", favorite: true, cover: "https://picsum.photos/seed/11/200/300", rank: 'royale', badges: ['plot-twist', 'addictif'] },
  { id: "3", title: "Sapiens", author: "Yuval Noah Harari", status: "pal", favorite: false, cover: "https://picsum.photos/seed/12/200/300", rank: 'simple' },
  { id: "4", title: "Moby Dick", author: "Herman Melville", status: "dnf", favorite: false, cover: "https://picsum.photos/seed/13/200/300", rank: 'dnf' },
  { id: "5", title: "Fourth Wing", author: "Rebecca Yarros", status: "read", favorite: true, cover: "https://picsum.photos/seed/14/200/300", rank: 'diamant', badges: ['fantasy', 'epicee', 'addictif'] },
  { id: "6", title: "The Seven Husbands of Evelyn Hugo", author: "Taylor Jenkins Reid", status: "read", favorite: true, cover: "https://picsum.photos/seed/15/200/300", rank: 'royale', badges: ['larmes', 'inoubliable'] },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(() => ({
    all: MOCK_BOOKS.length,
    pal: MOCK_BOOKS.filter(b => b.status === 'pal').length,
    progress: MOCK_BOOKS.filter(b => b.status === 'progress').length,
    read: MOCK_BOOKS.filter(b => b.status === 'read').length,
    dnf: MOCK_BOOKS.filter(b => b.status === 'dnf').length,
    pause: MOCK_BOOKS.filter(b => b.status === 'pause').length,
    reread: MOCK_BOOKS.filter(b => b.status === 'reread').length,
    favorite: MOCK_BOOKS.filter(b => b.favorite).length,
  }), []);

  const filteredBooks = useMemo(() => {
    return MOCK_BOOKS.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           book.author.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      if (activeTab === "all") return true;
      if (activeTab === "favorite") return book.favorite;
      return book.status === activeTab;
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="space-y-4">
        <h1 className="text-4xl font-headline">Ma Bibliothèque</h1>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un titre ou un auteur..." 
              className="pl-9 bg-muted/50 border-none focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="p-2 border rounded-lg hover:bg-muted transition-colors">
            <Filter className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b p-0 rounded-none gap-4 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 font-medium px-2 flex items-center gap-2 whitespace-nowrap"
            >
              {cat.label}
              <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] bg-muted">
                {counts[cat.id as keyof typeof counts] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filteredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-2">
              <p className="text-muted-foreground">Aucun livre trouvé ici.</p>
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
    <div className="space-y-2 group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-500">
        <Image src={book.cover} alt={book.title} fill className="object-cover" />
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <StatusBadge status={book.status} />
          {book.favorite && (
            <div className="bg-white/90 p-1 rounded-full shadow-sm">
              <Heart className="h-3 w-3 text-red-500 fill-red-500" />
            </div>
          )}
          {rank && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white/90 p-1.5 rounded-full shadow-sm">
                    <RankIcon className={cn("h-4 w-4", rank.color)} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">{rank.label}</p>
                  <p className="text-xs opacity-70">{rank.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {/* Emotional Badges Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="flex flex-wrap gap-1">
              {book.badges?.map(b => (
                <span key={b} className="text-[8px] px-1 py-0.5 rounded bg-white/20 text-white backdrop-blur-sm border border-white/30 flex items-center gap-0.5">
                  {EMOTIONS[b].icon} {EMOTIONS[b].label}
                </span>
              ))}
           </div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold line-clamp-1">{book.title}</h3>
        <p className="text-xs text-muted-foreground">{book.author}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookStatus }) {
  const config = STATUSES[status];
  return (
    <Badge className={cn("text-[9px] font-bold border-none px-1.5 py-0 text-center text-white", config.color)}>
      {config.label}
    </Badge>
  );
}