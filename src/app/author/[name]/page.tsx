
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Sparkles, BookOpen, User as UserIcon, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function AuthorPage() {
  const params = useParams();
  const authorName = decodeURIComponent(params.name as string);
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const libraryQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: currentLibrary = [] } = useCollection(libraryQuery);

  const isAlreadyInLibrary = useCallback((book: any) => {
    return currentLibrary.find(b => 
      (b.isbn && b.isbn === book.isbn) || 
      (b.title.toLowerCase() === book.title.toLowerCase() && b.author.toLowerCase() === book.author.toLowerCase())
    );
  }, [currentLibrary]);

  useEffect(() => {
    const fetchAuthorBooks = async () => {
      setLoading(true);
      try {
        const url = `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(authorName)}&maxResults=20`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        
        if (data.items) {
          const formatted = data.items.map((item: any) => {
            const info = item.volumeInfo;
            return {
              id: item.id,
              title: info.title,
              author: info.authors ? info.authors.join(", ") : authorName,
              publisher: info.publisher,
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              pages: info.pageCount || 0,
              description: info.description || "",
              publicationDate: info.publishedDate,
              genres: info.categories || [],
              isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                    info.industryIdentifiers?.[0]?.identifier || 
                    "N/A",
            };
          });
          setResults(formatted);
        }
      } catch (e) {
        console.error("Author search error:", e);
      } finally {
        setLoading(false);
      }
    };

    if (authorName) fetchAuthorBooks();
  }, [authorName]);

  const addBook = async (book: any) => {
    if (!db || !user) return;
    if (isAlreadyInLibrary(book)) return;

    const bookData = {
      title: book.title,
      author: book.author,
      publisher: book.publisher || "Inconnu",
      isbn: book.isbn,
      publicationDate: book.publicationDate || "Date inconnue",
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
        toast({ title: "Livre ajouté", description: `${book.title} est dans votre collection.` });
      })
      .catch(async () => {
        const err = new FirestorePermissionError({ path: booksRef.path, operation: 'create', requestResourceData: bookData });
        errorEmitter.emit('permission-error', err);
      });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      <header className="space-y-6 pt-4">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary">
          <Link href="/library"><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Link>
        </Button>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <UserIcon className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-headline italic tracking-tight">{authorName}</h1>
          <p className="text-muted-foreground italic font-medium">Découvrez les pépites de cet auteur.</p>
        </div>
      </header>

      {loading ? (
        <div className="py-24 text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/20" />
          <p className="italic text-muted-foreground">Exploration de la bibliographie...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-6">
          {results.map((book) => {
            const existingBook = isAlreadyInLibrary(book);
            return (
              <Card key={book.id} className="glass-card overflow-hidden border-none group">
                <CardContent className="p-0 flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-40 aspect-[2/3] shrink-0 overflow-hidden bg-secondary/5 flex items-center justify-center p-3">
                    <div className="relative w-full h-full">
                      <Image src={book.cover || "https://picsum.photos/seed/p/200/300"} alt={book.title} fill className="object-contain" sizes="200px" />
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1 justify-between">
                    <div className="space-y-2">
                      <h3 className="text-xl font-headline italic leading-tight">{book.title}</h3>
                      <div className="flex gap-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {book.pages} pages</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {book.publicationDate}</span>
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      {existingBook ? (
                        <Badge variant="secondary" className="h-10 px-6 rounded-xl bg-emerald-50 text-emerald-600 border-none italic">
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Déjà en bibliothèque
                        </Badge>
                      ) : (
                        <Button onClick={() => addBook(book)} className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90">
                          <Plus className="h-4 w-4 mr-2" /> Ajouter
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="italic text-muted-foreground">Aucun autre livre trouvé pour cet auteur.</p>
        </div>
      )}
    </div>
  );
}
