
"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MasterBookEditor } from "@/components/master-book-editor";
import { MasterBookManager } from "@/components/master-book-manager";
import { AdminCatalogView } from "@/components/admin-catalog-view";
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
  Sparkles,
  Meh,
  Frown,
  Heart,
  Pencil,
  UserRound,
  Layers,
  ChevronDown,
  ChevronUp,
  Pin,
  Dices,
  ListOrdered
} from "lucide-react";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, cleanBookTitle, cleanAuthorName, ADMIN_EMAILS, sortBySaga, sortByAuthor } from "@/lib/utils";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { collection, doc, getDoc, updateDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
  saga?: string;
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
  dateRead?: any;
  isNextRead?: boolean;
  palOrder?: number;
  toGift?: boolean;
  summerReread?: boolean;
  title?: string; 
  author?: string;
  cover?: string;
  genres?: string[];
  tropes?: string[];
  themes?: string[];
  volume?: string;
  saga?: string;
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
  envie: { label: "Wishlist", icon: Heart, color: "bg-pink-400" },
};

// Grades de prestige "Palme" (du meilleur au moins bon). Utilisés par la
// fiche livre, "Coups de Cœur" et le partage BookTok.
export const RANKS: Record<RankType, { label: string, icon: any, color: string }> = {
  diamant: { label: "Palme Éternelle", icon: Sparkles, color: "text-cyan-400" },
  royale: { label: "Palme de Diamant", icon: Diamond, color: "text-amber-500" },
  doree: { label: "Palme Royale", icon: Crown, color: "text-yellow-500" },
  argentee: { label: "Palme d'Or", icon: Award, color: "text-slate-400" },
  simple: { label: "Palme d'Argent", icon: Medal, color: "text-muted-foreground" },
  froissee: { label: "Palme de Bronze", icon: Meh, color: "text-orange-400" },
  brisee: { label: "Palme de Cuivre", icon: Frown, color: "text-rose-400" },
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
  { id: "envie", label: "WISHLIST" },
  { id: "dnf", label: "DNF" },
];

