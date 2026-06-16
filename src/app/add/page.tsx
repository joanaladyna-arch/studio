
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
  Scan,
  Camera,
  Barcode,
  X,
  RefreshCw
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
import { Html5Qrcode } from "html5-qrcode";
import { aiCoverScanner } from "@/ai/flows/ai-cover-scanner-flow";

const searchCache: Record<string, any[]> = {};

const validatePages = (p: any): number => {
  const val = Number(p);
  if (isNaN(val) || val < 0) return 0;
  if (val > 3000) return 3000;
  return val;
};

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [queryStr, setQueryStr] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const lastSearchTime = useRef<number>(0);

  // States for Scanning
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"barcode" | "cover">("barcode");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const fetchBookDetails = async (query: string, type: "isbn" | "text" = "text") => {
    const q = type === "isbn" ? `isbn:${query}` : query;
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`;
    
    try {
      const response = await fetch(googleUrl);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        return data.items.map((item: any) => {
          const info = item.volumeInfo;
          return {
            id: item.id,
            title: info.title || "Titre inconnu",
            author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
            publisher: info.publisher || "Éditeur inconnu",
            cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
            pages: validatePages(info.pageCount),
            description: info.description || "Aucun résumé disponible.",
            publicationDate: info.publishedDate || "Date inconnue",
            genres: info.categories || [],
            language: info.language?.toUpperCase() || "FR",
            isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                  info.industryIdentifiers?.[0]?.identifier || 
                  "N/A",
          };
        });
      }
      return [];
    } catch (e) {
      console.error("Fetch error", e);
      return [];
    }
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const cleanQuery = (customQuery || queryStr).trim();
    if (!cleanQuery) return;

    setIsSearching(true);
    setResults([]);
    setErrorDetails(null);

    const finalResults = await fetchBookDetails(cleanQuery);

    if (finalResults.length === 0) {
      setErrorDetails("Aucun livre trouvé pour cette recherche.");
    } else {
      setResults(finalResults);
    }
    setIsSearching(false);
  };

  // --- Scanning Logic ---

  useEffect(() => {
    if (isScannerOpen && scanMode === "barcode") {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      
      const config = { fps: 10, qrbox: { width: 250, height: 150 } };
      
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleBarcodeScanned(decodedText);
        },
        () => {}
      ).catch(err => {
        console.error("Scanner start error", err);
        toast({ variant: "destructive", title: "Erreur Caméra", description: "Impossible d'accéder à la caméra." });
      });
    }

    if (isScannerOpen && scanMode === "cover") {
      startCamera();
    }

    return () => {
      stopScanner();
    };
  }, [isScannerOpen, scanMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error", err);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(e => console.error(e));
      scannerRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleBarcodeScanned = async (isbn: string) => {
    stopScanner();
    setIsScannerOpen(false);
    setIsProcessingScan(true);
    
    toast({ title: "ISBN Detecté", description: `Recherche de l'ISBN : ${isbn}` });
    
    const results = await fetchBookDetails(isbn, "isbn");
    if (results.length > 0) {
      handleOpenAddDialog(results[0]);
    } else {
      toast({ variant: "destructive", title: "Introuvable", description: "Ce code-barres n'a pas pu être identifié." });
    }
    setIsProcessingScan(false);
  };

  const captureCover = async () => {
    if (!videoRef.current) return;
    
    setIsProcessingScan(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);
    
    const dataUri = canvas.toDataURL("image/jpeg");
    
    try {
      const analysis = await aiCoverScanner({ photoDataUri: dataUri });
      toast({ title: "Couverture Identifiée", description: `${analysis.title} par ${analysis.author}` });
      
      const searchResults = await fetchBookDetails(`${analysis.title} ${analysis.author}`);
      if (searchResults.length > 0) {
        setIsScannerOpen(false);
        stopScanner();
        handleOpenAddDialog(searchResults[0]);
      } else {
        toast({ variant: "destructive", title: "Recherche infructueuse", description: "L'IA a identifié le titre mais aucune fiche n'a été trouvée." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur Scan", description: "L'IA n'a pas pu lire la couverture." });
    } finally {
      setIsProcessingScan(false);
    }
  };

  // --- Add Logic ---

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
      pages: validatePages(pendingBook.pages),
      status: selectedStatus,
      format: selectedFormat,
      favorite: false,
      progress: selectedStatus === 'read' ? 100 : 0,
      pagesRead: 0,
      duration: 0,
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
          Recherchez ou scannez votre prochaine lecture.
        </p>
      </header>

      <div className="max-w-2xl mx-auto space-y-4 px-4">
        <form onSubmit={(e) => handleSearch(e)} className="flex gap-3">
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
        
        <div className="flex justify-center">
          <Button 
            variant="outline"
            onClick={() => setIsScannerOpen(true)}
            className="h-14 w-full rounded-2xl border-primary/20 bg-white/40 font-headline italic text-lg gap-3 hover:bg-primary/5 transition-colors"
          >
            <Scan className="h-5 w-5 text-primary" />
            Scanner un livre
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 px-4">
        {errorDetails && (
          <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline italic">Information</AlertTitle>
            <AlertDescription className="text-xs italic">{errorDetails}</AlertDescription>
          </Alert>
        )}

        {isProcessingScan && (
          <div className="py-12 text-center space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto text-primary animate-spin" />
            <p className="font-headline italic text-primary/60">Analyse en cours par Plume...</p>
          </div>
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
        ) : !isSearching && !errorDetails && !isProcessingScan && (
          <div className="py-24 text-center space-y-6">
            <BookPlus className="h-20 w-20 mx-auto text-primary/10 animate-pulse" />
            <div className="space-y-2">
              <p className="italic font-headline text-2xl text-primary/40">Le monde entier dans votre carnet.</p>
              <p className="text-sm text-muted-foreground italic">Capturez vos futures lectures avec précision.</p>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={(o) => { if (!o) stopScanner(); setIsScannerOpen(o); }}>
        <DialogContent className="glass-card border-none max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-8 border-b border-primary/5 bg-white/40 flex flex-row items-center justify-between">
            <DialogTitle className="font-headline text-3xl italic">Scanner une pépite</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(false)}><X className="h-6 w-6" /></Button>
          </DialogHeader>

          <div className="p-0">
            <div className="bg-slate-900 aspect-video relative flex items-center justify-center overflow-hidden">
               {scanMode === "barcode" ? (
                 <div id="reader" className="w-full h-full"></div>
               ) : (
                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
               )}
               
               <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                  <div className="w-full h-full border-2 border-white/60 border-dashed rounded-xl" />
               </div>

               {isProcessingScan && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 text-white p-8 text-center">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="font-headline italic">Plume analyse la couverture...</p>
                  </div>
               )}
            </div>

            <div className="p-8 space-y-6">
               <div className="flex p-1 bg-primary/5 rounded-2xl gap-2">
                  <Button 
                    variant={scanMode === 'barcode' ? 'default' : 'ghost'} 
                    onClick={() => setScanMode('barcode')}
                    className="flex-1 rounded-xl h-12 italic font-headline gap-2"
                  >
                    <Barcode className="h-4 w-4" /> Code-Barres
                  </Button>
                  <Button 
                    variant={scanMode === 'cover' ? 'default' : 'ghost'} 
                    onClick={() => setScanMode('cover')}
                    className="flex-1 rounded-xl h-12 italic font-headline gap-2"
                  >
                    <Camera className="h-4 w-4" /> Couverture
                  </Button>
               </div>

               {scanMode === "cover" && (
                 <Button 
                   onClick={captureCover} 
                   disabled={isProcessingScan}
                   className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 font-headline italic text-xl"
                 >
                   Identifier la couverture
                 </Button>
               )}
               
               <p className="text-center text-[10px] uppercase font-bold tracking-widest opacity-40 italic">
                 {scanMode === 'barcode' ? "Placez le code-barres ISBN dans le cadre." : "Prenez une photo nette de la couverture."}
               </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

