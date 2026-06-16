"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Loader2, 
  Sparkles, 
  Calendar, 
  AlertCircle,
  Hash,
  BookOpen,
  CheckCircle2,
  Scan,
  Camera,
  Barcode,
  X,
  RefreshCw,
  Globe,
  Heart
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn } from "@/lib/utils";
import { Html5Qrcode } from "html5-qrcode";
import { aiCoverScanner } from "@/ai/flows/ai-cover-scanner-flow";

const LANGUAGE_MAP: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  ja: "Japonais",
  ko: "Coréen",
  zh: "Chinois",
};

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [queryStr, setQueryStr] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

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
  const [isDePlume, setIsDePlume] = useState(false);

  const libraryQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: currentLibrary = [] } = useCollection(libraryQuery);

  const findExistingBook = useCallback((book: any) => {
    return currentLibrary.find(b => {
      const sameIsbn = book.isbn && book.isbn !== "N/A" && b.isbn === book.isbn;
      const sameTitleAuthor = b.title?.toLowerCase() === book.title?.toLowerCase() && 
                              b.author?.toLowerCase() === book.author?.toLowerCase();
      return sameIsbn || sameTitleAuthor;
    });
  }, [currentLibrary]);

  const fetchUniversalMetadata = async (search: string) => {
    setIsSearching(true);
    setErrorDetails(null);
    setResults([]);

    console.log(`[PLUME] Début de recherche pour : "${search}"`);

    let finalResults: any[] = [];

    // 1. Essai Google Books
    try {
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(search)}&maxResults=20`;
      console.log(`[PLUME] Appel Google Books: ${gUrl}`);
      
      const gRes = await fetch(gUrl);
      console.log(`[PLUME] Google Books Status: ${gRes.status}`);

      if (gRes.ok) {
        const gData = await gRes.json();
        const items = gData.items || [];
        console.log(`[PLUME] Google Books: ${items.length} résultats trouvés`);
        
        if (items.length > 0) {
          finalResults = items.map((item: any) => {
            const info = item.volumeInfo;
            const isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.[0]?.identifier || "N/A";
            return {
              id: item.id,
              title: info.title || "Titre inconnu",
              subtitle: info.subtitle,
              author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
              publisher: info.publisher,
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
              pages: info.pageCount || 0,
              description: info.description || "",
              publicationDate: info.publishedDate,
              genres: info.categories || [],
              language: LANGUAGE_MAP[info.language?.toLowerCase()] || info.language?.toUpperCase() || "Français",
              isbn: isbn
            };
          });
        }
      }
    } catch (e) {
      console.error("[PLUME] Erreur lors de l'appel Google Books:", e);
    }

    // 2. Si aucun résultat Google Books ou erreur, essai Open Library
    if (finalResults.length === 0) {
      try {
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(search)}&limit=20`;
        console.log(`[PLUME] Fallback Open Library: ${olUrl}`);
        
        const olRes = await fetch(olUrl);
        console.log(`[PLUME] Open Library Status: ${olRes.status}`);

        if (olRes.ok) {
          const olData = await olRes.json();
          const docs = olData.docs || [];
          console.log(`[PLUME] Open Library: ${docs.length} résultats trouvés`);
          
          if (docs.length > 0) {
            finalResults = docs.map((doc: any) => ({
              id: doc.key,
              title: doc.title || "Titre inconnu",
              author: doc.author_name ? doc.author_name.join(", ") : "Auteur inconnu",
              publisher: doc.publisher?.[0],
              cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
              pages: doc.number_of_pages_median || 0,
              publicationDate: doc.first_publish_year?.toString(),
              genres: doc.subject?.slice(0, 5) || [],
              language: "Français",
              isbn: doc.isbn?.[0] || "N/A"
            }));
          }
        }
      } catch (e) {
        console.error("[PLUME] Erreur lors de l'appel Open Library:", e);
      }
    }

    if (finalResults.length === 0) {
      setErrorDetails("Aucun livre trouvé. Essayez avec l'ISBN ou un titre plus précis.");
    } else {
      setResults(finalResults);
    }
    setIsSearching(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryStr.trim()) return;
    fetchUniversalMetadata(queryStr);
  };

  // --- Scanning Logic ---

  useEffect(() => {
    if (isScannerOpen && scanMode === "barcode") {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      
      const config = { fps: 15, qrbox: { width: 300, height: 180 } };
      
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleBarcodeScanned(decodedText);
        },
        () => {}
      ).catch(err => {
        toast({ variant: "destructive", title: "Erreur Caméra", description: "Vérifiez vos permissions média." });
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
      toast({ variant: "destructive", title: "Accès refusé", description: "Impossible d'accéder à la caméra." });
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
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
    toast({ title: "ISBN Identifié", description: `Recherche de ${isbn}...` });
    await fetchUniversalMetadata(isbn);
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
      toast({ title: "Couverture lue", description: `${analysis.title} par ${analysis.author}` });
      setIsScannerOpen(false);
      stopScanner();
      await fetchUniversalMetadata(`${analysis.title} ${analysis.author}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Scan Échoué", description: "L'IA n'a pas pu identifier le titre." });
    } finally {
      setIsProcessingScan(false);
    }
  };

  // --- Add Logic ---

  const handleOpenAddDialog = (book: any) => {
    setPendingBook(book);
    setSelectedStatus("pal");
    setSelectedFormat("papier");
    setIsDePlume(false);
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;

    setIsAdding(true);
    const bookData = {
      ...pendingBook,
      status: selectedStatus,
      format: selectedFormat,
      dePlume: isDePlume,
      dateAdded: serverTimestamp(),
      progress: selectedStatus === 'read' ? 100 : 0,
      pagesRead: 0,
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({ title: "Livre ajouté", description: `${pendingBook.title} est dans votre écrin.` });
        setPendingBook(null);
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: booksRef.path, operation: 'create', requestResourceData: bookData }));
      })
      .finally(() => setIsAdding(false));
  };

  return (
    <div className="space-y-12 animate-paper pb-32">
      <header className="text-center space-y-4 pt-8">
        <div className="flex justify-center">
          <Sparkles className="h-12 w-12 text-primary/40 animate-float" />
        </div>
        <h1 className="text-6xl font-headline italic tracking-tight">Nouvelles Pépites</h1>
        <p className="text-primary/60 italic font-medium max-w-lg mx-auto text-lg">
          Recherchez ou scannez pour enrichir votre univers.
        </p>
      </header>

      <div className="max-w-3xl mx-auto space-y-6 px-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Titre, auteur, série ou ISBN..." 
              value={queryStr}
              onChange={(e) => setQueryStr(e.target.value)}
              className="pl-14 h-16 bg-white/60 border-white shadow-sm rounded-2xl text-xl italic focus-visible:ring-primary/20"
            />
          </div>
          <Button 
            type="submit" 
            className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 font-headline italic text-xl min-w-[160px]" 
            disabled={isSearching}
          >
            {isSearching ? <Loader2 className="h-6 w-6 animate-spin" /> : "Chercher"}
          </Button>
        </form>
        
        <Button 
          variant="outline"
          onClick={() => setIsScannerOpen(true)}
          className="h-16 w-full rounded-2xl border-primary/20 bg-white/40 font-headline italic text-xl gap-4 hover:bg-white transition-all shadow-sm"
        >
          <Scan className="h-6 w-6 text-primary" />
          Scanner un livre (ISBN ou Couverture)
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-8 px-4">
        {errorDetails && (
          <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-[2rem] p-8 animate-in zoom-in duration-300">
            <AlertCircle className="h-6 w-6" />
            <AlertTitle className="font-headline italic text-2xl mb-2">Information</AlertTitle>
            <AlertDescription className="text-lg italic">{errorDetails}</AlertDescription>
          </Alert>
        )}

        {isProcessingScan && (
          <div className="py-24 text-center space-y-6">
            <RefreshCw className="h-16 w-16 mx-auto text-primary animate-spin" />
            <p className="font-headline italic text-2xl text-primary/60">Plume analyse la pépite...</p>
          </div>
        )}

        <div className="grid gap-8">
          {results.map((book) => {
            const existingBook = findExistingBook(book);
            return (
              <Card key={book.id} className="glass-card overflow-hidden hover:bg-white/80 transition-all duration-700 group border-none shadow-sm hover:shadow-2xl">
                <CardContent className="p-0 flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-48 aspect-[2/3] shrink-0 overflow-hidden bg-secondary/5 flex items-center justify-center p-4">
                    <div className="relative w-full h-full">
                      <Image 
                        src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} 
                        alt={book.title} 
                        fill 
                        className="object-contain transition-transform duration-1000 group-hover:scale-105" 
                        sizes="200px"
                      />
                    </div>
                  </div>
                  
                  <div className="p-8 flex flex-col flex-1 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-3xl font-headline italic leading-tight group-hover:text-primary transition-colors">{book.title}</h3>
                        <Badge variant="outline" className="rounded-full border-primary/20 text-primary italic shrink-0">{book.language}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">{book.author}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest opacity-60">
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {book.publicationDate || "Date inconnue"}</div>
                      <div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {book.pages} pages</div>
                      <div className="flex items-center gap-2 col-span-2"><Hash className="h-4 w-4" /> ISBN: {book.isbn}</div>
                    </div>

                    <p className="text-sm text-muted-foreground italic line-clamp-2 opacity-80">{book.description?.replace(/<[^>]*>?/gm, '')}</p>

                    <div className="pt-2 flex justify-end">
                      {existingBook ? (
                        <div className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 italic font-medium text-lg shadow-sm">
                          <CheckCircle2 className="h-6 w-6" />
                          Déjà en bibliothèque ({STATUSES[existingBook.status]?.label})
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleOpenAddDialog(book)} 
                          className="rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 h-16 px-10 font-headline italic text-xl flex gap-3 group-hover:scale-105 transition-transform"
                        >
                          <Plus className="h-6 w-6" />
                          Ajouter
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

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={(o) => { if (!o) stopScanner(); setIsScannerOpen(o); }}>
        <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl">
          <DialogHeader className="p-10 border-b border-primary/5 bg-white/40 flex flex-row items-center justify-between">
            <DialogTitle className="font-headline text-4xl italic">Scanner une pépite</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(false)} className="rounded-full"><X className="h-8 w-8" /></Button>
          </DialogHeader>

          <div className="p-0">
            <div className="bg-slate-900 aspect-video relative flex items-center justify-center overflow-hidden">
               {scanMode === "barcode" ? (
                 <div id="reader" className="w-full h-full"></div>
               ) : (
                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
               )}
               
               <div className="absolute inset-0 pointer-events-none border-[60px] border-black/50">
                  <div className="w-full h-full border-2 border-white/80 border-dashed rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]" />
               </div>

               {isProcessingScan && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 text-white p-12 text-center animate-in fade-in">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    <p className="font-headline italic text-3xl">Plume analyse le livre...</p>
                  </div>
               )}
            </div>

            <div className="p-10 space-y-8">
               <div className="flex p-2 bg-primary/5 rounded-[2rem] gap-2">
                  <Button 
                    variant={scanMode === 'barcode' ? 'default' : 'ghost'} 
                    onClick={() => setScanMode('barcode')}
                    className="flex-1 rounded-[1.5rem] h-16 italic font-headline text-xl gap-3 transition-all"
                  >
                    <Barcode className="h-6 w-6" /> Code-Barres
                  </Button>
                  <Button 
                    variant={scanMode === 'cover' ? 'default' : 'ghost'} 
                    onClick={() => setScanMode('cover')}
                    className="flex-1 rounded-[1.5rem] h-16 italic font-headline text-xl gap-3 transition-all"
                  >
                    <Camera className="h-6 w-6" /> Couverture
                  </Button>
               </div>

               {scanMode === "cover" && (
                 <Button 
                   onClick={captureCover} 
                   disabled={isProcessingScan}
                   className="w-full h-20 rounded-[2rem] bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 font-headline italic text-2xl transition-transform active:scale-95"
                 >
                   Identifier la couverture
                 </Button>
               )}
               
               <p className="text-center text-xs uppercase font-bold tracking-[0.3em] opacity-40 italic">
                 {scanMode === 'barcode' ? "Cadrez l'ISBN pour une détection instantanée." : "Photo nette pour identification visuelle."}
               </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Confirmation Dialog */}
      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card border-none max-w-xl p-0 overflow-hidden bg-white/95">
          <DialogHeader className="p-10 border-b border-primary/5 bg-white/40">
            <DialogTitle className="font-headline text-4xl italic">Ajouter au sanctuaire</DialogTitle>
          </DialogHeader>
          
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
                   <Badge variant="outline" className="border-primary/20 text-primary/60 italic text-[10px]">{pendingBook?.language}</Badge>
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

          <DialogFooter className="p-10 border-t border-primary/5 bg-white/60">
            <div className="flex w-full justify-end gap-6">
              <Button variant="ghost" onClick={() => setPendingBook(null)} className="rounded-2xl h-14 px-8 italic font-headline text-xl">Annuler</Button>
              <Button 
                onClick={confirmAdd} 
                disabled={isAdding}
                className="rounded-[2rem] bg-primary hover:bg-primary/90 font-headline italic text-2xl px-14 h-16 shadow-2xl shadow-primary/20 transition-transform active:scale-95"
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
