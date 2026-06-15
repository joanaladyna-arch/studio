
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, BookPlus, Loader2, Sparkles, Calendar, Tag } from "lucide-react";
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
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`);
      const data = await response.json();
      
      const formattedResults = data.items?.map((item: any) => {
        const info = item.volumeInfo;
        return {
          id: item.id,
          title: info.title,
          author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
          totalPages: info.pageCount || 0,
          description: info.description || "Aucun résumé disponible.",
          publishedDate: info.publishedDate || "N/A",
          genres: info.categories || [],
          isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || info.industryIdentifiers?.[0]?.identifier || "N/A"
        };
      }) || [];

      setResults(formattedResults);
      if (formattedResults.length === 0) {
        toast({ title: "Aucun résultat", description: "Désolé, nous n'avons trouvé aucun livre correspondant." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de contacter Google Books." });
    } finally {
      setIsSearching(false);
    }
  };

  const addBook = async (book: any) => {
    if (!db || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez être connecté pour ajouter un livre." });
      return;
    }

    const bookData = {
      title: book.title,
      author: book.author,
      cover: book.cover || "https://picsum.photos/seed/placeholder/200/300",
      status: "pal",
      favorite: false,
      totalPages: book.totalPages,
      pagesRead: 0,
      progress: 0,
      description: book.description,
      publishedDate: book.publishedDate,
      genres: book.genres,
      createdAt: serverTimestamp()
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${book.title} a été ajouté à votre bibliothèque.`,
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
    <div className="space-y-8 animate-paper pb-12">
      <header className="text-center space-y-4 pt-4">
        <Sparkles className="h-10 w-10 text-primary/40 mx-auto animate-float" />
        <h1 className="text-5xl font-headline italic tracking-tight">Ajouter une pépite</h1>
        <p className="text-primary/60 italic font-medium">Recherchez par titre, auteur ou ISBN dans le catalogue mondial.</p>
      </header>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Ex: L'élégance du hérisson, 978..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-14 bg-white/40 border-white/60 focus-visible:ring-primary/30 rounded-2xl shadow-sm text-lg italic"
          />
        </div>
        <Button type="submit" className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10 font-headline italic text-lg" disabled={isSearching}>
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Trouver"}
        </Button>
      </form>

      <div className="grid gap-6">
        {results.length > 0 ? (
          results.map((book) => (
            <Card key={book.id} className="glass-card overflow-hidden hover:bg-white/80 transition-all duration-500 group">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-48 aspect-[2/3] shrink-0 overflow-hidden">
                  <Image 
                    src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
                    alt={book.title} 
                    fill 
                    className="object-cover transition-transform duration-1000 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />
                </div>
                
                <div className="p-8 flex flex-col flex-1 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-headline italic leading-tight group-hover:text-primary transition-colors">{book.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest opacity-60">
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {book.publishedDate.split('-')[0]}</div>
                    <div className="flex items-center gap-1.5"><Tag className="h-3 w-3" /> {book.totalPages} pages</div>
                  </div>

                  <ScrollArea className="h-20">
                    <p className="text-sm text-muted-foreground italic leading-relaxed line-clamp-3">
                      {book.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </ScrollArea>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {book.genres.slice(0, 3).map((g: string) => (
                      <Badge key={g} variant="secondary" className="bg-primary/5 text-primary border-none text-[9px] font-bold">
                        {g}
                      </Badge>
                    ))}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button 
                      onClick={() => addBook(book)} 
                      className="rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10 h-11 px-6 font-headline italic text-md flex gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter à ma PAL
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
              <p className="italic font-headline text-2xl text-primary/40">Le catalogue mondial à votre portée.</p>
              <p className="text-sm text-muted-foreground italic">Recherchez votre prochaine lecture coup de cœur.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
