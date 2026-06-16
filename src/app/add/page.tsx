
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
  Heart,
  Edit3
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
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"barcode" | "cover">("barcode");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<BookFormat | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDePlume, setIsDePlume] = useState(false);

  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualBook, setManualBook] = useState({ title: "", author: "" });

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
    if (!search.trim()) return;
    setIsSearching(true);
    setErrorDetails(null);
    setResults([]);

    try {
      // Priorité Google Books
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(search)}&maxResults=20&printType=books`;
      const gRes = await fetch(gUrl);

      if (gRes.ok) {
        const gData = await gRes.json();
        const items = gData.items || [];
        
        if (items.length > 0) {
          const finalResults = items.map((item: any) => {
            const info = item.volumeInfo;
            const isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                         info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || "N/A";
            
            return {
              id: item.id,
              title: info.title || "Titre inconnu",
              subtitle: info.subtitle,
              author: info.authors ? info.authors.join(", ") : "Auteur inconnu",
              publisher: info.publisher,
              cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || info.imageLinks?.smallThumbnail?.replace("http://", "https://"),
              pages: info.pageCount || null,
              description: info.description?.replace(/<[^>]*>?/gm, '') || "",
              publicationDate: info.publishedDate,
              genres: info.categories || [],
              language: LANGUAGE_MAP[info.language?.toLowerCase()] || info.language?.toUpperCase() || "Français",
              isbn: isbn
            };
          });
          setResults(finalResults);
        } else {
          // Fallback OpenLibrary
          const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(search)}&limit=20`;
          const olRes = await fetch(olUrl);
          if (olRes.ok) {
            const olData = await olRes.json();
            const docs = olData.docs || [];
            if (docs.length > 0) {
              const finalResults = docs.map((doc: any) => ({
                id: doc.key,
                title: doc.title || "Titre inconnu",
                author: doc.author_name ? doc.author_name.join(", ") : "Auteur inconnu",
                publisher: doc.publisher?.[0],
                cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
                pages: doc.number_of_pages_median || doc.number_of_pages || null,
                publicationDate: doc.first_publish_year?.toString(),
                genres: doc.subject?.slice(0, 5) || [],
                language: "Français",
                isbn: doc.isbn?.[0] || "N/A"
              }));
              setResults(finalResults);
            } else {
              setErrorDetails("Aucun livre trouvé automatiquement.");
            }
          }
        }
      }
    } catch (e) {
      setErrorDetails("Erreur de connexion aux serveurs littéraires.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUniversalMetadata(queryStr);
  };

  useEffect(() => {
    if (isScannerOpen && scanMode === "barcode") {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: 250 }, (isbn) => {
        handleBarcodeScanned(isbn);
      }, () => {}).catch(() => toast({ variant: "destructive", title: "Erreur Caméra" }));
    }
    if (isScannerOpen && scanMode === "cover") startCamera();
    return () => stopScanner();
  }, [isScannerOpen, scanMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ variant: "destructive", title: "Accès caméra refusé" });
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleBarcodeScanned = async (isbn: string) => {
    stopScanner();
    setIsScannerOpen(false);
    await fetchUniversalMetadata(isbn);
  };

  const captureCover = async () => {
    if (!videoRef.current) return;
    setIsProcessingScan(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUri = canvas.toDataURL("image/jpeg");
    try {
      const analysis = await aiCoverScanner({ photoDataUri: dataUri });
      setIsScannerOpen(false);
      stopScanner();
      await fetchUniversalMetadata(`${analysis.title} ${analysis.author}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Analyse échouée" });
    } finally {
      setIsProcessingScan(false);
    }
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;
    if (!selectedStatus || !selectedFormat) {
      toast({ variant: "destructive", title: "Précision requise", description: "Veuillez choisir un statut et un format." });
      return;
    }

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
        toast({ title: "Pépite enregistrée", description: `${pendingBook.title} est dans votre écrin.` });
        setPendingBook(null);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: booksRef.path,
          operation: 'create',
          requestResourceData: bookData,
        }));
      })
      .finally(() => setIsAdding(false));
  };

  return (
    <div className="space-y-12 animate-paper pb-32">
      <header className="text-center space-y-4 pt-8">
        <Sparkles className="h-12 w-12 text-primary/40 animate-float mx-auto" />
        <h1 className="text-6xl font-headline italic tracking-tight">Nouvelles Pépites</h1>
        <p className="text-primary/60 italic text-lg max-w-lg mx-auto">Recherchez ou scannez pour enrichir votre univers.</p>
      </header>

      <div className="max-w-3xl mx-auto space-y-6 px-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Titre, auteur, série ou ISBN..." 
              value={queryStr}
              onChange={(e) => setQueryStr(e.target.value)}
              className="pl-14 h-16 bg-white/60 border-white shadow-sm rounded-2xl text-xl italic"
            />
          </div>
          <Button type="submit" className="h-16 px-10 rounded-2xl bg-primary text-xl font-headline italic" disabled={isSearching}>
            {isSearching ? <Loader2 className="h-6 w-6 animate-spin" /> : "Chercher"}
          </Button>
        </form>
        
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="h-16 rounded-2xl font-headline italic text-xl gap-3"><Scan className="h-6 w-6" /> Scanner</Button>
          <Button variant="outline" onClick={() => setIsManualDialogOpen(true)} className="h-16 rounded-2xl font-headline italic text-xl gap-3"><Edit3 className="h-6 w-6" /> Manuel</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8 px-4">
        {errorDetails && <Alert className="glass-card text-destructive"><AlertTitle>Information</AlertTitle><AlertDescription>{errorDetails}</AlertDescription></Alert>}
        {isProcessingScan && <div className="py-24 text-center space-y-6"><RefreshCw className="h-16 w-16 mx-auto text-primary animate-spin" /><p className="font-headline italic text-2xl">Analyse en cours...</p></div>}

        <div className="grid gap-8">
          {results.map((book) => {
            const existing = findExistingBook(book);
            return (
              <Card key={book.id} className="glass-card overflow-hidden group">
                <CardContent className="p-0 flex flex-col sm:row flex-row">
                  <div className="relative w-48 aspect-[2/3] shrink-0 bg-secondary/5"><Image src={book.cover || "https://picsum.photos/seed/p/200/300"} alt={book.title} fill className="object-contain" /></div>
                  <div className="p-8 flex flex-col flex-1 gap-6">
                    <div className="space-y-1">
                      <h3 className="text-3xl font-headline italic leading-tight">{book.title}</h3>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{book.author}</p>
                    </div>
                    <div className="flex justify-end pt-4">
                      {existing ? (
                        <Badge className="h-14 px-8 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 text-lg italic"><CheckCircle2 className="mr-3 h-5 w-5" /> En bibliothèque</Badge>
                      ) : (
                        <Button onClick={() => setPendingBook(book)} className="h-14 px-10 rounded-2xl bg-primary text-xl font-headline italic"><Plus className="mr-3 h-6 w-6" /> Ajouter</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card border-none max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-10 border-b border-primary/5 bg-white/40 shrink-0">
            <DialogTitle className="font-headline text-4xl italic">Ajouter au sanctuaire</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10">
              <div className="flex gap-8 items-start">
                 <div className="relative h-44 w-32 shrink-0 rounded-2xl overflow-hidden shadow-2xl"><Image src={pendingBook?.cover || "https://picsum.photos/seed/p/200/300"} alt="" fill className="object-cover" /></div>
                 <div className="space-y-3">
                   <h3 className="font-headline italic text-3xl">{pendingBook?.title}</h3>
                   <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{pendingBook?.author}</p>
                 </div>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Votre intention</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUSES).map(([k, v]) => (
                      <Button key={k} variant="outline" onClick={() => setSelectedStatus(k as BookStatus)} className={cn("rounded-full h-11 px-5 uppercase text-[10px] font-bold tracking-widest", selectedStatus === k ? "bg-primary text-white" : "bg-white/60")}>{v.label}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(FORMATS).map(([k, v]) => (
                      <Button key={k} variant="outline" onClick={() => setSelectedFormat(k as BookFormat)} className={cn("rounded-2xl h-14 gap-3", selectedFormat === k ? "bg-primary text-white" : "bg-white/60")}>
                        <v.icon className="h-5 w-5" /> <span className="font-headline italic text-lg">{v.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-primary/5 flex items-center justify-between">
                  <div className="space-y-1"><p className="font-headline italic text-xl">De Plume</p><p className="text-[10px] uppercase opacity-40 font-bold">Favori absolu</p></div>
                  <Button variant="ghost" size="icon" onClick={() => setIsDePlume(!isDePlume)} className={cn("rounded-full h-14 w-14", isDePlume ? "text-primary bg-primary/10" : "text-muted-foreground/20")}><Heart className={cn("h-8 w-8", isDePlume && "fill-primary")} /></Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-10 border-t border-primary/5 bg-white/60 shrink-0">
            <Button variant="ghost" onClick={() => setPendingBook(null)} className="h-14 font-headline italic text-xl">Annuler</Button>
            <Button onClick={confirmAdd} disabled={isAdding} className="h-16 px-14 rounded-[2rem] bg-primary text-2xl font-headline italic">
              {isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : "Enregistrer ce livre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScannerOpen} onOpenChange={(o) => { if(!o) stopScanner(); setIsScannerOpen(o); }}>
        <DialogContent className="glass-card max-w-2xl p-0 overflow-hidden bg-white/95">
          <DialogHeader className="p-10 border-b flex flex-row items-center justify-between"><DialogTitle className="font-headline text-4xl italic">Scanner</DialogTitle><Button variant="ghost" onClick={() => setIsScannerOpen(false)}><X className="h-8 w-8" /></Button></DialogHeader>
          <div className="bg-black aspect-video relative flex items-center justify-center">
            {scanMode === "barcode" ? <div id="reader" className="w-full h-full"></div> : <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />}
          </div>
          <div className="p-10 space-y-8">
            <div className="flex p-2 bg-primary/5 rounded-[2rem] gap-2">
              <Button variant={scanMode === 'barcode' ? 'default' : 'ghost'} onClick={() => setScanMode('barcode')} className="flex-1 h-16 font-headline italic text-xl"><Barcode className="h-6 w-6 mr-3" /> Code-Barres</Button>
              <Button variant={scanMode === 'cover' ? 'default' : 'ghost'} onClick={() => setScanMode('cover')} className="flex-1 h-16 font-headline italic text-xl"><Camera className="h-6 w-6 mr-3" /> Couverture</Button>
            </div>
            {scanMode === "cover" && <Button onClick={captureCover} disabled={isProcessingScan} className="w-full h-20 rounded-[2rem] bg-primary text-2xl font-headline italic">Identifier la couverture</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