const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function LibraryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { adminMode } = useAdminMode();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"saga" | "author" | "manual">("saga");
  const [isReordering, setIsReordering] = useState<string | null>(null);
  const [drawnBook, setDrawnBook] = useState<any | null>(null);
  const [isPinningDraw, setIsPinningDraw] = useState(false);
  const isAdmin = adminMode;
  const [editingMasterBook, setEditingMasterBook] = useState<any | null>(null);
  const [isLoadingEditBook, setIsLoadingEditBook] = useState(false);

  const openMasterEditor = async (masterBookId?: string) => {
    if (!db || !masterBookId) {
      toast({ variant: "destructive", title: "Fiche non liée à la base partagée" });
      return;
    }
    setIsLoadingEditBook(true);
    try {
      const snap = await getDoc(doc(db, "masterBooks", masterBookId));
      if (snap.exists()) setEditingMasterBook({ id: snap.id, ...snap.data() });
      else toast({ variant: "destructive", title: "Fiche introuvable dans la base partagée" });
    } catch (err) {
      console.error("Load MasterBook Error:", err);
      toast({ variant: "destructive", title: "Erreur de chargement" });
    } finally {
      setIsLoadingEditBook(false);
    }
  };

  // Épingle un livre de la PAL comme "Prochaine lecture" — un seul
  // livre épinglé à la fois, donc on désépingle d'abord tout autre
  // livre qui le serait déjà avant de poser la nouvelle épingle. Le
  // décrochage automatique quand la lecture démarre est géré côté
  // fiche livre (handleSave), pas ici.
  const [isPinning, setIsPinning] = useState<string | null>(null);
  const togglePinNextRead = async (bookId: string, currentlyPinned: boolean) => {
    if (!db || !user) return;
    setIsPinning(bookId);
    try {
      if (!currentlyPinned) {
        const pinnedSnap = await getDocs(query(collection(db, "users", user.uid, "books"), where("isNextRead", "==", true)));
        if (!pinnedSnap.empty) {
          const batch = writeBatch(db);
          pinnedSnap.docs.forEach((d) => batch.update(d.ref, { isNextRead: false }));
          await batch.commit();
        }
      }
      await updateDoc(doc(db, "users", user.uid, "books", bookId), { isNextRead: !currentlyPinned });
    } catch (err) {
      console.error("Toggle Pin Next Read Error:", err);
      toast({ variant: "destructive", title: "Erreur lors de l'épinglage" });
    } finally {
      setIsPinning(null);
    }
  };

  // Déplace un livre d'un cran dans l'ordre personnalisé de la PAL. Si
  // aucun livre du groupe n'a encore de palOrder (première utilisation),
  // on initialise tout le monde sur l'ordre d'affichage actuel avant de
  // déplacer, pour que le réordonnancement parte d'une base cohérente
  // plutôt que de valeurs vides désordonnées.
  const moveBookInPal = async (bookId: string, direction: "up" | "down") => {
    if (!db || !user || isReordering) return;
    const palBooks = filteredBooks;
    const index = palBooks.findIndex((b) => b.id === bookId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= palBooks.length) return;

    setIsReordering(bookId);
    try {
      // On réécrit la totalité de l'ordre affiché à chaque déplacement,
      // en un seul lot atomique — plutôt que de dépendre d'un état
      // "déjà initialisé" qui pouvait ne pas avoir eu le temps de
      // revenir de Firestore entre deux clics rapprochés, annulant
      // alors silencieusement le déplacement précédent.
      const reordered = palBooks.slice();
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);

      const batch = writeBatch(db);
      reordered.forEach((b, i) => {
        batch.update(doc(db, "users", user.uid, "books", b.id), { palOrder: i });
      });
      await batch.commit();
    } catch (err) {
      console.error("Move Book In PAL Error:", err);
      toast({ variant: "destructive", title: "Erreur lors du déplacement" });
    } finally {
      setIsReordering(null);
    }
  };

  // "Surprends-moi" : tire un livre au hasard dans la PAL et demande
  // confirmation avant de l'épingler — jamais d'épinglage automatique
  // sans validation, pour rester dans l'esprit "proposition" et non
  // "décision imposée" du tirage au sort.
  const drawRandomNextRead = () => {
    const palBooks = userBooks.filter((b) => b.status === "pal");
    if (palBooks.length === 0) {
      toast({ title: "Ta PAL est vide", description: "Ajoute des livres à lire pour pouvoir tirer au sort." });
      return;
    }
    setDrawnBook(palBooks[Math.floor(Math.random() * palBooks.length)]);
  };

  const confirmDrawnPin = async () => {
    if (!drawnBook) return;
    setIsPinningDraw(true);
    try {
      await togglePinNextRead(drawnBook.id, false);
      setDrawnBook(null);
    } finally {
      setIsPinningDraw(false);
    }
  };

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: userBooks = [], loading } = useCollection<UserBook>(booksQuery);

  // Si un rangement personnalisé existe déjà (palOrder renseigné sur au
  // moins un livre de la PAL), on rétablit automatiquement le mode
  // "Ranger moi-même" à l'ouverture de la page — sinon le tri repart
  // toujours sur "saga" par défaut, donnant l'impression que le
  // rangement n'a pas été sauvegardé alors qu'il l'était bel et bien.
  // Ne se déclenche qu'une fois, pour ne jamais forcer un retour au
  // mode manuel si la lectrice a choisi un autre tri en cours de session.
  const [sortModeChecked, setSortModeChecked] = useState(false);
  useEffect(() => {
    if (sortModeChecked || userBooks.length === 0) return;
    if (userBooks.some((b: any) => b.status === "pal" && b.palOrder !== undefined)) {
      setSortMode("manual");
    }
    setSortModeChecked(true);
  }, [userBooks, sortModeChecked]);

  const filteredBooks = useMemo(() => {
    const matched = userBooks.filter(b => {
      const matchesSearch = (b.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (b.author || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "all") return matchesSearch;
      return b.status === activeTab && matchesSearch;
    });
    if (sortMode === "manual" && activeTab === "pal") {
      // Ordre personnalisé : palOrder en priorité, puis date d'ajout pour
      // les livres jamais encore réordonnés à la main (sinon ils se
      // retrouveraient tous mélangés en tête, palOrder valant 0 partout).
      return matched.slice().sort((a, b) => {
        const oa = (a as any).palOrder ?? Number.MAX_SAFE_INTEGER;
        const ob = (b as any).palOrder ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        const da = a.dateAdded?.toMillis?.() || 0;
        const db = b.dateAdded?.toMillis?.() || 0;
        return da - db;
      });
    }
    return sortMode === "author" ? sortByAuthor(matched) : sortBySaga(matched);
  }, [userBooks, activeTab, searchQuery, sortMode]);

  // Quand l'onglet "Lu" est actif, on regroupe les livres par mois de
  // lecture (dateRead si renseigné, sinon dateAdded en fallback) pour
  // afficher un journal chronologique style Book Nova. Les mois sont
  // triés du plus récent au plus ancien. Les livres sans date connue
  // tombent dans un groupe séparé affiché en toute fin.
  const booksByMonth = useMemo(() => {
    if (activeTab !== "read") return null;
    const groups: Record<string, { label: string; books: typeof filteredBooks }> = {};
    filteredBooks.forEach((b) => {
      const raw = b.dateRead || b.dateAdded;
      const date = raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null);
      const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "unknown";
      const label = date ? `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` : "Date inconnue";
      if (!groups[key]) groups[key] = { label, books: [] };
      groups[key].books.push(b);
    });
    return Object.entries(groups).sort(([a], [b]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a)));
  }, [activeTab, filteredBooks]);

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

        <div className="flex justify-center flex-wrap gap-3">
          <button
            onClick={() => setSortMode(sortMode === "author" ? "saga" : "author")}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm italic font-headline transition-colors",
              sortMode === "author" ? "bg-primary text-white shadow-md" : "bg-white/50 text-primary/60 hover:bg-white/70"
            )}
          >
            {sortMode === "author" ? <Layers className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
            {sortMode === "author" ? "Revenir au tri par saga" : "Classer par auteur"}
          </button>
          {activeTab === "pal" && (
            <>
              <button
                onClick={() => setSortMode(sortMode === "manual" ? "saga" : "manual")}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm italic font-headline transition-colors",
                  sortMode === "manual" ? "bg-primary text-white shadow-md" : "bg-white/50 text-primary/60 hover:bg-white/70"
                )}
              >
                <ListOrdered className="h-4 w-4" />
                {sortMode === "manual" ? "Quitter l'ordre personnalisé" : "Ranger moi-même"}
              </button>
              <button
                onClick={drawRandomNextRead}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm italic font-headline text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: "linear-gradient(135deg, #ff6b9d 0%, #c44dff 50%, #6b8cff 100%)" }}
              >
                <Dices className="h-4 w-4" /> Surprends-moi
              </button>
            </>
          )}
        </div>
      </header>

      <Dialog open={!!drawnBook} onOpenChange={(o) => !o && setDrawnBook(null)}>
        <DialogContent className="glass-card border-none max-w-sm p-10 bg-white/95 backdrop-blur-3xl text-center">
          {drawnBook && (
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/50">Le sort a choisi...</p>
              <div className="relative w-32 aspect-[2/3] mx-auto rounded-2xl overflow-hidden shadow-xl">
                <BookCover src={drawnBook.cover} alt={drawnBook.title || ""} className="object-cover" />
              </div>
              <div>
                <p className="font-headline italic text-2xl">{cleanBookTitle(drawnBook.title)}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">{cleanAuthorName(drawnBook.author)}</p>
              </div>
              <p className="text-sm italic opacity-60">L'épingler comme Prochaine lecture ?</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDrawnBook(null)} className="flex-1 rounded-2xl h-12 italic">
                  Annuler
                </Button>
                <Button onClick={confirmDrawnPin} disabled={isPinningDraw} className="flex-1 rounded-2xl h-12 italic bg-primary">
                  {isPinningDraw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Oui !"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>

        {isAdmin && (
          <div className="mb-10 space-y-6">
            <MasterBookManager />
            <AdminCatalogView />
          </div>
        )}

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
          ) : booksByMonth ? (
            // Onglet "Lu" : livres regroupés par mois de lecture
            <div className="space-y-4">
              {booksByMonth.map(([key, { label, books }]) => (
                <MonthGroup key={key} label={label} books={books} isAdmin={isAdmin} isLoadingEditBook={isLoadingEditBook} openMasterEditor={openMasterEditor} />
              ))}
              {booksByMonth.length === 0 && (
                <div className="py-40 text-center glass-card border-dashed bg-white/20">
                  <Bookmark className="h-20 w-20 mx-auto text-primary/10" />
                  <p className="text-primary/60 italic font-headline text-2xl mt-4">Aucun livre lu pour le moment.</p>
                </div>
              )}
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
              {filteredBooks.map((book) => (
                <div key={book.id} className="relative">
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.preventDefault(); openMasterEditor((book as any).masterBookId); }}
                      className="absolute top-2 left-2 right-2 z-10 h-9 rounded-xl bg-primary/95 text-white shadow-lg flex items-center justify-center gap-2 text-xs font-headline italic hover:bg-primary transition-colors"
                      title="Éditer la fiche partagée (admin)"
                    >
                      {isLoadingEditBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" /> Modifier la fiche</>}
                    </button>
                  )}
                  {activeTab === "pal" && sortMode !== "manual" && (
                    <button
                      onClick={(e) => { e.preventDefault(); togglePinNextRead(book.id, !!(book as any).isNextRead); }}
                      disabled={isPinning === book.id}
                      title={(book as any).isNextRead ? "Retirer de Prochaine lecture" : "Épingler comme Prochaine lecture"}
                      className={cn(
                        "absolute top-2 right-2 z-10 h-9 w-9 rounded-full shadow-lg flex items-center justify-center transition-colors",
                        (book as any).isNextRead ? "bg-primary text-white" : "bg-white/80 text-primary/40 hover:text-primary"
                      )}
                    >
                      {isPinning === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className={cn("h-4 w-4", (book as any).isNextRead && "fill-white")} />}
                    </button>
                  )}
                  {activeTab === "pal" && sortMode === "manual" && (
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                      <button
                        onClick={(e) => { e.preventDefault(); moveBookInPal(book.id, "up"); }}
                        disabled={!!isReordering || filteredBooks.findIndex((b) => b.id === book.id) === 0}
                        className="h-8 w-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary/60 hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); moveBookInPal(book.id, "down"); }}
                        disabled={!!isReordering || filteredBooks.findIndex((b) => b.id === book.id) === filteredBooks.length - 1}
                        className="h-8 w-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary/60 hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <Link href={`/book/${book.id}`} className="group block">
                    <BookCard book={book} />
                  </Link>
                </div>
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

      {isAdmin && (
        <Dialog open={!!editingMasterBook} onOpenChange={(open) => !open && setEditingMasterBook(null)}>
          <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
            <ScrollArea className="max-h-[90vh] p-10">
              {editingMasterBook && (
                <MasterBookEditor
                  book={editingMasterBook}
                  onClose={() => setEditingMasterBook(null)}
                  onSaved={() => setEditingMasterBook(null)}
                />
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
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

// Groupe mensuel collapsible pour l'onglet "Lu" — ouvert par défaut
// pour les mois récents (logique gérée par le composant parent), avec
// le compteur de livres dans l'en-tête et la grille de couvertures
// dans le corps rétractable.
function MonthGroup({ label, books, isAdmin, isLoadingEditBook, openMasterEditor }: {
  label: string;
  books: any[];
  isAdmin: boolean;
  isLoadingEditBook: boolean;
  openMasterEditor: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/40 hover:bg-white/60 transition-colors group">
        <div className="flex items-center gap-4">
          <span className="font-headline italic text-xl">{label}</span>
          <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{books.length} livre{books.length > 1 ? "s" : ""}</span>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-primary/40 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10 pt-6 px-2">
          {books.map((book) => (
            <div key={book.id} className="relative">
              {isAdmin && (
                <button
                  onClick={(e) => { e.preventDefault(); openMasterEditor(book.masterBookId); }}
                  className="absolute top-2 left-2 right-2 z-10 h-9 rounded-xl bg-primary/95 text-white shadow-lg flex items-center justify-center gap-2 text-xs font-headline italic hover:bg-primary transition-colors"
                >
                  {isLoadingEditBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" /> Modifier la fiche</>}
                </button>
              )}
              <Link href={`/book/${book.id}`} className="group block">
                <BookCard book={book} />
              </Link>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
