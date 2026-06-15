"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Barcode, BookPlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      
      const formattedResults = data.docs.map((doc: any) => ({
        id: doc.key,
        title: doc.title,
        author: doc.author_name ? doc.author_name[0] : "Auteur inconnu",
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
        totalPages: doc.number_of_pages_median || doc.number_of_pages || 0,
        isbn: doc.isbn ? doc.isbn[0] : null,
        key: doc.key
      }));

      setResults(formattedResults);
      if (formattedResults.length === 0) {
        toast({ title: "Aucun résultat", description: "Désolé, nous n'avons trouvé aucun livre correspondant." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de contacter Open Library." });
    } finally {
      setIsSearching(false);
    }
  };

  const addBook = async (book: any) => {
    if (!db || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez être connecté pour ajouter un livre." });
      return;
    }

    // On pourrait ici faire un deuxième appel pour récupérer la description (summary) via le "key"
    // mais pour une MVP, on importe les données déjà présentes dans la recherche.
    const bookData = {
      title: book.title,
      author: book.author,
      cover: book.cover || "https://picsum.photos/seed/placeholder/200/300",
      status: "pal",
      favorite: false,
      totalPages: book.totalPages,
      pagesRead: 0,
      progress: 0,
      createdAt: serverTimestamp()
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${book.title} a été ajouté à votre bibliothèque (PAL).`,
        });
      })
      .catch(async (e) => {
        const permissionError = new FirestorePermissionError({
          path: booksRef.path,
          operation: 'create',
          requestResourceData: bookData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline italic">Ajouter une pépite</h1>
        <p className="text-muted-foreground italic">Recherchez par titre, auteur ou ISBN via Open Library.</p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
          <Input 
            placeholder="L'élégance du hérisson, 978..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-12 bg-white/40 border-white/60 focus-visible:ring-primary/30 rounded-2xl"
          />
        </div>
        <Button size="icon" variant="outline" className="h-12 w-12 rounded-2xl border-white/60 bg-white/40">
          <Barcode className="h-6 w-6 text-primary/40" />
        </Button>
        <Button type="submit" className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90" disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
        </Button>
      </form>

      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((book) => (
            <Card key={book.id} className="glass-card hover:bg-white/80 transition-all duration-300">
              <CardContent className="p-4 flex gap-4 items-center">
                <div className="relative h-24 w-16 shrink-0 rounded-xl overflow-hidden shadow-sm border border-white/40">
                  <Image 
                    src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
                    alt={book.title} 
                    fill 
                    className="object-cover" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline text-lg line-clamp-1 italic">{book.title}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                  {book.totalPages > 0 && (
                    <p className="text-[10px] text-primary/60 mt-1 italic">{book.totalPages} pages</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => addBook(book)} className="text-primary hover:text-primary hover:bg-primary/10 rounded-full h-12 w-12">
                  <Plus className="h-6 w-6" />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : !isSearching && (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-40">
            <BookPlus className="h-16 w-16" />
            <p className="italic font-headline text-lg">Recherchez un livre pour l'ajouter à votre PAL.</p>
          </div>
        )}
      </div>
    </div>
  );
}
