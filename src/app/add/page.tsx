
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, BookPlus, Loader2, Sparkles, Calendar, Tag, Info } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    setResults([]);
    
    const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15`;
    
    console.log(`[PLUME] Début de recherche pour: "${query}"`);
    console.log(`[PLUME] URL de requête: ${searchUrl}`);

    try {
      const response = await fetch(searchUrl);
      
      console.log(`[PLUME] Statut de la réponse: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[PLUME] Données reçues:`, data);
      
      const formattedResults = data.items?.map((item: any) => {
        const info = item.volumeInfo;
        return {
          id: item.id,
          title: info.title || "Titre inconnu",
          author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
          publisher: info.publisher || "Éditeur inconnu",
          // Conversion HTTP -> HTTPS pour les couvertures Google
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
          pages: info.pageCount || 0,
          description: info.description || "Aucun résumé disponible.",
          publicationDate: info.publishedDate || "Date inconnue",
          genres: info.categories || [],
          isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                info.industryIdentifiers?.[0]?.identifier || 
                "N/A",
          series: info.series || "",
          volume: info.volume || ""
        };
      }) || [];

      console.log(`[PLUME] Nombre de résultats formatés: ${formattedResults.length}`);
      setResults(formattedResults);
      
      if (formattedResults.length === 0) {
        toast({ 
          title: "Aucun résultat", 
          description: "Désolé, nous n'avons trouvé aucun livre correspondant à votre recherche." 
        });
      }
    } catch (error: any) {
      console.error(`[PLUME] Erreur lors de la recherche:`, error);
      toast({ 
        variant: "destructive", 
        title: "Erreur de connexion", 
        description: "Impossible de contacter le service Google Books. Vérifiez votre connexion." 
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addBook = async (book: any) => {
    if (!db || !user) {
      toast({ 
        variant: "destructive", 
        title: "Action impossible", 
        description: "Vous devez être connecté pour ajouter un livre." 
      });
      return;
    }

    const bookData = {
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      isbn: book.isbn,
      publicationDate: book.publicationDate,
      series: book.series,
      volume: book.volume,
      cover: book.cover || "https://picsum.photos/seed/placeholder/200/300",
      description: book.description,
      genres: book.genres,
      tropes: [],
      pages: book.pages,
      status: "pal",
      favorite: false,
      progress: 0,
      pagesRead: 0,
      createdAt: serverTimestamp(),
    };

    const booksRef = collection(db, "users", user.uid, "books");

    console.log(`[PLUME] Ajout du livre à Firestore:`, book.title);

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${book.title} a rejoint votre bibliothèque.`,
        });
      })
      .catch(async (e) => {
        console.error(`[PLUME] Erreur Firestore lors de l'ajout:`, e);
        const permissionError = new FirestorePermissionError({
          path: booksRef.path,
          operation: 'create',
          requestResourceData: bookData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="space-y-10 animate-paper pb-20">
      <header className="text-center space-y-4 pt-4">
        <div className="flex justify-center">
          <Sparkles className="h-10 w-10 text-primary/40 animate-float" />
        </div>
        <h1 className="text-5xl font-headline italic tracking-tight">Nouvelle Pépite</h1>
        <p className="text-primary/60 italic font-medium max-w-md mx-auto">
          Recherchez votre prochain voyage littéraire par titre, auteur ou ISBN.
        </p>
      </header>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-3 px-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Titre, auteur ou ISBN..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-14 bg-white/60 border-white shadow-sm rounded-2xl text-lg italic focus-visible:ring-primary/20"
          />
        </div>
        <Button 
          type="submit" 
          className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10 font-headline italic text-lg min-w-[140px]" 
          disabled={isSearching}
        >
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Chercher"}
        </Button>
      </form>

      <div className="max-w-3xl mx-auto space-y-6 px-4">
        {results.length > 0 ? (
          results.map((book) => (
            <Card key={book.id} className="glass-card overflow-hidden hover:bg-white/80 transition-all duration-500 group border-none">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-44 aspect-[2/3] shrink-0 overflow-hidden bg-muted">
                  <Image 
                    src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
                    alt={book.title} 
                    fill 
                    className="object-cover transition-transform duration-1000 group-hover:scale-110" 
                    data-ai-hint="book cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                
                <div className="p-6 flex flex-col flex-1 gap-3">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-headline italic leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                    <p className="text-[10px] text-primary/60 font-bold italic">{book.publisher}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {book.publicationDate}</div>
                    <div className="flex items-center gap-1.5"><Tag className="h-3 w-3" /> {book.pages} pages</div>
                    <div className="flex items-center gap-1.5"><Info className="h-3 w-3" /> ISBN: {book.isbn}</div>
                  </div>

                  <ScrollArea className="h-24 pr-4 border-l-2 border-primary/5 pl-4 mt-2">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      {book.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </ScrollArea>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {book.genres.slice(0, 3).map((g: string) => (
                      <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-bold uppercase">
                        {g}
                      </Badge>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      onClick={() => addBook(book)} 
                      className="rounded-xl bg-primary hover:bg-primary/90 shadow-md h-12 px-8 font-headline italic text-sm flex gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter à ma bibliothèque
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : !isSearching && (
          <div className="py-24 text-center space-y-6">
            <BookPlus className="h-20 w-20 mx-auto text-primary/10 animate-pulse" />
            <div className="space-y-2">
              <p className="italic font-headline text-2xl text-primary/40">Le monde entier dans votre carnet.</p>
              <p className="text-sm text-muted-foreground italic">Capturez vos futures lectures avec précision.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
