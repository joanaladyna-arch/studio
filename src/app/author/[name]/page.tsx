
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  User as UserIcon, 
  CheckCircle2, 
  Plus, 
  Globe,
  Heart
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, fetchWithTimeout } from "@/lib/utils";

export default function AuthorPage() {
  const params = useParams();
  const authorName = decodeURIComponent(params.name as string);
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorBio, setAuthorBio] = useState("");
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);
  const [authorPhotoFailed, setAuthorPhotoFailed] = useState(false);

  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [isAdding, setIsAdding] = useState(false);
  const [isDePlume, setIsDePlume] = useState(false);

  const libraryQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: currentLibrary = [] } = useCollection(libraryQuery);

  const isAlreadyInLibrary = useCallback((book: any) => {
    return currentLibrary.find(b => 
      (b.isbn && b.isbn === book.isbn) || 
      ((b.title || "").toLowerCase() === (book.title || "").toLowerCase() && (b.author || "").toLowerCase() === (book.author || "").toLowerCase())
    );
  }, [currentLibrary]);

  useEffect(() => {
    const fetchAuthorUniverse = async () => {
      setLoading(true);
      setAuthorPhotoFailed(false);
      try {
        const olRes = await fetchWithTimeout(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}`, {}, 8000);
        const olData = await olRes.json();
        if (olData.docs?.[0]?.key) {
           try {
             const bioRes = await fetchWithTimeout(`https://openlibrary.org/authors/${olData.docs[0].key}.json`, {}, 8000);
             const bioData = await bioRes.json();
             setAuthorBio(typeof bioData.bio === 'string' ? bioData.bio : bioData.bio?.value || "Biographie en cours d'écriture...");
             // Format correct selon la Covers API d'Open Library : /a/olid/{OLID}-L.jpg
             // (le champ utilisé précédemment, .id, n'existe pas dans cette réponse).
             setAuthorPhoto(`https://covers.openlibrary.org/a/olid/${olData.docs[0].key}-L.jpg`);
           } catch (bioErr) {
             console.error("Author Bio Error:", bioErr);
             // On continue sans biographie plutôt que de bloquer toute la page
           }
        }

        const url = `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(authorName)}&maxResults=40&orderBy=newest`;
        const response = await fetchWithTimeout(url, {}, 8000);
        const data = await response.json();
        
        if (data.items) {
          const formatted = data.items.map((item: any) => {
            const info = item.volumeInfo;
            return {
              id: item.id,
              title: info.title,
              subtitle: info.subtitle,
              author: info.authors ? info.authors.join(", ") : authorName,
              publisher: info.publisher,
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              pages: info.pageCount || 0,
              description: info.description || "",
              publicationDate: info.publishedDate,
              genres: info.categories || [],
              language: "Français",
              isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                    info.industryIdentifiers?.[0]?.identifier || 
                    "N/A",
            };
          });
          setResults(formatted);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (authorName) fetchAuthorUniverse();
  }, [authorName]);

  const handleOpenAddDialog = (book: any) => {
    setPendingBook(book);
    setSelectedStatus("pal");
    setSelectedFormat("papier");
    setIsDePlume(false);
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;

    setIsAdding(true);
    try {
      // On crée d'abord la fiche bibliographique complète (livre, auteur,
      // édition) dans masterBooks, comme pour l'ajout depuis la recherche —
      // sans ça, la fiche détail du livre n'affiche pas l'éditeur, l'ISBN
      // ou le résumé pour les livres ajoutés depuis la page auteur.
      const masterRef = doc(collection(db, "masterBooks"));
      await setDoc(masterRef, {
        title: pendingBook.title,
        subtitle: pendingBook.subtitle || "",
        author: pendingBook.author,
        cover: pendingBook.cover || "",
        isbn13: pendingBook.isbn || "",
        description: pendingBook.description || "",
        publisher: pendingBook.publisher || "",
        pageCount: pendingBook.pages || 0,
        publishedDate: pendingBook.publicationDate || "",
        genres: pendingBook.genres || [],
        updatedAt: serverTimestamp(),
        source: "discovered"
      });

      const booksRef = collection(db, "users", user.uid, "books");
      const bookData = {
        masterBookId: masterRef.id,
        title: pendingBook.title,
        author: pendingBook.author,
        cover: pendingBook.cover || "",
        genres: pendingBook.genres || [],
        status: selectedStatus,
        format: selectedFormat,
        dePlume: isDePlume,
        dateAdded: serverTimestamp(),
        progress: selectedStatus === 'read' ? 100 : 0,
        pagesRead: 0,
      };

      await addDoc(booksRef, bookData)
        .then(() => {
          toast({ title: "Pépite ajoutée", description: `${pendingBook.title} a rejoint votre écrin.` });
          setPendingBook(null);
        })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: booksRef.path, operation: 'create', requestResourceData: bookData }));
        });
    } catch (err) {
      console.error("Add Book From Author Error:", err);
      toast({ variant: "destructive", title: "Impossible d'ajouter le livre" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-6xl mx-auto px-4">
      <header className="space-y-10 pt-8">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary text-lg font-headline italic">
          <Link href="/library"><ArrowLeft className="h-5 w-5 mr-3" /> Ma Bibliothèque</Link>
        </Button>
        
        <div className="flex flex-col md:flex-row gap-12 items-center md:items-start text-center md:text-left">
          <div className="relative h-48 w-48 shrink-0 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-primary/5 flex items-center justify-center">
            {authorPhoto && !authorPhotoFailed ? (
               <Image src={authorPhoto} alt={authorName} fill className="object-cover" onError={() => setAuthorPhotoFailed(true)} />
            ) : (
               <UserIcon className="h-20 w-20 text-primary/20" />
            )}
          </div>
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <h1 className="text-6xl font-headline italic tracking-tight">{authorName}</h1>
              <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-primary/40">Portrait d'auteur</p>
            </div>
            <p className="text-muted-foreground italic text-lg leading-relaxed line-clamp-4">
               {authorBio || "Exploration de la bibliographie complète en cours..."}
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-40 text-center space-y-8 flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
          <p className="italic text-primary/40 font-headline text-3xl">Exploration de l'univers de {authorName}...</p>
        </div>
      ) : (
        <div className="space-y-12">
          <h2 className="text-4xl font-headline italic flex items-center gap-4">
            <Sparkles className="h-8 w-8 text-primary/40" /> Bibliographie Complète
          </h2>
          
          <div className="grid gap-10">
            {results.map((book) => {
              const existingBook = isAlreadyInLibrary(book);
              return (
                <Card key={book.id} className="glass-card overflow-hidden border-none group shadow-sm hover:shadow-2xl transition-all duration-700">
                  <CardContent className="p-0 flex flex-col sm:flex-row">
                    <div className="relative w-full sm:w-44 aspect-[2/3] shrink-0 overflow-hidden bg-secondary/5 flex items-center justify-center p-4">
                      <div className="relative w-full h-full">
                        <Image src={book.cover || "https://picsum.photos/seed/p/200/300"} alt={book.title} fill className="object-contain transition-transform duration-700 group-hover:scale-110" sizes="200px" />
                      </div>
                    </div>
                    <div className="p-8 flex flex-col flex-1 justify-between gap-6">
                      <div className="space-y-3">
                        <h3 className="text-2xl font-headline italic leading-tight group-hover:text-primary transition-colors">{book.title}</h3>
                        {book.subtitle && <p className="text-sm text-muted-foreground italic opacity-60">{book.subtitle}</p>}
                        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-40 pt-2">
                          <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {book.pages} pages</span>
                          <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> {book.publisher || "Éditeur inconnu"}</span>
                        </div>
                      </div>
                      <div className="flex justify-end items-center gap-4">
                        {existingBook ? (
                          <div className="h-14 px-8 rounded-[1.5rem] bg-emerald-50 text-emerald-600 border border-emerald-100 italic font-headline text-lg flex items-center gap-3 shadow-sm">
                            <CheckCircle2 className="h-6 w-6" /> Déjà en bibliothèque
                          </div>
                        ) : (
                          <Button onClick={() => handleOpenAddDialog(book)} className="h-14 px-10 rounded-[1.5rem] bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 font-headline italic text-xl transition-all hover:scale-105">
                            <Plus className="h-6 w-6 mr-3" /> Ajouter
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* FIXED AND SCROLLABLE MODAL FOR ADDING BOOKS */}
      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card border-none max-w-xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-10 border-b border-primary/5 bg-white/40 shrink-0">
            <DialogTitle className="font-headline text-4xl italic">Ajouter la pépite</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto min-h-0">
            <div className="p-10 space-y-10">
              <div className="flex gap-8 items-start">
                 <div className="relative h-44 w-32 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/60">
                    <Image src={pendingBook?.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={pendingBook?.title || ""} fill className="object-cover" />
                 </div>
                 <div className="space-y-3 flex-1">
                   <h3 className="font-headline italic text-3xl leading-tight">{pendingBook?.title}</h3>
                   <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{pendingBook?.author}</p>
                   <div className="pt-2 flex flex-wrap gap-2">
                     <Badge className="bg-primary/5 text-primary border-none text-[10px] uppercase font-bold tracking-widest">{pendingBook?.publisher}</Badge>
                     <Badge variant="outline" className="border-primary/20 text-primary/60 italic text-[10px]">{pendingBook?.language || "Français"}</Badge>
                   </div>
                 </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Quelle est votre intention ?</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUSES).map(([key, val]) => (
                      <Button 
                        key={key} 
                        variant="outline" 
                        onClick={() => setSelectedStatus(key as BookStatus)}
                        className={cn(
                          "rounded-full border-primary/10 text-[10px] h-11 px-5 uppercase font-bold tracking-widest transition-all", 
                          selectedStatus === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/60 hover:bg-white"
                        )}
                      >
                        {val.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Format de la pépite</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(FORMATS).map(([key, val]) => {
                      const Icon = val.icon;
                      return (
                        <Button 
                          key={key} 
                          variant="outline" 
                          onClick={() => setSelectedFormat(key as BookFormat)}
                          className={cn(
                            "rounded-2xl border-primary/10 h-14 flex items-center gap-3 transition-all", 
                            selectedFormat === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/60 hover:bg-white"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-headline italic text-lg">{val.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-primary/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-headline italic text-xl">Ajouter à De Plume</p>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">L'écrin de vos favoris absolus</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsDePlume(!isDePlume)}
                    className={cn("rounded-full h-14 w-14 transition-all", isDePlume ? "text-primary bg-primary/10 shadow-inner" : "text-muted-foreground/20")}
                  >
                    <Heart className={cn("h-8 w-8", isDePlume && "fill-primary")} />
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-10 border-t border-primary/5 bg-white/60 shrink-0">
            <div className="flex w-full justify-end gap-4 sm:gap-6">
              <Button variant="ghost" onClick={() => setPendingBook(null)} className="rounded-2xl h-14 px-6 sm:px-8 italic font-headline text-xl">Annuler</Button>
              <Button 
                onClick={confirmAdd} 
                disabled={isAdding}
                className="rounded-[2rem] bg-primary hover:bg-primary/90 font-headline italic text-xl sm:text-2xl px-10 sm:px-14 h-16 shadow-2xl shadow-primary/20 transition-transform active:scale-95 flex-1 sm:flex-none"
              >
                {isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : "Enregistrer ce livre"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
