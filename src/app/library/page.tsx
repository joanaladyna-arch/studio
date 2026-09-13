
"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useState, useMemo, useEffect } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  Star,
  CheckSquare,
  Check,
  EyeOff,
  Eye,
  ListOrdered,
  Trash2,
  PenTool
} from "lucide-react";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, cleanBookTitle, cleanAuthorName, ADMIN_EMAILS, sortBySaga, sortByAuthor, syncMasterBookReadCount } from "@/lib/utils";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { collection, doc, getDoc, updateDoc, query, where, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
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
  readCount?: number;
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
  plannedNextMonth?: boolean;
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
  favoriteQuotes?: string[];
  favoriteCharacter?: string;
  readStartDate?: string;
  readEndDate?: string;
  reviewDocuments?: { name: string; url: string; path: string; uploadedAt: number; type: string }[];
  isPressService?: boolean;
}

export type Book = UserBook;

export { GENRES_LIST, TROPES_LIST, THEMES_LIST } from "@/lib/taxonomy";

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

// Sélection proposée à l'attribution d'un rang : 5 niveaux + DNF au lieu des
// 8 niveaux d'origine (retour bêta : "trop de niveaux"). "doree" et
// "froissee" restent dans RANKS ci-dessus pour continuer à afficher
// correctement les livres déjà tagués avec — on ne les propose simplement
// plus au moment du choix, aucune donnée existante n'est perdue.
export const SELECTABLE_RANKS: RankType[] = ['diamant', 'royale', 'argentee', 'simple', 'brisee', 'dnf'];

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
  const isAmbientDark = useAmbientDark();
  const { adminMode } = useAdminMode();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"saga" | "author" | "manual">("saga");
  const [isReordering, setIsReordering] = useState<string | null>(null);

  // Mois archivé ouvert dans la modale de détail de l'onglet "Lu" (clé de
  // readByMonth, ex: "2026-08") — null = modale fermée.
  const [openMonthKey, setOpenMonthKey] = useState<string | null>(null);

  // Sélection multiple — pour retirer en masse des livres des objectifs
  // (annuel/mensuel) sans toucher au reste de leur fiche. Pensé pour les
  // lectrices qui importent tout leur historique de lecture pour avoir
  // un visuel complet, sans vouloir que ces anciennes lectures gonflent
  // artificiellement les objectifs de l'année en cours.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const applyGoalExclusion = async (exclude: boolean) => {
    if (!db || !user || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, "users", user.uid, "books", id), { countTowardGoals: !exclude });
      });
      await batch.commit();
      toast({
        title: exclude ? "Retiré des objectifs" : "Remis dans les objectifs",
        description: `${selectedIds.size} livre${selectedIds.size > 1 ? "s" : ""} mis à jour.`,
      });
      exitSelectMode();
    } catch (err) {
      console.error("Bulk Goal Exclusion Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setBulkSaving(false);
    }
  };

  // Retire un livre de la réserve personnelle directement depuis sa carte
  // (croix rapide), sans passer par sa fiche complète — même geste que
  // "Retirer ce livre de votre réserve" sur la fiche livre.
  const quickDeleteBook = async (bookId: string, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!db || !user || !confirm(`Retirer "${title}" de votre réserve ?`)) return;
    try {
      const book = userBooks.find((b) => b.id === bookId);
      await deleteDoc(doc(db, "users", user.uid, "books", bookId));
      if (book?.masterBookId) {
        await syncMasterBookReadCount(db, book.masterBookId, book.status, null);
      }
      toast({ title: "Livre retiré" });
    } catch (err) {
      console.error("Quick Delete Book Error:", err);
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    }
  };

  // Supprime en masse les livres sélectionnés (mode sélection) — même
  // logique que le retrait individuel, en un seul lot par lecture de
  // cohérence (readCount synchronisé pour chaque livre concerné).
  const bulkDeleteBooks = async () => {
    if (!db || !user || selectedIds.size === 0) return;
    if (!confirm(`Supprimer définitivement ${selectedIds.size} livre${selectedIds.size > 1 ? "s" : ""} de votre réserve ?`)) return;
    setBulkDeleting(true);
    try {
      const toDelete = userBooks.filter((b) => selectedIds.has(b.id));
      const batch = writeBatch(db);
      toDelete.forEach((b) => batch.delete(doc(db, "users", user.uid, "books", b.id)));
      await batch.commit();
      await Promise.all(
        toDelete
          .filter((b) => b.masterBookId)
          .map((b) => syncMasterBookReadCount(db, b.masterBookId, b.status, null))
      );
      toast({ title: "Livres supprimés", description: `${toDelete.length} livre${toDelete.length > 1 ? "s" : ""} retiré${toDelete.length > 1 ? "s" : ""}.` });
      exitSelectMode();
    } catch (err) {
      console.error("Bulk Delete Books Error:", err);
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    } finally {
      setBulkDeleting(false);
    }
  };

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
    const palBooks = getBooksForStatus("pal");
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
  // Détecte si l'utilisatrice a déjà un ordre manuel (palOrder) et l'applique
  // Re-vérifie à chaque mise à jour des livres pour ne pas rater une init tardive
  const [sortModeChecked, setSortModeChecked] = useState(false);
  useEffect(() => {
    if (userBooks.length === 0) return;
    if (!sortModeChecked && userBooks.some((b: any) => b.status === "pal" && typeof (b as any).palOrder === "number")) {
      setSortMode("manual");
      setSortModeChecked(true);
    }
  }, [userBooks]);

  // Une liste triée + filtrée par recherche, par statut — calculée une
  // fois pour chaque bloc plutôt que pour un seul onglet actif, puisque
  // tous les blocs s'affichent désormais simultanément (PAL, Lu, En
  // cours, Wishlist, DNF), comme les paliers de Palme sur Coups de Cœur.
  const getBooksForStatus = (status: string) => {
    const matched = userBooks.filter(b => {
      const matchesSearch = (b.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (b.author || "").toLowerCase().includes(searchQuery.toLowerCase());
      return b.status === status && matchesSearch;
    });
    if (sortMode === "manual" && status === "pal") {
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
  };

  const palBlockBooks = useMemo(() => getBooksForStatus("pal"), [userBooks, searchQuery, sortMode]);
  const progressBlockBooks = useMemo(() => getBooksForStatus("progress"), [userBooks, searchQuery, sortMode]);
  const readBlockBooks = useMemo(() => getBooksForStatus("read"), [userBooks, searchQuery, sortMode]);
  const envieBlockBooks = useMemo(() => getBooksForStatus("envie"), [userBooks, searchQuery, sortMode]);
  const dnfBlockBooks = useMemo(() => getBooksForStatus("dnf"), [userBooks, searchQuery, sortMode]);
  const nextMonthBlockBooks = useMemo(() => palBlockBooks.filter((b: any) => b.plannedNextMonth), [palBlockBooks]);

  // Bloc "Lu" : regroupé par mois de lecture. Priorité de date : date de
  // fin de lecture, puis date de début, puis dateRead (champ historique).
  // dateAdded (date d'AJOUT à la bibliothèque, pas de lecture) sert
  // encore de dernier repli pour les livres normaux — c'est ainsi que
  // la plupart des livres déjà organisés par mois le sont. Mais pour un
  // livre RETIRÉ DES OBJECTIFS (typiquement un import d'historique sans
  // date précise), dateAdded n'est plus utilisée : elle ne représente
  // que le jour où le livre a été ajouté à Lectoria, pas lu, et
  // grouperait à tort tout un lot d'anciens livres importés le même
  // jour dans le mois en cours. Ces livres tombent alors dans
  // "Lu également" s'ils n'ont pas de vraie date de lecture.
  const readByMonth = useMemo(() => {
    const groups: Record<string, { label: string; books: typeof readBlockBooks }> = {};
    readBlockBooks.forEach((b) => {
      const excluded = (b as any).countTowardGoals === false;
      // Priorité : date de fin saisie → date de début → dateRead historique
      // On ne prend JAMAIS dateAdded comme repli : cette date représente
      // le jour d'ajout à Lectoria, pas la date de lecture réelle.
      // Les livres sans aucune date de lecture atterrissent dans "Lu également".
      const genuineDate = (b as any).readEndDate || (b as any).readStartDate || b.dateRead;
      const raw = genuineDate || null;
      const date = raw ? (raw.toDate ? raw.toDate() : new Date(raw)) : null;
      const validDate = date && !isNaN(date.getTime()) ? date : null;
      const key = validDate ? `${validDate.getFullYear()}-${String(validDate.getMonth() + 1).padStart(2, "0")}` : "unknown";
      const label = validDate ? `${MONTH_NAMES[validDate.getMonth()]} ${validDate.getFullYear()}` : "Lu également";
      if (!groups[key]) groups[key] = { label, books: [] };
      groups[key].books.push(b);
    });
    return Object.entries(groups).sort(([a], [b]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a)));
  }, [readBlockBooks]);

  // Un livre étoilé "mois prochain" ne s'affiche plus dans le bloc PAL —
  // il ne doit apparaître qu'à un seul endroit à la fois. `palBlockBooks`
  // lui-même reste inchangé (réordonnancement manuel, tirage au sort,
  // unicité de l'épingle "Prochaine lecture" en dépendent tous ailleurs) :
  // seul l'affichage du bloc PAL utilise ce sous-ensemble filtré.
  const palDisplayBooks = useMemo(() => palBlockBooks.filter((b: any) => !b.plannedNextMonth), [palBlockBooks]);

  const BLOCKS = [
    { id: "nextmonth", label: "🎯 Lectures du mois prochain", tabLabel: "🎯 Mois prochain", books: nextMonthBlockBooks, highlight: true },
    { id: "progress", label: "En cours", tabLabel: "En cours", books: progressBlockBooks },
    { id: "pal", label: "PAL", tabLabel: "PAL", books: palDisplayBooks },
    { id: "read", label: "Lu", tabLabel: "Lu", books: readBlockBooks },
    { id: "envie", label: "Wishlist", tabLabel: "Wishlist", books: envieBlockBooks },
    { id: "dnf", label: "DNF", tabLabel: "DNF", books: dnfBlockBooks },
  ];

  // Onglet actif — remplace l'ancien système où tous les blocs
  // s'affichaient en défilement continu. Un lien externe (ex: le
  // raccourci Wishlist de l'Accueil, ?filter=envie) bascule directement
  // sur l'onglet correspondant au chargement.
  const [activeTab, setActiveTab] = useState<string>("pal");
  useEffect(() => {
    const filterParam = searchParams?.get("filter");
    if (!filterParam || loading) return;
    if (BLOCKS.some((b) => b.id === filterParam)) setActiveTab(filterParam);
  }, [searchParams, loading]);

  const activeBlock = BLOCKS.find((b) => b.id === activeTab) || BLOCKS[2];

  return (
    <div className="space-y-10 animate-paper pb-32">
      <header className="space-y-8 pt-4">
        <div className="text-center space-y-4">
          <h1 className={cn("text-3xl sm:text-4xl md:text-6xl font-headline tracking-tight italic", isAmbientDark && "text-[#F5F1E8]")}>Ma Bibliothèque</h1>
          <p className={cn("italic font-medium", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>Votre univers littéraire centralisé.</p>
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

          <button
            onClick={drawRandomNextRead}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl hover:bg-white/40 transition-colors shrink-0"
            title="Tirer un livre au hasard dans la PAL"
          >
            <span className="text-3xl leading-none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>🎲</span>
            <span className="text-[10px] italic font-headline text-primary/70 whitespace-nowrap">Surprends-moi</span>
          </button>
        </div>

        {/* Onglets — juste après le titre/la recherche, remplace l'ancien
            défilement continu où tous les blocs s'affichaient à la suite. */}
        <div className="flex justify-center flex-wrap gap-1 sm:gap-2 border-b border-primary/10 max-w-4xl mx-auto">
          {BLOCKS.map((block) => (
            <button
              key={block.id}
              onClick={() => setActiveTab(block.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3 sm:px-4 py-3 font-headline italic text-sm sm:text-base border-b-[3px] transition-colors",
                activeTab === block.id
                  ? (block as any).highlight ? "border-copper text-copper" : "border-primary text-primary"
                  : "border-transparent text-primary/50 hover:text-primary/80"
              )}
            >
              {block.tabLabel}
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  activeTab === block.id
                    ? (block as any).highlight ? "bg-copper text-white" : "bg-primary text-white"
                    : "bg-primary/10 text-primary/60"
                )}
              >
                {block.books.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-center flex-wrap gap-3">
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm italic font-headline transition-colors",
              selectMode ? "bg-primary text-white shadow-md" : "bg-white/50 text-primary/60 hover:bg-white/70"
            )}
          >
            <CheckSquare className="h-4 w-4" />
            {selectMode ? "Annuler la sélection" : "Sélectionner"}
          </button>
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
            <button
              onClick={() => setSortMode(sortMode === "manual" ? "saga" : "manual")}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm italic font-headline transition-colors",
                sortMode === "manual" ? "bg-primary text-white shadow-md" : "bg-white/50 text-primary/60 hover:bg-white/70"
              )}
            >
              <ListOrdered className="h-4 w-4" />
              {sortMode === "manual" ? "Quitter l'ordre personnalisé" : "Ranger moi-même (PAL)"}
            </button>
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

      {isAdmin && (
        <div className="space-y-6">
          <MasterBookManager />
          <AdminCatalogView />
        </div>
      )}

      {/* Bloc Plume+ : aperçu non fonctionnel de l'ordre de PAL redessiné,
          affiché uniquement sur l'onglet PAL. Le tri manuel existant
          (bouton "Ranger moi-même (PAL)" ci-dessus) reste pleinement
          fonctionnel — cette carte n'est qu'une préfiguration visuelle. */}
      {activeTab === "pal" && (
        <div className="relative max-w-md mx-auto rounded-[1.75rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50/60 p-5 shadow-sm overflow-hidden select-none">
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            style={{ background: "rgba(255,255,255,0.35)" }}
          >
            <span
              className="text-red-500/70 font-headline italic text-2xl sm:text-3xl tracking-wide border-2 border-red-500/50 rounded-xl px-4 py-1"
              style={{ transform: "rotate(-8deg)" }}
            >
              Bientôt
            </span>
          </div>
          <div className="opacity-70 pointer-events-none">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline italic text-lg">Ordre de ta PAL</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-primary text-white px-2 py-0.5 rounded-full">Plume+</span>
            </div>
            <p className="text-xs text-primary/60 italic mb-3">Choisis comment ta pile à lire s'organise, puis enregistre ton choix — il reste actif à chaque visite.</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white/60 px-3 py-2">
                <ListOrdered className="h-4 w-4 text-primary/50 shrink-0" />
                <div>
                  <p className="text-xs font-bold italic">Ordre personnalisé</p>
                  <p className="text-[10px] text-primary/50">Range chaque livre toi-même.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white/60 px-3 py-2">
                <Layers className="h-4 w-4 text-primary/50 shrink-0" />
                <div>
                  <p className="text-xs font-bold italic">Ordre automatique</p>
                  <p className="text-[10px] text-primary/50">Par saga, puis date d'ajout.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-1.5 text-xs font-headline italic bg-primary/80 text-white px-3 py-1.5 rounded-full">
                <Check className="h-3.5 w-3.5" /> Sauvegarder
              </span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-40 text-center flex flex-col items-center gap-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
          <p className="font-headline italic text-primary/40 text-xl">Exploration de la réserve...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const block = activeBlock;
            return (
            <section key={block.id} className="space-y-6 scroll-mt-24">
              <div className="flex items-center gap-4 px-2">
                <h2 className={cn("font-headline italic text-2xl md:text-3xl", (block as any).highlight ? "text-amber-500" : isAmbientDark && "text-[#F5F1E8]")}>{block.label}</h2>
                <span className={cn("text-xs font-bold px-3 py-1 rounded-full", (block as any).highlight ? "bg-amber-400/15 text-amber-600" : "bg-primary/10 text-primary")}>{block.books.length}</span>
              </div>

              {block.id === "read" ? (
                readByMonth.length > 0 ? (
                  <div className="space-y-6">
                    {/* Mois le plus récent : liste ouverte inchangée. */}
                    <MonthGroup
                      key={readByMonth[0][0]}
                      label={readByMonth[0][1].label}
                      books={readByMonth[0][1].books}
                      isAdmin={isAdmin}
                      isLoadingEditBook={isLoadingEditBook}
                      openMasterEditor={openMasterEditor}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      toggleSelect={toggleSelect}
                      quickDeleteBook={quickDeleteBook}
                    />
                    {/* Mois précédents : rangés en boîtes d'archive, ouvertes au clic. */}
                    {readByMonth.length > 1 && (
                      <div className="space-y-3">
                        <p className="font-headline italic text-lg text-primary/70 px-2">Mois précédents</p>
                        <div className="flex flex-wrap gap-4 px-2">
                          {readByMonth.slice(1).map(([key, { label, books }]) => (
                            <button
                              key={key}
                              onClick={() => setOpenMonthKey(key)}
                              className="w-36 rounded-2xl border border-primary/10 bg-white/50 hover:bg-white/80 shadow-sm hover:shadow-md transition-all p-5 text-center"
                            >
                              <div className="text-3xl mb-2">🗃️</div>
                              <p className="font-headline italic text-sm leading-tight">{label}</p>
                              <p className="text-[11px] text-primary/50 mt-1">{books.length} livre{books.length > 1 ? "s" : ""}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-16 text-center glass-card border-dashed bg-white/20 rounded-[2rem]">
                    <Bookmark className="h-14 w-14 mx-auto text-primary/10" />
                    <p className="text-primary/60 italic font-headline text-lg mt-3">Aucun livre lu pour le moment.</p>
                  </div>
                )
              ) : block.id === "nextmonth" && block.books.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-12 py-4">
                  {block.books.map((book, i) => {
                    const rotations = [-7, 5, -4, 6, -6, 4, -5, 7];
                    const rotation = rotations[i % rotations.length];
                    return (
                      <Link
                        key={book.id}
                        href={`/book/${book.id}`}
                        className="group relative block"
                        style={{ transform: `rotate(${rotation}deg)`, transition: "transform 300ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "rotate(0deg) scale(1.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = `rotate(${rotation}deg)`)}
                      >
                        <span
                          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 h-5 w-5 rounded-full shadow-md"
                          style={{ background: "radial-gradient(circle at 35% 30%, #ff8a8a, #c81e3a 70%)" }}
                        />
                        <div className="w-28 sm:w-36 bg-white p-2 pb-3 rounded-sm shadow-xl">
                          <div className="relative aspect-[2/3] bg-secondary/5 overflow-hidden">
                            <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                          </div>
                          <p className="mt-2 text-center text-[11px] font-headline italic leading-tight line-clamp-2">{cleanBookTitle(book.title)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : block.id === "progress" && block.books.length > 0 ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {block.books.map((book) => (
                    <Card key={book.id} className="glass-card overflow-hidden border-none group">
                      <div className="grid sm:grid-cols-[140px_1fr] gap-0">
                        <div className="relative aspect-[3/2] sm:aspect-[2/3] overflow-hidden">
                          <BookCover src={book.cover} alt={book.title || ""} className="object-cover group-hover:scale-110 transition-transform duration-700" />
                        </div>
                        <CardContent className="p-5 md:p-7 flex flex-col justify-between gap-4" style={{ background: "linear-gradient(135deg, #EFE6D4, #E4D4B8)" }}>
                          <div className="space-y-2">
                            <h3 className="text-lg md:text-2xl font-headline italic leading-tight">
                              {cleanBookTitle(book.title)}{(book as any).volume ? ` — ${(book as any).volume}` : ""}
                            </h3>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{cleanAuthorName(book.author)}</p>
                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest opacity-60 italic">
                                <span>Progression</span>
                                <span>{(book as any).progress || 0}%</span>
                              </div>
                              <Progress value={(book as any).progress || 0} className="h-2 bg-primary/5" />
                            </div>
                          </div>
                          <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 shadow-lg h-11 text-sm font-headline italic self-start">
                            <Link href={`/book/${book.id}`}><PenTool className="mr-2 h-4 w-4" /> Reprendre le voyage</Link>
                          </Button>
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : block.id === "envie" && block.books.length > 0 ? (
                <div className="space-y-10 py-4">
                  {(() => {
                    const rotations = [-7, 5, -4, 6, -6, 4];
                    const rowSize = 6;
                    const rows: typeof block.books[] = [];
                    for (let i = 0; i < block.books.length; i += rowSize) rows.push(block.books.slice(i, i + rowSize));
                    return rows.map((row, r) => (
                      <div key={r} className="relative pt-6">
                        <svg className="block w-full h-9" viewBox={`0 0 ${Math.max(420, row.length * 130)} 36`} preserveAspectRatio="none">
                          <path
                            d={`M 0 5 Q ${Math.max(420, row.length * 130) / 2} 36 ${Math.max(420, row.length * 130)} 5`}
                            fill="none" stroke="hsl(var(--copper))" strokeWidth="2" opacity="0.4"
                          />
                        </svg>
                        <div className="flex flex-wrap justify-center gap-5 -mt-4">
                          {row.map((book, i) => {
                            const idx = r * rowSize + i;
                            return (
                              <Link
                                key={book.id}
                                href={`/book/${book.id}`}
                                className="group relative flex flex-col items-center shrink-0"
                                style={{ transform: `rotate(${rotations[idx % rotations.length] * 0.5}deg)`, transition: "transform 300ms" }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = "rotate(0deg) scale(1.06)")}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = `rotate(${rotations[idx % rotations.length] * 0.5}deg)`)}
                              >
                                <span className="w-3 h-5 rounded-[3px] bg-gradient-to-b from-amber-200 to-amber-600 shadow-sm -mb-1 z-10" />
                                <div className="w-24 bg-white p-1.5 pb-2.5 rounded-sm shadow-lg">
                                  <div className="relative aspect-[2/3] bg-secondary/5 overflow-hidden rounded-[4px]">
                                    <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                                  </div>
                                  <p className="mt-1.5 text-center text-[10px] font-headline italic leading-tight line-clamp-2">{cleanBookTitle(book.title)}</p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : block.books.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
                  {block.books.map((book) => {
                    const excluded = (book as any).countTowardGoals === false;
                    return (
                    <div key={book.id} className="relative group/card">
                      {selectMode && (
                        <div
                          className={cn(
                            "absolute top-2 left-2 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center shadow-md transition-colors",
                            selectedIds.has(book.id) ? "bg-rose border-rose" : "bg-white/80 border-white"
                          )}
                        >
                          {selectedIds.has(book.id) && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      )}
                      {excluded && !selectMode && (
                        <div
                          className="absolute top-2 left-2 z-10 h-7 w-7 rounded-full bg-primary/80 flex items-center justify-center shadow-md"
                          title="Ne compte pas dans vos objectifs"
                        >
                          <EyeOff className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      {isAdmin && !selectMode && (
                        <button
                          onClick={(e) => { e.preventDefault(); openMasterEditor((book as any).masterBookId); }}
                          className="absolute top-2 left-2 right-2 z-10 h-9 rounded-xl bg-primary/95 text-white shadow-lg flex items-center justify-center gap-2 text-xs font-headline italic hover:bg-primary transition-colors"
                          title="Éditer la fiche partagée (admin)"
                        >
                          {isLoadingEditBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" /> Modifier la fiche</>}
                        </button>
                      )}
                      {block.id === "pal" && sortMode !== "manual" && !selectMode && (
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
                      {block.id === "pal" && sortMode === "manual" && !selectMode && (
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                          <button
                            onClick={(e) => { e.preventDefault(); moveBookInPal(book.id, "up"); }}
                            disabled={!!isReordering || palBlockBooks.findIndex((b) => b.id === book.id) === 0}
                            className="h-8 w-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary/60 hover:text-primary disabled:opacity-30 transition-colors"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); moveBookInPal(book.id, "down"); }}
                            disabled={!!isReordering || palBlockBooks.findIndex((b) => b.id === book.id) === palBlockBooks.length - 1}
                            className="h-8 w-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary/60 hover:text-primary disabled:opacity-30 transition-colors"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {selectMode ? (
                        <div onClick={() => toggleSelect(book.id)} className="group block cursor-pointer">
                          <BookCard book={book} />
                        </div>
                      ) : (
                        <Link href={`/book/${book.id}`} className="group block transition-transform duration-200 hover:scale-[1.05] active:scale-[1.04]">
                          <BookCard book={book} />
                        </Link>
                      )}
                    </div>
                  );})}
                </div>
              ) : (
                <div className="py-16 text-center glass-card border-dashed bg-white/20 rounded-[2rem]">
                  <Bookmark className="h-14 w-14 mx-auto text-primary/10" />
                  <p className="text-primary/60 italic font-headline text-lg mt-3">
                    {searchQuery
                      ? "Aucun résultat dans ce bloc."
                      : block.id === "nextmonth"
                      ? 'Aucune lecture prévue pour le mois prochain — étoile un livre de ta PAL avec "Prévoir pour le mois prochain".'
                      : block.id === "progress"
                      ? "Aucune lecture en cours pour le moment."
                      : `Aucun livre dans "${block.label}" pour le moment.`}
                  </p>
                </div>
              )}
            </section>
            );
          })()}
        </div>
      )}

      {/* Détail d'un mois archivé (onglet "Lu") — citation retenue, avis et
          note, avec accès à la fiche complète via "Lire +". Corps
          défilant indépendamment, en-tête fixe. */}
      <Dialog open={!!openMonthKey} onOpenChange={(o) => !o && setOpenMonthKey(null)}>
        <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[85vh] flex flex-col">
          {(() => {
            const monthEntry = readByMonth.find(([key]) => key === openMonthKey);
            if (!monthEntry) return null;
            const [, { label, books }] = monthEntry;
            return (
              <>
                <div className="p-6 pb-4 border-b border-primary/10 shrink-0">
                  <DialogTitle className="font-headline italic text-2xl font-normal">{label}</DialogTitle>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-6 pt-4 space-y-6">
                    {books.map((book: any) => {
                      const quotes = (Array.isArray(book.favoriteQuotes) ? book.favoriteQuotes.filter(Boolean) : book.favoriteQuote ? [book.favoriteQuote] : []) as string[];
                      const rating = Number(book.rating) || 0;
                      const FormatIcon = book.format && FORMATS[book.format as BookFormat] ? FORMATS[book.format as BookFormat].icon : null;
                      return (
                        <div key={book.id} className="flex gap-4 pb-6 border-b border-primary/5 last:border-0 last:pb-0">
                          <div className="relative w-20 aspect-[2/3] shrink-0 rounded-lg overflow-hidden shadow-md">
                            <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                            <div className="absolute top-1 right-1">
                              <Badge className="text-[7px] font-bold uppercase bg-emerald-400">Lu</Badge>
                            </div>
                            {FormatIcon && (
                              <div className="absolute bottom-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center" title={FORMATS[book.format as BookFormat].label}>
                                <FormatIcon className={cn("h-2.5 w-2.5", FORMATS[book.format as BookFormat].color)} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <h3 className="font-headline italic text-lg leading-tight">{cleanBookTitle(book.title)}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cleanAuthorName(book.author)}</p>
                            {rating > 0 && (
                              <StarRating rating={rating} size={12} gap="gap-0.5" colorClass="text-copper fill-copper" emptyClass="fill-transparent text-muted-foreground/25" />
                            )}
                            {quotes.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-copper">Citation retenue</p>
                                <p className="font-headline italic text-sm">"{quotes[0]}"</p>
                              </div>
                            )}
                            {book.review && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-copper">Avis</p>
                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{book.review}</p>
                              </div>
                            )}
                            <Link href={`/book/${book.id}`} className="inline-block text-xs font-headline italic text-primary underline underline-offset-2 pt-1">
                              Lire + →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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

      {selectMode && selectedIds.size > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-primary text-primary-foreground rounded-2xl shadow-2xl px-4 py-3 flex-wrap justify-center"
          style={{ bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
        >
          <span className="text-sm font-headline italic px-2">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkSaving}
            onClick={() => applyGoalExclusion(true)}
            className="rounded-xl text-xs italic font-headline"
          >
            {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
            Retirer des objectifs
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkSaving}
            onClick={() => applyGoalExclusion(false)}
            className="rounded-xl text-xs italic font-headline"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Remettre dans les objectifs
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkDeleting}
            onClick={bulkDeleteBooks}
            className="rounded-xl text-xs italic font-headline bg-red-500 hover:bg-red-600"
          >
            {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            Supprimer
          </Button>
          <button onClick={exitSelectMode} className="text-xs underline opacity-70 px-2">Annuler</button>
        </div>
      )}
    </div>
  );
}

export function BookCard({ book }: { book: UserBook }) {
  const rating = Number((book as any).rating) || 0;
  const isPressService = Boolean((book as any).isPressService);
  const isAmbientDark = useAmbientDark();
  return (
    <div className="space-y-2 group cursor-pointer">
      <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-md border border-white/60 group-hover:shadow-2xl group-active:shadow-2xl transition-all duration-300 bg-secondary/5 flex items-center justify-center">
        <BookCover
          src={book.cover}
          alt={book.title || ""} 
          className="object-contain transition-all duration-300 group-hover:scale-110 group-active:scale-110" 
        />
        {isPressService && (
          <div
            className="absolute top-0 z-10 pointer-events-none shadow-sm"
            style={{
              left: "36px",
              width: "30px",
              height: "42px",
              background: "#D98BA0",
              clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)",
            }}
            title="Service de presse"
          >
            <span className="absolute inset-x-0 top-[8px] text-center text-black font-extrabold text-[10px] uppercase tracking-wide">
              SP
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge className={cn("text-[8px] font-bold uppercase", STATUSES[book.status]?.color)}>
            {STATUSES[book.status]?.label}
          </Badge>
        </div>
        {book.format && FORMATS[book.format] && (() => {
          const FormatIcon = FORMATS[book.format].icon;
          return (
            <div
              className="absolute bottom-2 left-2 h-7 w-7 rounded-full bg-white/85 shadow-sm flex items-center justify-center z-10"
              title={FORMATS[book.format].label}
            >
              <FormatIcon className={cn("h-3.5 w-3.5", FORMATS[book.format].color)} />
            </div>
          );
        })()}
      </div>
      {rating > 0 && (
        <div className="flex justify-center">
          <StarRating rating={rating} size={12} gap="gap-0.5" colorClass="text-copper fill-copper" emptyClass="fill-transparent text-muted-foreground/25" />
        </div>
      )}
      <div className="text-center px-2">
        <h3 className={cn("text-sm font-headline line-clamp-1 italic", isAmbientDark && "text-[#F5F1E8]")}>
          {cleanBookTitle(book.title)}{(book as any).volume ? ` — ${(book as any).volume}` : ""}
        </h3>
        <p className={cn("text-[10px] font-bold uppercase tracking-widest", isAmbientDark ? "text-[#F5F1E8]/60" : "text-muted-foreground")}>{cleanAuthorName(book.author)}</p>
      </div>
    </div>
  );
}

// Groupe mensuel collapsible pour l'onglet "Lu" — ouvert par défaut
// pour les mois récents (logique gérée par le composant parent), avec
// le compteur de livres dans l'en-tête et la grille de couvertures
// dans le corps rétractable.
function MonthGroup({ label, books, isAdmin, isLoadingEditBook, openMasterEditor, selectMode, selectedIds, toggleSelect, quickDeleteBook }: {
  label: string;
  books: any[];
  isAdmin: boolean;
  isLoadingEditBook: boolean;
  openMasterEditor: (id: string) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  quickDeleteBook: (id: string, title: string, e: React.MouseEvent) => void;
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
          {books.map((book) => {
            const excluded = (book as any).countTowardGoals === false;
            return (
            <div key={book.id} className="relative group/card">
              {selectMode && (
                <div
                  className={cn(
                    "absolute top-2 left-2 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center shadow-md transition-colors",
                    selectedIds.has(book.id) ? "bg-rose border-rose" : "bg-white/80 border-white"
                  )}
                >
                  {selectedIds.has(book.id) && <Check className="h-4 w-4 text-primary" />}
                </div>
              )}
              {excluded && !selectMode && (
                <div
                  className="absolute top-2 left-2 z-10 h-7 w-7 rounded-full bg-primary/80 flex items-center justify-center shadow-md"
                  title="Ne compte pas dans vos objectifs"
                >
                  <EyeOff className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              {isAdmin && !selectMode && (
                <button
                  onClick={(e) => { e.preventDefault(); openMasterEditor(book.masterBookId); }}
                  className="absolute top-2 left-2 right-2 z-10 h-9 rounded-xl bg-primary/95 text-white shadow-lg flex items-center justify-center gap-2 text-xs font-headline italic hover:bg-primary transition-colors"
                >
                  {isLoadingEditBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" /> Modifier la fiche</>}
                </button>
              )}
              {!selectMode && (
                <button
                  onClick={(e) => quickDeleteBook(book.id, (book as any).title || "ce livre", e)}
                  className="absolute top-1.5 right-1.5 z-20 h-7 w-7 rounded-full bg-white/95 shadow-md flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 active:text-red-500 transition-all touch-manipulation border border-zinc-100"
                  title="Retirer de la bibliothèque"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              {selectMode ? (
                <div onClick={() => toggleSelect(book.id)} className="group block cursor-pointer">
                  <BookCard book={book} />
                </div>
              ) : (
                <Link href={`/book/${book.id}`} className="group block">
                  <BookCard book={book} />
                </Link>
              )}
            </div>
          );})}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
