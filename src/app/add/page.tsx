"use client";

import { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  BookPlus, 
  Loader2, 
  Sparkles, 
  Calendar, 
  Tag, 
  Info, 
  AlertCircle,
  Building2,
  Hash,
  Languages,
  BookOpen
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Simple cache structure
const searchCache: Record<string, any[]> = {};

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const lastSearchTime = useRef<number>(0);
  const { toast } = useToast();

  const searchOpenLibrary = async (q: string) => {
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`;
    console.log(`[PLUME] Appel de secours Open Library: ${olUrl}`);

    try {
      const response = await fetch(olUrl);
      if (!response.ok) throw new Error(`Erreur Open Library: ${response.status}`);

      const data = await response.json();
      const formattedResults = data.docs?.map((doc: any) => ({
        id: doc.key,
        source: 'openlibrary',
        title: doc.title || "Titre inconnu",
        author: doc.author_name ? doc.author_name.join(", ") : "Auteur inconnu",
        publisher: doc.publisher ? doc.publisher[0] : "Éditeur inconnu",
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        pages: doc.number_of_pages_median || 0,
        description: doc.first_sentence ? doc.first_sentence[0] : "Résumé non disponible via Open Library.",
        publicationDate: doc.first_publish_year ? doc.first_publish_year.toString() : "Date inconnue",
        genres: doc.subject ? doc.subject.slice(0, 5) : [],
        isbn: doc.isbn ? doc.isbn[0] : "N/A",
        language: doc.language ? doc.language[0] : "FR",
      })) || [];

      return formattedResults;
    } catch (error: any) {
      console.error(`[PLUME] Erreur Open Library:`, error);
      return [];
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return;

    // 1. Anti-spam / Throttling (attendre 1s entre les requêtes)
    const now = Date.now();
    if (now - lastSearchTime.current < 1000) {
      toast({ 
        title: "Doucement !", 
        description: "Veuillez patienter un instant avant la prochaine recherche.",
        variant: "default"
      });
      return;
    }
    lastSearchTime.current = now;

    // 2. Cache check
    if (searchCache[cleanQuery]) {
      console.log(`[PLUME] Utilisation du cache pour: ${cleanQuery}`);
      setResults(searchCache[cleanQuery]);
      setErrorDetails(null);
      return;
    }

    setIsSearching(true);
    setResults([]);
    setErrorDetails(null);
    
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15`;
    console.log(`[PLUME] Recherche Google Books: ${googleUrl}`);

    try {
      const response = await fetch(googleUrl);
      
      // Gestion spécifique du 429 (Too Many Requests)
      if (response.status === 429) {
        console.warn("[PLUME] Limite Google Books atteinte (429). Basculement vers Open Library...");
        const olResults = await searchOpenLibrary(query);
        if (olResults.length > 0) {
          setResults(olResults);
          searchCache[cleanQuery] = olResults;
        } else {
          setErrorDetails("Service Google temporairement indisponible. Veuillez réessayer dans quelques minutes.");
        }
        return;
      }

      if (!response.ok) throw new Error(`Google Books API Error: ${response.status}`);

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const formattedResults = data.items.map((item: any) => {
          const info = item.volumeInfo;
          return {
            id: item.id,
            source: 'google',
            title: info.title || "Titre inconnu",
            author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
            publisher: info.publisher || "Éditeur inconnu",
            cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
            pages: info.pageCount || 0,
            description: info.description || "Aucun résumé disponible.",
            publicationDate: info.publishedDate || "Date inconnue",
            genres: info.categories || [],
            language: info.language?.toUpperCase() || "FR",
            isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                  info.industryIdentifiers?.[0]?.identifier || 
                  "N/A",
          };
        });
        setResults(formattedResults);
        searchCache[cleanQuery] = formattedResults;
      } else {
        console.log(`[PLUME] Aucun résultat Google. Tentative Open Library...`);
        const olResults = await searchOpenLibrary(query);
        setResults(olResults);
        if (olResults.length > 0) searchCache[cleanQuery] = olResults;
        else setErrorDetails("Aucun livre trouvé sur les plateformes littéraires.");
      }
    } catch (error: any) {
      console.error(`[PLUME] Erreur critique recherche:`, error);
      const olResults = await searchOpenLibrary(query);
      setResults(olResults);
      if (olResults.length === 0) {
        setErrorDetails("Services de recherche indisponibles. Vérifiez votre connexion.");
      }
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
      cover: book.cover || "https://picsum.photos/seed/placeholder/200/300",
      description: book.description,
      genres: book.genres,
      pages: book.pages,
      status: "pal",
      favorite: false,
      progress: 0,
      pagesRead: 0,
      createdAt: serverTimestamp(),
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${book.title} est maintenant dans votre bibliothèque.`,
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
    <div className="space-y-10 animate-paper pb-20">
      <header className="text-center space-y-4 pt-4">
        <div className="flex justify-center">
          <Sparkles className="h-10 w-10 text-primary/40 animate-float" />
        </div>
        <h1 className="text-5xl font-headline italic tracking-tight">Nouvelle Pépite</h1>
        <p className="text-primary/60 italic font-medium max-w-md mx-auto">
          Recherchez par titre, auteur ou ISBN pour enrichir votre bibliothèque.
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
        {errorDetails && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline italic">Information</AlertTitle>
            <AlertDescription className="text-xs italic">
              {errorDetails}
            </AlertDescription>
          </Alert>
        )}

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
                  <Badge className="absolute top-2 left-2 bg-black/40 text-[8px] border-none font-bold uppercase backdrop-blur-sm">
                    {book.source}
                  </Badge>
                </div>
                
                <div className="p-6 flex flex-col flex-1 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-headline italic leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                    <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {book.publisher}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {book.publicationDate}</div>
                    <div className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> {book.isbn}</div>
                    <div className="flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> {book.pages} pages</div>
                    <div className="flex items-center gap-1.5"><Languages className="h-3 w-3" /> {book.language}</div>
                  </div>

                  <ScrollArea className="h-20 pr-4 border-l-2 border-primary/5 pl-4 mt-1">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      {book.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </ScrollArea>

                  <div className="flex flex-wrap gap-1.5">
                    {book.genres.slice(0, 3).map((g: string) => (
                      <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-bold uppercase">
                        {g}
                      </Badge>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      onClick={() => addBook(book)} 
                      className="rounded-xl bg-primary hover:bg-primary/90 shadow-md h-12 px-8 font-headline italic text-sm flex gap-2 group-hover:scale-105 transition-transform"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : !isSearching && !errorDetails && (
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
