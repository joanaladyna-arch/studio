
"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  BookPlus, 
  Loader2, 
  Sparkles, 
  Calendar, 
  AlertCircle,
  Hash,
  BookOpen,
  CheckCircle2,
  Book as BookIcon,
  ChevronRight,
  Info
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn } from "@/lib/utils";

const searchCache: Record<string, any[]> = {};

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [queryStr, setQueryStr] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const lastSearchTime = useRef<number>(0);

  // States for the Add Confirmation Dialog
  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [isAdding, setIsAdding] = useState(false);

  const libraryQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: currentLibrary = [] } = useCollection(libraryQuery);

  const findExistingBook = useCallback((book: any) => {
    return currentLibrary.find(b => {
      const sameIsbn = book.isbn !== "N/A" && b.isbn === book.isbn;
      const sameTitleAuthor = b.title?.toLowerCase() === book.title?.toLowerCase() && 
                              b.author?.toLowerCase() === book.author?.toLowerCase();
      return sameIsbn || sameTitleAuthor;
    });
  }, [currentLibrary]);

  const searchOpenLibrary = async (q: string) => {
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15`;
    try {
      const response = await fetch(olUrl);
      if (!response.ok) throw new Error(`Erreur Source: ${response.status}`);
      const data = await response.json();
      return data.docs?.map((doc: any) => ({
        id: doc.key,
        title: doc.title || "Titre inconnu",
        author: doc.author_name ? doc.author_name.join(", ") : "Auteur inconnu",
        publisher: doc.publisher ? doc.publisher[0] : "Éditeur inconnu",
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        pages: doc.number_of_pages_median || 0,
        description: doc.first_sentence ? doc.first_sentence[0] : "Résumé non disponible.",
        publicationDate: doc.first_publish_year ? doc.first_publish_year.toString() : "Date inconnue",
        genres: doc.subject ? doc.subject.slice(0, 5) : [],
        isbn: doc.isbn ? doc.isbn[0] : "N/A",
        language: doc.language ? doc.language[0]?.toUpperCase() : "FR",
      })) || [];
    } catch (error) {
      return [];
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = queryStr.trim();
    if (!cleanQuery) return;

    const now = Date.now();
    if (now - lastSearchTime.current < 1000) return;
    lastSearchTime.current = now;

    if (searchCache[cleanQuery.toLowerCase()]) {
      setResults(searchCache[cleanQuery.toLowerCase()]);
      setErrorDetails(null);
      return;
    }

    setIsSearching(true);
    setResults([]);
    setErrorDetails(null);
    
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=15`;

    try {
      const response = await fetch(googleUrl);
      const data = await response.json();

      let finalResults = [];

      if (data.items && data.items.length > 0) {
        finalResults = data.items.map((item: any) => {
          const info = item.volumeInfo;
          return {
            id: item.id,
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
      } else {
        finalResults = await searchOpenLibrary(cleanQuery);
      }

      if (finalResults.length === 0) {
        setErrorDetails("Aucun livre trouvé pour cette recherche.");
      } else {
        setResults(finalResults);
        searchCache[cleanQuery.toLowerCase()] = finalResults;
      }
    } catch (error) {
      const fallbackResults = await searchOpenLibrary(cleanQuery);
      if (fallbackResults.length > 0) {
        setResults(fallbackResults);
      } else {
        setErrorDetails("Services de recherche momentanément indisponibles.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenAddDialog = (book: any) => {
    setPendingBook(book);
    setSelectedStatus("pal");
    setSelectedFormat("papier");
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;

    setIsAdding(true);
    const bookData = {
      title: pendingBook.title,
      author: pendingBook.author,
      publisher: pendingBook.publisher,
      isbn: pendingBook.isbn,
      publicationDate: pendingBook.publicationDate,
      cover: pendingBook.cover || "https://picsum.photos/seed/placeholder/200/300",
      description: pendingBook.description,
      genres: pendingBook.genres,
      pages: pendingBook.pages,
      status: selectedStatus,
      format: selectedFormat,
      favorite: false,
      progress: selectedStatus === 'read' ? 100 : 0,
      pagesRead: 0,
      duration: 0,
      narrator: "",
      createdAt: serverTimestamp(),
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${pendingBook.title} est maintenant dans votre bibliothèque.`,
        });
        setPendingBook(null);
      })
      .catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: booksRef.path,
          operation: 'create',
          requestResourceData: bookData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsAdding(false);
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
          Recherchez votre prochaine lecture par titre, auteur ou ISBN.
        </p>
      </header>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-3 px-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Titre, auteur ou ISBN..." 
            value={queryStr}
            onChange={(e) => setQueryStr(e.target.value)}
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

      <div className="max-w-4xl mx-auto space-y-6 px-4">
        {errorDetails && (
          <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline italic">Information</AlertTitle>
            <AlertDescription className="text-xs italic">{errorDetails}</AlertDescription>
          </Alert>
        )}

        {results.length > 0 ? (
          results.map((book) => {
            const existingBook = findExistingBook(book);
            return (
              <Card key={book.id} className="glass-card overflow-hidden hover:bg-white/80 transition-all duration-500 group border-none">
                <CardContent className="p-0 flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-48 aspect-[2/3] shrink-0 overflow-hidden bg-secondary/5 flex items-center justify-center p-4">
                    <div className="relative w-full h-full">
                      <Image 
                        src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
                        alt={book.title} 
                        fill 
                        className="object-contain transition-transform duration-1000 group-hover:scale-105" 
                        data-ai-hint="book cover"
                        sizes="200px"
                      />
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        {existingBook && (
                          <Badge className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border", FORMATS[existingBook.format || 'papier'].badgeClass)}>
                             {existingBook.format === 'audio' ? <BookIcon className="h-2 w-2 mr-1" /> : <BookIcon className="h-2 w-2 mr-1" />}
                             {FORMATS[existingBook.format || 'papier'].label}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-2xl font-headline italic leading-tight line-clamp-2">{book.title}</h3>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest italic">{book.publisher}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[9px] font-bold uppercase tracking-widest opacity-60 pt-2">
                      <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {book.publicationDate}</div>
                      <div className="flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> {book.pages} pages</div>
                      <div className="flex items-center gap-1.5 col-span-2"><Hash className="h-3 w-3" /> ISBN: {book.isbn}</div>
                    </div>

                    <ScrollArea className="h-20 pr-4 border-l-2 border-primary/5 pl-4 mt-1">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {book.description?.replace(/<[^>]*>?/gm, '')}
                      </p>
                    </ScrollArea>

                    <div className="flex flex-wrap gap-1.5">
                      {book.genres?.slice(0, 3).map((g: string) => (
                        <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-bold uppercase">
                          {g}
                        </Badge>
                      ))}
                    </div>

                    <div className="pt-2 flex justify-end">
                      {existingBook ? (
                        <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 italic font-medium text-sm">
                          <CheckCircle2 className="h-4 w-4" />
                          Déjà en bibliothèque ({STATUSES[existingBook.status]?.label})
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleOpenAddDialog(book)} 
                          className="rounded-xl bg-primary hover:bg-primary/90 shadow-md h-12 px-8 font-headline italic text-sm flex gap-2 group-hover:scale-105 transition-transform"
                        >
                          <Plus className="h-4 w-4" />
                          Ajouter
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
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

      {/* Add Confirmation Dialog */}
      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card border-none max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-8 border-b border-primary/5 bg-white/40">
            <DialogTitle className="font-headline text-3xl italic">Ajouter à ma bibliothèque</DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-8">
            <div className="flex gap-6 items-start">
               <div className="relative h-32 w-24 shrink-0 rounded-xl overflow-hidden shadow-lg">
                  <Image src={pendingBook?.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={pendingBook?.title || ""} fill className="object-cover" sizes="100px" />
               </div>
               <div className="space-y-2">
                 <h3 className="font-headline italic text-xl leading-tight">{pendingBook?.title}</h3>
                 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{pendingBook?.author}</p>
                 <div className="pt-2">
                   <Badge variant="outline" className="border-primary/20 text-primary/60 italic">{pendingBook?.publisher}</Badge>
                 </div>
               </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Statut de lecture</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <Button 
                      key={key} 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedStatus(key as BookStatus)}
                      className={cn(
                        "rounded-full border-primary/10 text-[10px] h-9 px-4", 
                        selectedStatus === key ? "bg-primary text-white border-primary" : "bg-white/60"
                      )}
                    >
                      {val.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Format</label>
                <div className="flex gap-2">
                  {Object.entries(FORMATS).map(([key, val]) => {
                    const Icon = val.icon;
                    return (
                      <Button 
                        key={key} 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedFormat(key as BookFormat)}
                        className={cn(
                          "rounded-xl border-primary/10 h-11 flex-1", 
                          selectedFormat === key ? "bg-primary text-white border-primary" : "bg-white/60"
                        )}
                      >
                        <Icon className="h-4 w-4 mr-2" /> {val.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 border-t border-primary/5 bg-white/60">
            <div className="flex w-full justify-end gap-4">
              <Button variant="ghost" onClick={() => setPendingBook(null)} className="rounded-xl h-12 px-6">Annuler</Button>
              <Button 
                onClick={confirmAdd} 
                disabled={isAdding}
                className="rounded-2xl bg-primary hover:bg-primary/90 font-headline italic text-xl px-12 h-14 shadow-xl shadow-primary/20"
              >
                {isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : "Ajouter à ma bibliothèque"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

