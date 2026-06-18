"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2,
  X,
  Pencil
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
import { Checkbox } from "@/components/ui/checkbox";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, fetchWithTimeout, toArray, searchBnF, ADMIN_EMAILS, cleanDescriptionHtml, cleanIsbnValue, stableBookKey, sortBySaga } from "@/lib/utils";
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
  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [previewBook, setPreviewBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [countTowardGoals, setCountTowardGoals] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const searchBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    const searchVal = queryStr.trim();
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
      // 1, 2 & 3. Recherche Master Database (Lectoria), Google Books et BnF
      // (Bibliothèque nationale de France) en parallèle : ces trois
      // sources sont indépendantes, les attendre en série n'apporte
      // rien et double/triple la latence perçue par l'utilisatrice.
      // La BnF référence par dépôt légal tout livre publié en France,
      // y compris les petites maisons (BMR, Nox, Chatterley...) que
      // Google Books manque souvent.
      const bnfType = isIsbnQuery ? "isbn" : searchMode === "publisher" ? "publisher" : "general";
      const [masterSettled, googleSettled, bnfSettled, appleSettled] = await Promise.allSettled([
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
          const bnfResults = await searchBnF(searchVal, bnfType);
          return bnfResults.map((b: any) => ({
            id: b.id,
            title: b.title || "Titre inconnu",
            subtitle: "",
            author: b.author || "Auteur inconnu",
            translator: b.translator || "",
            cover: b.cover || undefined,
            isbn: b.isbn || "",
            isbn10: "",
            description: cleanDescriptionHtml(b.description),
            publisher: b.publisher || "",
            pages: 0,
            language: b.language || "",
            publishedDate: b.publishedDate || "",
            genres: toArray<string>(b.genres),
            source: "api"
          }));
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

      if (bnfSettled.status === "fulfilled") {
        // Doublons exclus par ISBN, mais aussi par titre+auteur : la BnF
        // ne renvoie pas toujours d'ISBN propre, l'ISBN seul ne suffit
        // donc pas ici à éviter les répétitions avec Google Books.
        const newBnfResults = bnfSettled.value.filter((b: any) =>
          !allResults.find(m =>
            (m.isbn13 === b.isbn || m.isbn === b.isbn) ||
            ((m.title || "").toLowerCase() === (b.title || "").toLowerCase() && (m.author || "").toLowerCase() === (b.author || "").toLowerCase())
          )
        );
        allResults = [...allResults, ...newBnfResults];
      } else {
        console.error("BnF Error:", bnfSettled.reason);
        // On continue même si la BnF échoue ou expire : source bonus, pas bloquante
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

      setResults(sortBySaga(allResults));

      if (allResults.length === 0) {
        toast({ title: "Aucun résultat", description: "Aucune pépite trouvée pour cette recherche." });
      }
    } finally {
      // Garantit que le spinner s'arrête toujours, quoi qu'il arrive
      setIsSearching(false);
    }
  };

  const handleAddClick = (book: any) => {
    setPendingBook(book);
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;
    setIsAdding(true);

    try {
      let masterBookId = pendingBook.id;

      // 1. Si source est API, on crée — ou on RETROUVE — le document dans
      // masterBooks. Avant, un identifiant aléatoire était généré à
      // chaque ajout, ce qui créait une fiche en double dès que le même
      // livre était retrouvé une seconde fois avec une légère variation
      // de titre/auteur (ponctuation, casse, mention BnF "auteur du
      // texte"...). Désormais l'identifiant est déterministe (l'ISBN
      // nettoyé en priorité, sinon une clé stable basée sur titre+auteur
      // normalisés) : un même livre retombe systématiquement sur la même
      // fiche, qu'on le retrouve via Google Books, la BnF, ou un import
      // ultérieur. Si la fiche existe déjà, on ne l'écrase jamais — on ne
      // complète que les champs encore vides (même logique que la
      // protection anti-écrasement de l'import Excel).
      if (pendingBook.source === "api") {
        const cleanedIsbn = cleanIsbnValue(pendingBook.isbn);
        masterBookId = cleanedIsbn || stableBookKey(pendingBook.title, pendingBook.author);
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
          publishedDate: keepText(pendingBook.publishedDate, existing.publishedDate),
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

  return (
    <div className="space-y-12 animate-paper pb-32">
      <header className="text-center space-y-4 pt-8">
        <h1 className="text-6xl font-headline italic">Nouvelles Pépites</h1>
        <p className="text-primary/60 italic">Recherchez dans la base Lectoria ou sur le web.</p>
      </header>

      {isAdmin && (
        <div className="max-w-2xl mx-auto rounded-[2rem] border-2 border-primary/20 bg-primary/5 p-6">
          <IsbnImporter />
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-4">
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
      </div>

      <div className="max-w-4xl mx-auto grid gap-6">
        {results.map((book) => (
          <Card key={book.id} className="glass-card overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0 flex flex-col sm:flex-row">
              <div className="relative w-32 aspect-[2/3] bg-secondary/5 shrink-0">
                {book.source === 'master' ? (
                  <Link href={`/master-book/${book.id}`} className="block w-full h-full">
                    <BookCover src={book.cover} alt={book.title} className="object-cover" />
                  </Link>
                ) : (
                  <button onClick={() => setPreviewBook(book)} className="block w-full h-full">
                    <BookCover src={book.cover} alt={book.title} className="object-cover" />
                  </button>
                )}
              </div>
              <div className="p-6 flex flex-1 items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-headline italic leading-tight">{book.title}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase">{book.author}</p>
                  {book.publisher && <p className="text-[10px] text-primary/50 italic">{book.publisher}</p>}
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