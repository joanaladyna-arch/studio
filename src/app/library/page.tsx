
"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  Bookmark,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Pause,
  DoorOpen,
  Book as BookIcon,
  Tablet,
  Smartphone,
  Headphones,
  Diamond,
  Crown,
  Award,
  Medal,
  Feather,
  Meh,
  Frown,
  Heart
} from "lucide-react";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import Link from "next/link";

export type RankType = 'diamant' | 'royale' | 'doree' | 'argentee' | 'simple' | 'froissee' | 'brisee' | 'dnf';
export type BookStatus = "pal" | "progress" | "read" | "dnf" | "pause" | "reread" | "envie";
export type BookFormat = "papier" | "ebook" | "kindle" | "kobo" | "audio" | "audible" | "audiolib" | "autre";

export interface MasterBook {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  translator?: string;
  cover: string;
  description?: string;
  pages?: number;
  pageCount?: number;
  language?: string;
  publishedDate?: string;
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  genres?: string[];
  tropes?: string[];
  themes?: string[];
  volume?: string;
}

export interface UserBook {
  id: string;
  masterBookId: string;
  status: BookStatus;
  format: BookFormat;
  rating?: number;
  review?: string;
  plumeRank?: RankType;
  dateAdded: any;
  title?: string; 
  author?: string;
  cover?: string;
  genres?: string[];
  tropes?: string[];
  themes?: string[];
  volume?: string;
  spicyLevel?: number;
  releaseDateUS?: string;
  releaseDateFR?: string;
  releaseDateUE?: string;
  description?: string;
  referenceLink?: string;
  progress?: number;
  detailedRatings?: {
    intrigue?: number;
    personnages?: number;
    ecriture?: number;
    rythme?: number;
    chimie?: number;
    tension?: number;
    developpement?: number;
  };
  pagesRead?: number;
  favorite?: boolean;
  dePlume?: boolean;
  emotions?: string[];
  favoriteQuote?: string;
  favoriteCharacter?: string;
  readStartDate?: string;
  readEndDate?: string;
}

export type Book = UserBook;

