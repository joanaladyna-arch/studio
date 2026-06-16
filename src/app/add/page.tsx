"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2,
  X
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, fetchWithTimeout, toArray } from "@/lib/utils";

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [queryStr, setQueryStr] = useState("");
  const [searchMode, setSearchMode] = useState<"general" | "publisher">("general");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
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
      // 1 & 2. Recherche Master Database (Plume) et Google Books en parallèle :
      // ces deux sources sont indépendantes, les attendre en série n'apporte
      // rien et double la latence perçue par l'utilisatrice.
      const [masterSettled, googleSettled] = await Promise.allSettled([
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
                         info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "N/A";
            const isbn10 = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "";
            return {
              id: item.id,
              title: info.title || "Titre inconnu",
              subtitle: info.subtitle || "",
              author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              isbn: isbn,
              isbn10: isbn10,
              description: info.description || "",
              publisher: info.publisher || "",
              pages: info.pageCount || 0,
              language: info.language || "",
              publishedDate: info.publishedDate || "",
              genres: info.categories || [],
              source: "api"
            };
          });
        })(),
      ]);

      if (masterSettled.status === "fulfilled") {
        allResults = [...masterSettled.value];
      } else {
        console.error("Master Search Error:", masterSettled.reason);
        // On continue même si la base Plume échoue
      }

      if (googleSettled.status === "fulfilled") {
        // Merge avoiding duplicates by ISBN
        const newApiResults = googleSettled.value.filter((api: any) => !allResults.find(m => m.isbn13 === api.isbn || m.isbn === api.isbn));
        allResults = [...allResults, ...newApiResults];
      } else {
        console.error("Google Books Error:", googleSettled.reason);
        // On continue même si Google Books échoue ou expire
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
                isbn: doc.isbn?.[0] || "N/A",
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

      setResults(allResults);

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

      // 1. Si source est API, on crée le document dans masterBooks avec
      // toutes les informations bibliographiques disponibles (livre, auteur, édition)
      if (pendingBook.source === "api") {
        const masterRef = doc(collection(db, "masterBooks"));
        masterBookId = masterRef.id;
        await setDoc(masterRef, {
          title: pendingBook.title || "Titre inconnu",
          subtitle: pendingBook.subtitle || "",
          author: pendingBook.author || "Auteur inconnu",
          cover: pendingBook.cover || "",
          isbn13: pendingBook.isbn || "",
          isbn10: pendingBook.isbn10 || "",
          description: pendingBook.description || "",
          publisher: pendingBook.publisher || "",
          pageCount: pendingBook.pages || 0,
          language: pendingBook.language || "",
          publishedDate: pendingBook.publishedDate || "",
          genres: toArray<string>(pendingBook.genres),
          updatedAt: serverTimestamp(),
          source: "discovered"
        });
      }

      // 2. Ajout à la bibliothèque personnelle. On copie les genres ici
      // aussi (en plus du masterBook) : les badges/médailles du profil
      // se basent sur le champ "genres" du livre utilisateur, pas du
      // masterBook, sans quoi ils ne se débloqueraient jamais.
      const userBookData = {
        masterBookId,
        title: pendingBook.title || "Titre inconnu",
        author: pendingBook.author || "Auteur inconnu",
        cover: pendingBook.cover || "",
        genres: toArray<string>(pendingBook.genres),
        status: selectedStatus,
        format: selectedFormat,
        dateAdded: serverTimestamp(),
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
        <p className="text-primary/60 italic">Recherchez dans la base Plume ou sur le web.</p>
      </header>

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
                <Image src={book.cover || "https://picsum.photos/seed/p/200/300"} alt={book.title} fill className="object-cover" />
              </div>
              <div className="p-6 flex flex-1 items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-headline italic leading-tight">{book.title}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase">{book.author}</p>
                  {book.publisher && <p className="text-[10px] text-primary/50 italic">{book.publisher}</p>}
                  {book.source === 'master' && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none text-[8px] mt-2">
                      Base Plume
                    </Badge>
                  )}
                </div>
                <Button onClick={() => handleAddClick(book)} className="h-12 px-6 rounded-xl bg-primary italic shrink-0">
                  Ajouter
                </Button>
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
            </div>
          </div>
          <DialogFooter className="p-10 border-t bg-white/60">
            <Button onClick={confirmAdd} disabled={isAdding} className="w-full h-14 rounded-2xl bg-primary text-xl font-headline italic">
              {isAdding ? <Loader2 className="animate-spin" /> : "Confirmer l'ajout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}