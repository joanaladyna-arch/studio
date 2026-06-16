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
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn } from "@/lib/utils";

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [queryStr, setQueryStr] = useState("");
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
      toast({ title: "Champ vide", description: "Veuillez saisir un titre ou un auteur." });
      return;
    }
    if (!db) return;

    setIsSearching(true);
    setResults([]);

    let allResults: any[] = [];

    // 1. Recherche Master Database (Plume)
    try {
      const masterRef = collection(db, "masterBooks");
      // Recherche simple par égalité ou préfixe (attention aux index Firestore)
      const q = query(masterRef, where("title", ">=", searchVal), where("title", "<=", searchVal + "\uf8ff"));
      const masterSnap = await getDocs(q);
      const plumeResults = masterSnap.docs.map(d => ({ ...d.data(), id: d.id, source: "master" }));
      allResults = [...plumeResults];
    } catch (err) {
      console.error("Master Search Error:", err);
      // On continue même si la base Plume échoue
    }

    // 2. Fallback Google Books
    try {
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchVal)}&maxResults=10`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          const googleResults = data.items.map((item: any) => {
            const info = item.volumeInfo;
            const isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "N/A";
            return {
              id: item.id,
              title: info.title,
              author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              isbn: isbn,
              description: info.description || "",
              publisher: info.publisher || "",
              pages: info.pageCount || 0,
              source: "api"
            };
          });
          // Merge avoiding duplicates by ISBN
          const newApiResults = googleResults.filter((api: any) => !allResults.find(m => m.isbn13 === api.isbn || m.isbn === api.isbn));
          allResults = [...allResults, ...newApiResults];
        }
      }
    } catch (err) {
      console.error("Google Books Error:", err);
    }

    // 3. Fallback Open Library (si toujours peu de résultats)
    if (allResults.length < 5) {
      try {
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchVal)}&limit=5`;
        const res = await fetch(olUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.docs) {
            const olResults = data.docs.map((doc: any) => ({
              id: doc.key,
              title: doc.title,
              author: doc.author_name ? doc.author_name.join(", ") : "Inconnu",
              cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
              isbn: doc.isbn?.[0] || "N/A",
              pages: doc.number_of_pages_median || 0,
              source: "api"
            }));
            const newOlResults = olResults.filter((api: any) => !allResults.find(m => m.isbn13 === api.isbn || m.isbn === api.isbn));
            allResults = [...allResults, ...newOlResults];
          }
        }
      } catch (err) {
        console.error("Open Library Error:", err);
      }
    }

    setResults(allResults);
    setIsSearching(false);
    
    if (allResults.length === 0) {
      toast({ title: "Aucun résultat", description: "Aucune pépite trouvée pour cette recherche." });
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

      // 1. Si source est API, on crée le document dans masterBooks
      if (pendingBook.source === "api") {
        const masterRef = doc(collection(db, "masterBooks"));
        masterBookId = masterRef.id;
        await setDoc(masterRef, {
          title: pendingBook.title,
          author: pendingBook.author,
          cover: pendingBook.cover || "",
          isbn13: pendingBook.isbn || "",
          description: pendingBook.description || "",
          publisher: pendingBook.publisher || "",
          pageCount: pendingBook.pages || 0,
          updatedAt: serverTimestamp(),
          source: "discovered"
        });
      }

      // 2. Ajout à la bibliothèque personnelle
      const userBookData = {
        masterBookId,
        title: pendingBook.title,
        author: pendingBook.author,
        cover: pendingBook.cover || "",
        status: selectedStatus,
        format: selectedFormat,
        dateAdded: serverTimestamp(),
      };

      await addDoc(collection(db, "users", user.uid, "books"), userBookData);
      
      toast({ title: "Pépite ajoutée", description: `${pendingBook.title} est dans votre sanctuaire.` });
      setPendingBook(null);
    } catch (err) {
      console.error("Add Book Error:", err);
      toast({ variant: "destructive", title: "Impossible d'ajouter le livre" });
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

      <form onSubmit={searchBooks} className="max-w-2xl mx-auto flex gap-4">
        <Input 
          placeholder="Titre, auteur ou ISBN..." 
          value={queryStr}
          onChange={(e) => setQueryStr(e.target.value)}
          className="h-14 rounded-2xl bg-white/60 border-white shadow-sm italic text-lg"
        />
        <Button type="submit" disabled={isSearching} className="h-14 px-8 rounded-2xl bg-primary text-lg font-headline italic">
          {isSearching ? <Loader2 className="animate-spin h-6 w-6" /> : <Search className="h-6 w-6" />}
        </Button>
      </form>

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
            <DialogTitle className="font-headline text-3xl italic">Ajouter au sanctuaire</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
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
          </ScrollArea>
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