export const GENRES_LIST = [
  "Romance contemporaine", "Dark romance", "Fantasy", "Romantasy", "New romance", 
  "Young adult", "New adult", "Thriller", "Suspense", "Policier", "Mystère", 
  "Science-fiction", "Dystopie", "Historique", "Drame", "Développement personnel", 
  "Témoignage", "Biographie", "Manga", "BD", "Poésie"
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

// Les thèmes principaux décrivent de QUOI parle le livre sur le fond
// (sujets, contexte, propos) — à ne pas confondre avec les tropes, qui
// décrivent un schéma narratif de la relation amoureuse.
export const THEMES_LIST = [
  "Amour", "Amour possessif", "Romance érotique", "Trahison", "Secrets",
  "Espionnage", "École militaire", "Université", "Humour", "Famille",
  "Amitié", "Vengeance", "Rédemption", "Pouvoir", "Justice", "Guerre",
  "Crime organisé", "Survie", "Identité", "Deuil", "Résilience",
  "Manipulation", "Jalousie", "Liberté", "Sacrifice", "Loyauté",
  "Addiction", "Santé mentale", "Reconstruction de soi", "Littérature française",
  "Politique", "Religion et foi", "Mythologie et légendes", "Milieu artistique",
  "Milieu médical", "Adapté au cinéma", "Adapté en série/film", "Sport",
  "Voyage", "Confiance en soi", "Mariage", "Divorce", "Maternité et parentalité",
  "Richesse et pouvoir économique", "Différence culturelle", "Féminisme",
  "Nostalgie", "Destin", "Corruption", "Abus de pouvoir", "Harcèlement",
  "Narcotrafic", "Prison et incarcération", "Période historique", "Huis clos",
  "Course contre le temps"
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

export const STATUSES: Record<BookStatus, { label: string, icon: any, color: string }> = {
  pal: { label: "PAL", icon: Bookmark, color: "bg-slate-400" },
  progress: { label: "En cours", icon: RefreshCw, color: "bg-blue-400" },
  read: { label: "Lu", icon: CheckCircle2, color: "bg-emerald-400" },
  dnf: { label: "DNF", icon: DoorOpen, color: "bg-rose-400" },
  pause: { label: "Pause", icon: Pause, color: "bg-amber-400" },
  reread: { label: "Relecture", icon: RefreshCw, color: "bg-purple-400" },
  envie: { label: "Envie", icon: Heart, color: "bg-pink-400" },
};

// Grades de prestige "Plume" (du meilleur au moins bon). Utilisés par la
// fiche livre, "Cœur de Plume" et le partage BookTok.
export const RANKS: Record<RankType, { label: string, icon: any, color: string }> = {
  diamant: { label: "Diamant de Plume", icon: Diamond, color: "text-cyan-400" },
  royale: { label: "Plume Royale", icon: Crown, color: "text-amber-500" },
  doree: { label: "Plume Dorée", icon: Award, color: "text-yellow-500" },
  argentee: { label: "Plume Argentée", icon: Medal, color: "text-slate-400" },
  simple: { label: "Plume Simple", icon: Feather, color: "text-muted-foreground" },
  froissee: { label: "Plume Froissée", icon: Meh, color: "text-orange-400" },
  brisee: { label: "Plume Brisée", icon: Frown, color: "text-rose-400" },
  dnf: { label: "DNF", icon: DoorOpen, color: "text-rose-500" },
};

// Émotions ressenties à la lecture, utilisées par la fiche de partage BookTok.
export const EMOTIONS: Record<string, { icon: string, label: string }> = {
  coupdecoeur: { icon: "😍", label: "Coup de cœur" },
  larmes: { icon: "😭", label: "En larmes" },
  frissons: { icon: "🥶", label: "Frissons" },
  rire: { icon: "😂", label: "Fou rire" },
  colere: { icon: "😡", label: "Colère" },
  espoir: { icon: "🌸", label: "Espoir" },
  nostalgie: { icon: "🌙", label: "Nostalgie" },
  suspense: { icon: "😰", label: "Suspense" },
};

const CATEGORIES = [
  { id: "all", label: "TOUS" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "EN COURS" },
  { id: "read", label: "LU" },
  { id: "envie", label: "ENVIE" },
  { id: "dnf", label: "DNF" },
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

  const { data: userBooks = [], loading } = useCollection<UserBook>(booksQuery);

  const filteredBooks = useMemo(() => {
    return userBooks.filter(b => {
      const matchesSearch = (b.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (b.author || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "all") return matchesSearch;
      return b.status === activeTab && matchesSearch;
    });
  }, [userBooks, activeTab, searchQuery]);

  return (
    <div className="space-y-10 animate-paper pb-32">
      <header className="space-y-8 pt-4">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-headline tracking-tight italic">Ma Bibliothèque</h1>
          <p className="text-primary/60 italic font-medium">Votre univers littéraire centralisé.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
            <Input 
              placeholder="Chercher un titre ou auteur..." 
              className="pl-12 h-14 bg-white/60 border-white rounded-2xl italic text-lg shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Button asChild className="rounded-2xl bg-primary h-14 px-8 shadow-xl font-headline italic text-xl">
            <Link href="/add"><Plus className="mr-2 h-6 w-6" /> Ajouter</Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b border-primary/5 p-0 mb-10 gap-10 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 font-headline text-xl px-2 opacity-40 data-[state=active]:opacity-100"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {loading ? (
            <div className="py-40 text-center flex flex-col items-center gap-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
              <p className="font-headline italic text-primary/40 text-xl">Exploration de la réserve...</p>
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
              {filteredBooks.map((book) => (
                <Link key={book.id} href={`/book/${book.id}`} className="group">
                  <BookCard book={book} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-40 text-center glass-card border-dashed bg-white/20">
               <Bookmark className="h-20 w-20 mx-auto text-primary/10" />
               <p className="text-primary/60 italic font-headline text-2xl mt-4">Votre bibliothèque est paisible.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BookCard({ book }: { book: UserBook }) {
  return (
    <div className="space-y-4 group cursor-pointer">
      <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-sm border border-white/60 group-hover:shadow-2xl transition-all duration-700 bg-secondary/5 flex items-center justify-center">
        <BookCover
          src={book.cover}
          alt={book.title || ""} 
          className="object-contain transition-transform duration-1000 group-hover:scale-105" 
        />
        <div className="absolute top-3 right-3">
          <Badge className={cn("text-[8px] font-bold uppercase", STATUSES[book.status]?.color)}>
            {STATUSES[book.status]?.label}
          </Badge>
        </div>
      </div>
      <div className="text-center px-2">
        <h3 className="text-sm font-headline line-clamp-1 italic">
          {cleanBookTitle(book.title)}{(book as any).volume ? ` — ${(book as any).volume}` : ""}
        </h3>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{cleanAuthorName(book.author)}</p>
      </div>
    </div>
  );
}
