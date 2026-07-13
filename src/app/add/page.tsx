"use client";

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2,
  X,
  Pencil,
  Magnet,
  HelpCircle,
  ScanBarcode,
  History
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MasterBookEditor } from "@/components/master-book-editor";
import { IsbnImporter } from "@/components/isbn-importer";
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, fetchWithTimeout, toArray, searchBnF, ADMIN_EMAILS, cleanDescriptionHtml, cleanIsbnValue, stableBookKey, sortBySaga, isFrenchLanguage, languageLabel } from "@/lib/utils";
import { useAdminMode } from "@/components/admin-mode";

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { adminMode } = useAdminMode();
  const isAdmin = adminMode;
  const [editingMasterBook, setEditingMasterBook] = useState<any | null>(null);
  const [isLoadingEditBook, setIsLoadingEditBook] = useState(false);

  const openMasterEditor = async (masterBookId?: string) => {
    if (!db || !masterBookId) return;
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
  
  const [queryStr, setQueryStr] = useState("");
  const [searchMode, setSearchMode] = useState<"general" | "publisher">("general");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState({ title: "", author: "", referenceLink: "", description: "", cover: "" });
  const [isFetchingManualLink, setIsFetchingManualLink] = useState(false);
  const [previewBook, setPreviewBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [countTowardGoals, setCountTowardGoals] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastSearch(localStorage.getItem("lectoria_last_search"));
    }
  }, []);

  const runSearch = async (searchValOverride?: string) => {
    const searchVal = (searchValOverride ?? queryStr).trim();
    if (!searchVal) {
      toast({ title: "Champ vide", description: "Veuillez saisir un titre, un auteur, un éditeur ou un ISBN." });
      return;
    }
    if (!db || isSearching) return; // Évite les recherches concurrentes (double-clic, touche Entrée répétée)

    setIsSearching(true);
    setResults([]);

    let allResults: any[] = [];

    // Détection automatique d'une recherche par ISBN (10 ou 13 chiffres,
    // tirets/espaces tolérés) : on bascule alors la requête Google Books
    // sur l'opérateur "isbn:" pour une correspondance exacte plutôt
    // qu'une recherche floue, et la Master DB sur le champ isbn.
    const cleanedDigits = searchVal.replace(/[-\s]/g, "");
    const isIsbnQuery = /^\d{10}(\d{3})?$/.test(cleanedDigits);
    const googleQuery = isIsbnQuery
      ? `isbn:${cleanedDigits}`
      : searchMode === "publisher"
        ? `inpublisher:${searchVal}`
        : searchVal;

    try {
      // 1 & 2. Recherche Master Database (Lectoria) et Google Books en
      // parallèle : ces deux sources sont indépendantes, les attendre en
      // série n'apporte rien et double la latence perçue par l'utilisatrice.
      //
      // IMPORTANT (consigne explicite) : la BnF n'est plus jamais utilisée
      // comme source de résultats de recherche — elle produisait des
      // fiches sans couverture, ce qui donnait une impression d'application
      // inachevée. Google Books et Apple Books sont désormais les deux
      // sources principales de recherche ; la BnF sert uniquement, plus
      // bas, à compléter un résumé manquant sur un résultat déjà trouvé
      // par ailleurs — jamais à faire apparaître un livre par elle-même.
      const [masterSettled, googleSettled, appleSettled] = await Promise.allSettled([
        (async () => {
          const masterRef = collection(db, "masterBooks");
          // Recherche par préfixe sur le champ pertinent selon le mode
          // (titre par défaut, éditeur, ou ISBN en correspondance exacte).
          const q = isIsbnQuery
            ? query(masterRef, where("isbn13", "==", cleanedDigits))
            : searchMode === "publisher"
              ? query(masterRef, where("publisher", ">=", searchVal), where("publisher", "<=", searchVal + "\uf8ff"))
              : query(masterRef, where("title", ">=", searchVal), where("title", "<=", searchVal + "\uf8ff"));
          const masterSnap = await getDocs(q);
          return masterSnap.docs.map(d => ({ ...d.data(), id: d.id, source: "master" }));
        })(),
        (async () => {
          const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(googleQuery)}&maxResults=10`;
          const res = await fetchWithTimeout(gUrl, {}, 8000);
          if (!res.ok) return [];
          const data = await res.json();
          if (!data.items) return [];
          return data.items.map((item: any) => {
            const info = item.volumeInfo || {};
            const isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier ||
                         info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "";
            const isbn10 = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "";
            return {
              id: item.id,
              title: info.title || "Titre inconnu",
              subtitle: info.subtitle || "",
              author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              isbn: isbn,
              isbn10: isbn10,
              description: cleanDescriptionHtml(info.description),
              publisher: info.publisher || "",
              pages: info.pageCount || 0,
              language: info.language || "",
              publishedDate: info.publishedDate || "",
              genres: info.categories || [],
              source: "api"
            };
          });
        })(),
        (async () => {
          // Recherche par défaut, sauf en mode éditeur où l'iTunes
          // Search API n'a pas d'équivalent (pas de filtre par maison
          // d'édition côté Apple Books) — la requête générale reste
          // alors préférable à une absence totale de résultat.
          const appleUrl = isIsbnQuery
            ? `/api/itunes-search?q=${encodeURIComponent(cleanedDigits)}&isbn=1`
            : `/api/itunes-search?q=${encodeURIComponent(searchVal)}`;
          const res = await fetchWithTimeout(appleUrl, {}, 8000);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.results || []).map((b: any) => ({
            id: b.id,
            title: b.title || "Titre inconnu",
            subtitle: "",
            author: b.author || "Auteur inconnu",
            cover: b.cover || undefined,
            isbn: "",
            isbn10: "",
            description: b.description || "",
            publisher: "",
            pages: 0,
            language: b.language || "",
            publishedDate: b.publishedDate || "",
            genres: toArray<string>(b.genres),
            source: "api"
          }));
        })(),
      ]);

      if (masterSettled.status === "fulfilled") {
        allResults = [...masterSettled.value];
      } else {
        console.error("Master Search Error:", masterSettled.reason);
        // On continue même si la base Lectoria échoue
      }

      if (googleSettled.status === "fulfilled") {
        // Merge avoiding duplicates by ISBN
        const newApiResults = googleSettled.value.filter((api: any) => !allResults.find(m => m.isbn13 === api.isbn || m.isbn === api.isbn));
        allResults = [...allResults, ...newApiResults];
      } else {
        console.error("Google Books Error:", googleSettled.reason);
        // On continue même si Google Books échoue ou expire
      }

      // BnF : plus jamais utilisée pour ajouter des résultats à la liste,
      // uniquement pour compléter un résumé manquant sur les résultats
      // déjà trouvés par Google Books, Apple Books ou la base Lectoria.
      // Ciblée sur les tout premiers résultats (les plus pertinents) pour
      // ne pas multiplier les appels réseau sur une longue liste.
      const missingDescription = allResults.filter((r) => !((r.description || "").toString().trim())).slice(0, 8);
      if (missingDescription.length > 0) {
        await Promise.all(
          missingDescription.map(async (r) => {
            try {
              const bnfType2 = r.isbn ? "isbn" : "general";
              const bnfQuery = r.isbn || `${r.title} ${r.author}`.trim();
              const bnfResults = await searchBnF(bnfQuery, bnfType2);
              const match = bnfResults[0];
              if (match?.description) {
                r.description = cleanDescriptionHtml(match.description);
              }
            } catch {
              // Résumé optionnel : on continue sans bloquer l'affichage
              // des résultats si la BnF échoue ou expire.
            }
          })
        );
      }

      if (appleSettled.status === "fulfilled") {
        // Apple Books ne renvoie pas d'ISBN fiable pour les ebooks : le
        // dédoublonnage se fait donc uniquement par titre+auteur, comme
        // pour la BnF.
        const newAppleResults = appleSettled.value.filter((b: any) =>
          !allResults.find(m =>
            (m.title || "").toLowerCase() === (b.title || "").toLowerCase() && (m.author || "").toLowerCase() === (b.author || "").toLowerCase()
          )
        );
        allResults = [...allResults, ...newAppleResults];
      } else {
        console.error("Apple Books Error:", appleSettled.reason);
        // On continue même si Apple Books échoue ou expire : source bonus, pas bloquante
      }

      // 3. Fallback Open Library (si toujours peu de résultats, timeout 8s également)
      if (allResults.length < 5) {
        try {
          const olQuery = isIsbnQuery
            ? `isbn:${cleanedDigits}`
            : searchMode === "publisher"
              ? `publisher:${searchVal}`
              : searchVal;
          const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=5`;
          const res = await fetchWithTimeout(olUrl, {}, 8000);
          if (res.ok) {
            const data = await res.json();
            if (data.docs) {
              const olResults = data.docs.map((doc: any) => ({
                id: doc.key,
                title: doc.title || "Titre inconnu",
                author: doc.author_name ? doc.author_name.join(", ") : "Inconnu",
                cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
                isbn: doc.isbn?.[0] || "",
                pages: doc.number_of_pages_median || 0,
                publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : "",
                language: doc.language?.[0] || "",
                genres: (doc.subject || []).slice(0, 5),
                source: "api"
              }));
              const newOlResults = olResults.filter((api: any) => !allResults.find(m => m.isbn13 === api.isbn || m.isbn === api.isbn));
              allResults = [...allResults, ...newOlResults];
            }
          }
        } catch (err) {
          console.error("Open Library Error:", err);
          // On continue même si Open Library échoue ou expire
        }
      }

      // Garantie "jamais de livre sans couverture" : pour tout résultat
      // encore sans image après Google Books / Apple Books / Open Library,
      // tentative ultime via l'API de couvertures Open Library par ISBN
      // (gratuite, sans clé, très large couverture éditoriale). Si l'ISBN
      // n'a pas de couverture connue non plus, le composant BookCover gère
      // déjà l'échec de chargement avec un repli visuel soigné plutôt
      // qu'une image cassée.
      allResults = allResults.map((r) => {
        if (r.cover) return r;
        const isbnForCover = (r.isbn13 || r.isbn || "").toString().replace(/[-\s]/g, "");
        if (!isbnForCover) return r;
        return { ...r, cover: `https://covers.openlibrary.org/b/isbn/${isbnForCover}-L.jpg` };
      });

      setResults(sortBySaga(allResults));

      if (allResults.length === 0) {
        toast({ title: "Aucun résultat", description: "Aucune pépite trouvée pour cette recherche." });
      }

      // Journalisation anonyme des recherches pour le tableau de bord
      // admin — permet de savoir quels livres sont cherchés et non
      // trouvés, pour enrichir la base en priorité. Aucune donnée
      // personnelle : uniquement le terme, la date et si des résultats
      // ont été trouvés. Silencieux en cas d'échec.
      if (db) {
        addDoc(collection(db, "searchLogs"), {
          query: searchVal,
          resultsCount: allResults.length,
          hasResults: allResults.length > 0,
          searchMode,
          createdAt: serverTimestamp(),
        }).catch(() => {}); // jamais bloquant
      }

      // Mémorise la dernière recherche pour l'accès rapide "Ma précédente
      // recherche" — en local uniquement (pas de valeur pour la partager
      // entre appareils, et ça évite une écriture Firestore superflue).
      if (typeof window !== "undefined" && searchValOverride === undefined) {
        localStorage.setItem("lectoria_last_search", searchVal);
        setLastSearch(searchVal);
      }
    } finally {
      // Garantit que le spinner s'arrête toujours, quoi qu'il arrive
      setIsSearching(false);
    }
  };

  const searchBooks = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const handleIsbnScanned = (isbn: string) => {
    setQueryStr(isbn);
    setSearchMode("general");
    runSearch(isbn);
  };

  const handleAddClick = (book: any) => {
    setPendingBook(book);
  };

  // Réutilise exactement le même mécanisme que l'aimant sur la fiche
  // d'un livre (même route /api/fetch-link-preview) pour pré-remplir
  // résumé et couverture depuis un lien Wattpad, Amazon ou autre, sans
  // jamais écraser ce que la lectrice aurait déjà tapé à la main.
  const handleFetchManualLink = async () => {
    if (!manualForm.referenceLink) return;
    setIsFetchingManualLink(true);
    try {
      const res = await fetch(`/api/fetch-link-preview?url=${encodeURIComponent(manualForm.referenceLink)}`);
      const data = await res.json();
      if (data.error) {
        toast({ variant: "destructive", title: "Récupération impossible", description: data.error });
        return;
      }
      setManualForm((prev) => ({
        ...prev,
        title: prev.title || data.title || "",
        description: prev.description || cleanDescriptionHtml(data.description) || "",
        cover: prev.cover || data.image || "",
      }));
      if (!data.title && !data.description && !data.image) {
        toast({ title: "Rien à récupérer", description: "Cette page ne fournit pas ces informations — complète à la main." });
      } else {
        toast({ title: "Informations récupérées" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de contacter cette page." });
    } finally {
      setIsFetchingManualLink(false);
    }
  };

  // Transmet la fiche minimale au même circuit d'ajout que les
  // résultats de recherche habituels (handleAddClick → confirmAdd) —
  // aucune logique d'écriture Firestore dupliquée, donc aucun nouveau
  // risque : si l'ajout normal fonctionne, celui-ci fonctionne aussi.
  const handleManualSubmit = () => {
    if (!manualForm.title.trim() || !manualForm.author.trim()) {
      toast({ variant: "destructive", title: "Titre et auteur sont obligatoires" });
      return;
    }
    handleAddClick({
      title: manualForm.title.trim(),
      author: manualForm.author.trim(),
      cover: manualForm.cover,
      description: manualForm.description,
      referenceLink: manualForm.referenceLink,
      genres: [],
      source: "api",
    });
    setShowManualEntry(false);
    setManualForm({ title: "", author: "", referenceLink: "", description: "", cover: "" });
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;
    setIsAdding(true);

    try {
      let masterBookId = pendingBook.id;

      // BnF, Apple et Open Library envoient des sources différentes de
      // "api" (respectivement "bnf", "api" déjà, "api"). On normalise
      // ici pour que tous les résultats externes aillent dans masterBooks
      // sous un identifiant déterministe — au lieu de garder l'ID
      // temporaire généré côté client qui ne correspond à aucun document
      // en base et rend la fiche inaccessible immédiatement après l'ajout.
      const isExternalSource = pendingBook.source !== "master";

      if (isExternalSource) {
        const cleanedIsbn = cleanIsbnValue(pendingBook.isbn);
        const rawKey = cleanedIsbn || stableBookKey(pendingBook.title, pendingBook.author);
        // Garde-fou : si le titre ET l'auteur sont tous deux vides/null,
        // stableBookKey renvoie "-" qui est une valeur invalide comme
        // identifiant Firestore. On préfère un UUID court basé sur le
        // titre/auteur "inconnus" plutôt que laisser silencieusement
        // écraser toutes les fiches orphelines au même endroit.
        masterBookId = rawKey && rawKey !== "-" ? rawKey : `unknown-${Date.now()}`;

        const masterRef = doc(db, "masterBooks", masterBookId);
        const existingSnap = await getDoc(masterRef);
        const existing: any = existingSnap.exists() ? existingSnap.data() : {};
        const keepText = (incoming: any, current: any) => {
          const v = (incoming ?? "").toString().trim();
          return v ? v : (current ?? "");
        };
        const keepArr = (incoming: any, current: any) =>
          Array.isArray(incoming) && incoming.length ? incoming : (Array.isArray(current) ? current : []);
        const keepNum = (incoming: any, current: any) => (incoming > 0 ? incoming : (current ?? 0));

        await setDoc(masterRef, {
          title: keepText(pendingBook.title, existing.title) || "Titre inconnu",
          subtitle: keepText(pendingBook.subtitle, existing.subtitle),
          author: keepText(pendingBook.author, existing.author) || "Auteur inconnu",
          cover: keepText(pendingBook.cover, existing.cover),
          isbn13: keepText(cleanedIsbn, existing.isbn13),
          isbn10: keepText(pendingBook.isbn10, existing.isbn10),
          description: keepText(pendingBook.description, existing.description),
          publisher: keepText(pendingBook.publisher, existing.publisher),
          translator: keepText(pendingBook.translator, existing.translator),
          pageCount: keepNum(pendingBook.pages, existing.pageCount),
          language: keepText(pendingBook.language, existing.language),
          publishedDate: keepText(pendingBook.publishedDate ?? pendingBook.publicationDate, existing.publishedDate),
          genres: keepArr(toArray<string>(pendingBook.genres), existing.genres),
          updatedAt: serverTimestamp(),
          source: existing.source || "discovered"
        }, { merge: true });
      }

      // 2. Ajout à la bibliothèque personnelle. On copie les genres ici
      // aussi (en plus du masterBook) : les badges/médailles du profil
      // se basent sur le champ "genres" du livre utilisateur, pas du
      // masterBook, sans quoi ils ne se débloqueraient jamais. On copie
      // aussi résumé/tropes/thèmes/éditeur quand le master les a déjà
      // (curation admin) : sans ça, le travail de complétion des fiches
      // ne profiterait jamais aux lectrices qui ajoutent le livre.
      const userBookData = {
        masterBookId,
        title: pendingBook.title || "Titre inconnu",
        author: pendingBook.author || "Auteur inconnu",
        cover: pendingBook.cover || "",
        genres: toArray<string>(pendingBook.genres),
        tropes: toArray<string>(pendingBook.tropes),
        themes: toArray<string>(pendingBook.themes),
        description: pendingBook.description || "",
        volume: pendingBook.volume || "",
        referenceLink: pendingBook.referenceLink || "",
        status: selectedStatus,
        format: selectedFormat,
        dateAdded: serverTimestamp(),
        countTowardGoals: (selectedStatus === "read" || selectedStatus === "reread") ? countTowardGoals : true,
      };

      await addDoc(collection(db, "users", user.uid, "books"), userBookData);
      
      toast({ title: "Pépite ajoutée", description: `${pendingBook.title} est dans votre réserve.` });
      setPendingBook(null);
    } catch (err: any) {
      console.error("Add Book Error:", err);
      // On affiche le vrai message d'erreur (ex: règles Firestore, champ
      // invalide...) plutôt qu'un message générique, pour pouvoir
      // diagnostiquer sans avoir besoin d'ouvrir la console du navigateur.
      toast({
        variant: "destructive",
        title: "Impossible d'ajouter le livre",
        description: err?.message || "Erreur inconnue.",
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Par défaut, n'affiche que les résultats français (ou de langue non
  // précisée — surtout les fiches Lectoria et Apple, qui ne fournissent
  // pas toujours cette info, donc on ne les masque jamais à tort). Le
  // toggle "Afficher toutes les langues" révèle le reste sans relancer
  // de recherche, puisque tout est déjà chargé en mémoire.
  const visibleResults = useMemo(() => {
    if (showAllLanguages) return results;
    return results.filter((b) => b.source === "master" || isFrenchLanguage(b.language));
  }, [results, showAllLanguages]);
  const hiddenCount = results.length - visibleResults.length;

  return (
    <div className="space-y-12 animate-paper pb-32">
      <header className="text-center space-y-4 pt-8">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-headline italic">Nouvelles Pépites</h1>
        <p className="text-primary/60 italic">Recherchez dans la base Lectoria ou sur le web.</p>
      </header>

      {isAdmin && (
        <div className="max-w-2xl mx-auto rounded-[2rem] border-2 border-primary/20 bg-primary/5 p-6">
          <IsbnImporter />
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="w-full h-12 md:h-16 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 flex items-center justify-center gap-2 md:gap-3 font-headline italic text-sm md:text-xl hover:scale-[1.01] active:scale-[0.99] transition-transform"
        >
          <ScanBarcode className="h-5 w-5 md:h-7 md:w-7" />
          Scanner un livre (ISBN)
        </button>

        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearchMode("general")}
            className={cn(
              "rounded-full h-9 px-5 text-[10px] uppercase font-bold tracking-widest transition-all",
              searchMode === "general" ? "bg-primary text-white border-primary shadow-sm" : "bg-white/40"
            )}
          >
            Titre, auteur ou ISBN
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearchMode("publisher")}
            className={cn(
              "rounded-full h-9 px-5 text-[10px] uppercase font-bold tracking-widest transition-all",
              searchMode === "publisher" ? "bg-primary text-white border-primary shadow-sm" : "bg-white/40"
            )}
          >
            Éditeur (BMR, Nox, Hugo...)
          </Button>
        </div>
        <form onSubmit={searchBooks} className="flex gap-4">
          <Input 
            placeholder={searchMode === "publisher" ? "Nom de l'éditeur (BMR, Nox, Chatterley, Hugo, &H...)" : "Titre, auteur ou ISBN..."}
            value={queryStr}
            onChange={(e) => setQueryStr(e.target.value)}
            className="h-14 rounded-2xl bg-white/60 border-white shadow-sm italic text-lg"
          />
          <Button type="submit" disabled={isSearching} className="h-14 px-8 rounded-2xl bg-primary text-lg font-headline italic">
            {isSearching ? <Loader2 className="animate-spin h-6 w-6" /> : <Search className="h-6 w-6" />}
          </Button>
        </form>
        {lastSearch && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => { setQueryStr(lastSearch); runSearch(lastSearch); }}
              className="inline-flex items-center gap-2 text-xs italic text-primary/60 hover:text-primary transition-colors bg-white/40 hover:bg-white/70 rounded-full px-4 py-2"
            >
              <History className="h-3.5 w-3.5" /> Ma précédente recherche : <span className="font-bold not-italic">{lastSearch}</span>
            </button>
          </div>
        )}
        <div className="text-center pt-3">
          <button
            onClick={() => setShowManualEntry(true)}
            className="inline-flex items-center gap-2 text-xs italic text-primary/50 hover:text-primary transition-colors underline underline-offset-4"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Je ne trouve pas mon livre (auto-édition, Wattpad...)
          </button>
        </div>
      </div>

      <IsbnScannerDialog open={showScanner} onOpenChange={setShowScanner} onScan={handleIsbnScanned} />

      <Dialog open={showManualEntry} onOpenChange={(o) => { setShowManualEntry(o); if (!o) setManualForm({ title: "", author: "", referenceLink: "", description: "", cover: "" }); }}>
        <DialogContent className="glass-card border-none max-w-lg p-10 bg-white/95 backdrop-blur-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Ajouter un livre introuvable</DialogTitle>
          </DialogHeader>
          <p className="text-xs italic opacity-50 -mt-2">Pour un livre auto-édité, sur Wattpad, ou absent de nos sources habituelles. La fiche sera complétée plus tard si besoin.</p>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Titre *"
              value={manualForm.title}
              onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
              className="h-12 rounded-xl bg-white/60 italic"
            />
            <Input
              placeholder="Auteur *"
              value={manualForm.author}
              onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })}
              className="h-12 rounded-xl bg-white/60 italic"
            />
            <div className="flex gap-2">
              <Input
                placeholder="Lien Wattpad, Amazon... (facultatif)"
                value={manualForm.referenceLink}
                onChange={(e) => setManualForm({ ...manualForm, referenceLink: e.target.value })}
                className="h-12 rounded-xl bg-white/60 italic"
              />
              <Button
                type="button"
                onClick={handleFetchManualLink}
                disabled={isFetchingManualLink || !manualForm.referenceLink}
                variant="secondary"
                title="Capturer le résumé et la couverture depuis ce lien"
                className="h-12 px-4 rounded-xl shrink-0"
              >
                {isFetchingManualLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Magnet className="h-4 w-4" />}
              </Button>
            </div>
            {manualForm.cover && (
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-14 rounded-lg overflow-hidden shrink-0 bg-secondary/5 shadow-sm">
                  <img src={manualForm.cover} alt="" className="w-full h-full object-cover" />
                </div>
                <p className="text-[11px] italic opacity-50">Couverture récupérée depuis le lien.</p>
              </div>
            )}
            <p className="text-[10px] italic opacity-40">Le résumé et la couverture se complètent automatiquement si le lien le permet — sinon, pas de souci, la fiche pourra être enrichie plus tard.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleManualSubmit} className="w-full h-12 rounded-2xl bg-primary font-headline italic">
              <Plus className="mr-2 h-4 w-4" /> Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto grid gap-6">
        {results.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 px-2">
            <p className="text-[11px] italic opacity-50">
              {showAllLanguages ? "Tous les résultats, toutes langues confondues." : "Résultats en français affichés en priorité."}
            </p>
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllLanguages((v) => !v)}
                className="text-[11px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors underline underline-offset-4"
              >
                {showAllLanguages ? "Revenir au français uniquement" : `Afficher aussi les autres langues (+${hiddenCount})`}
              </button>
            )}
          </div>
        )}
        {visibleResults.map((book) => (
          <Card key={book.id} className="glass-card overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0 flex flex-col sm:flex-row">
              <div className="relative w-32 aspect-[2/3] bg-secondary/5 shrink-0 overflow-hidden">
                {book.source === 'master' ? (
                  <Link href={`/master-book/${book.id}`} className="block w-full h-full">
                    {book.cover ? (
                      <BookCover src={book.cover} alt={book.title} className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/5 to-secondary/10 p-2">
                        <span className="text-2xl">📖</span>
                        <span className="text-[8px] text-center italic opacity-40 leading-tight">Couverture<br/>bientôt</span>
                      </div>
                    )}
                  </Link>
                ) : (
                  <button onClick={() => setPreviewBook(book)} className="block w-full h-full">
                    {book.cover ? (
                      <BookCover src={book.cover} alt={book.title} className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/5 to-secondary/10 p-2">
                        <span className="text-2xl">📖</span>
                        <span className="text-[8px] text-center italic opacity-40 leading-tight">Couverture<br/>bientôt</span>
                      </div>
                    )}
                  </button>
                )}
              </div>
              <div className="p-6 flex flex-1 items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-headline italic leading-tight">{book.title}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase">{book.author}</p>
                  {book.publisher && <p className="text-[10px] text-primary/50 italic">{book.publisher}</p>}
                  <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[8px] mt-1">
                    {languageLabel(book.language)}
                  </Badge>
                  {book.source === 'master' && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none text-[8px] mt-2">
                      Base Lectoria
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && book.source === 'master' && (
                    <button
                      onClick={() => openMasterEditor(book.id)}
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-primary border border-primary/10 bg-white/40 hover:bg-white/70 transition-colors"
                      title="Éditer la fiche (admin)"
                    >
                      {isLoadingEditBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  )}
                  <Button onClick={() => handleAddClick(book)} className="h-12 px-6 rounded-xl bg-primary italic shrink-0">
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] border-none">
          <DialogHeader className="p-10 border-b bg-white/40">
            <DialogTitle className="font-headline text-3xl italic">Ajouter dans ma réserve</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Intention</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <Button 
                      key={k} 
                      variant="outline" 
                      onClick={() => setSelectedStatus(k as BookStatus)} 
                      className={cn(
                        "rounded-full h-10 px-4 text-[10px] uppercase font-bold transition-all", 
                        selectedStatus === k ? "bg-primary text-white border-primary" : "bg-white/60"
                      )}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(FORMATS).map(([k, v]) => (
                    <Button 
                      key={k} 
                      variant="outline" 
                      onClick={() => setSelectedFormat(k as BookFormat)} 
                      className={cn(
                        "rounded-xl h-12 flex gap-3 italic transition-all", 
                        selectedFormat === k ? "bg-primary text-white border-primary" : "bg-white/60"
                      )}
                    >
                      <v.icon className="h-4 w-4" /> {v.label}
                    </Button>
                  ))}
                </div>
              </div>
              {(selectedStatus === "read" || selectedStatus === "reread") && (
                <div className="flex items-start gap-3 p-5 rounded-2xl bg-secondary/10 border border-secondary/20">
                  <Checkbox
                    id="count-goals"
                    checked={countTowardGoals}
                    onCheckedChange={(v) => setCountTowardGoals(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="count-goals" className="text-sm italic leading-relaxed cursor-pointer">
                    Compter ce livre dans mes objectifs de lecture (hebdomadaire, mensuel, annuel).
                    <span className="block text-[10px] text-muted-foreground not-italic mt-1">Décochez si c'est une ancienne lecture que vous ajoutez à votre bibliothèque, pour ne pas fausser vos objectifs en cours.</span>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-10 border-t bg-white/60">
            <Button onClick={confirmAdd} disabled={isAdding} className="w-full h-14 rounded-2xl bg-primary text-xl font-headline italic">
              {isAdding ? <Loader2 className="animate-spin" /> : (selectedStatus === "envie" ? "Ajouter à ma Wishlist" : "Confirmer l'ajout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewBook} onOpenChange={(open) => !open && setPreviewBook(null)}>
        <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {previewBook && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row gap-8">
                  <div className="relative w-40 aspect-[2/3] rounded-2xl overflow-hidden shadow-lg mx-auto sm:mx-0 shrink-0 bg-secondary/5">
                    <BookCover src={previewBook.cover} alt={previewBook.title} className="object-cover" />
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <h2 className="text-3xl font-headline italic leading-tight">{previewBook.title}</h2>
                    <p className="text-sm text-muted-foreground font-bold uppercase">{previewBook.author}</p>
                    {previewBook.publisher && <p className="text-xs text-primary/50 italic">{previewBook.publisher}</p>}
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-primary/5 space-y-2">
                  <h3 className="font-headline italic opacity-50">Résumé</h3>
                  <p className="text-sm italic text-muted-foreground leading-relaxed whitespace-pre-line">
                    {cleanDescriptionHtml(previewBook.description) || "Pas encore de résumé pour cette pépite."}
                  </p>
                </div>
                <Button
                  onClick={() => { setPendingBook(previewBook); setPreviewBook(null); }}
                  className="w-full h-14 rounded-2xl bg-primary italic font-headline text-lg"
                >
                  <Plus className="mr-2 h-5 w-5" /> Ajouter à ma bibliothèque
                </Button>
              </div>
            )}
          </ScrollArea>
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
    </div>
  );
}