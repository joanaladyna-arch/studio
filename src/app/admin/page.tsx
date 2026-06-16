
"use client";

import { useState, useRef } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, getDoc, getDocs, arrayUnion } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Book, 
  Landmark, 
  FileSpreadsheet, 
  Loader2, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  FileJson
} from "lucide-react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, fetchWithTimeout, ADMIN_EMAILS } from "@/lib/utils";

export default function AdminPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Excel states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number } | null>(null);
  const [isSyncingAuthors, setIsSyncingAuthors] = useState(false);
  const [isFillingDescriptions, setIsFillingDescriptions] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);
  const [fillResults, setFillResults] = useState<{ filled: number; notFound: number; skipped: number } | null>(null);

  // Simple Admin check
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || "");

  if (!user || !isAdmin) {
    return <div className="p-20 text-center italic">Accès réservé aux gardiens de Plume.</div>;
  }

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setExcelData(json);
        toast({ title: "Fichier prêt", description: `${json.length} lignes détectées.` });
      } catch (err) {
        toast({ variant: "destructive", title: "Erreur de lecture", description: "Format Excel invalide." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importToFirestore = async () => {
    if (!db || excelData.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setImportResults(null);

    let success = 0;
    let errors = 0;
    const batchSize = 100;

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      try {
        // Validation minimale
        const title = row.title || row.Titre;
        const authorStr = row.authors || row.Auteurs || "Inconnu";
        
        if (!title) {
          errors++;
          continue;
        }

        const isbn13 = row.isbn13?.toString().trim();
        const bookId = isbn13 || slugify(`${title}-${authorStr}`);

        // 1. Création/Mise à jour MasterBook
        const masterBookRef = doc(db, "masterBooks", bookId);
        const bookData = {
          title: title.toString(),
          subtitle: (row.subtitle || row.SousTitre || "").toString(),
          author: authorStr.toString(),
          isbn13: isbn13 || "",
          isbn10: (row.isbn10 || "").toString(),
          publisher: (row.publisher || row.Editeur || "").toString(),
          collection: (row.collection || "").toString(),
          publishedDate: (row.publishedDate || row.DatePublication || "").toString(),
          language: (row.language || row.Langue || "Français").toString(),
          pageCount: parseInt(row.pageCount || row.Pages || "0"),
          cover: (row.cover || row.Couverture || "").toString(),
          description: (row.description || row.Description || "").toString(),
          genres: (row.genres || "").toString().split(",").map((s: string) => s.trim()).filter(Boolean),
          tropes: (row.tropes || "").toString().split(",").map((s: string) => s.trim()).filter(Boolean),
          series: (row.series || "").toString(),
          volume: (row.volume || "").toString(),
          updatedAt: serverTimestamp(),
          source: "excel-import"
        };

        await setDoc(masterBookRef, bookData, { merge: true });

        // 2. Création/Mise à jour Publisher si présent
        if (bookData.publisher) {
          const pubId = slugify(bookData.publisher);
          await setDoc(doc(db, "publishers", pubId), {
            name: bookData.publisher,
            slug: pubId,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        // 3. Création/Mise à jour Authors si présent — on référence aussi
        // l'œuvre elle-même (titre + ID de la fiche maître) sur la fiche
        // auteur, pour que sa bibliographie se complète au fil des imports
        // au lieu de ne stocker que son nom.
        const actualAuthors = bookData.author.split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const authName of actualAuthors) {
          const authId = slugify(authName);
          await setDoc(doc(db, "authors", authId), {
            name: authName,
            slug: authId,
            works: arrayUnion(bookData.title),
            bookIds: arrayUnion(bookId),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        success++;
      } catch (err) {
        console.error("Row import error:", err);
        errors++;
      }

      // Update progress
      if ((i + 1) % 10 === 0 || i === excelData.length - 1) {
        setProgress(Math.round(((i + 1) / excelData.length) * 100));
      }
    }

    setImportResults({ success, errors });
    setIsProcessing(false);
    toast({ 
      title: "Importation terminée", 
      description: `${success} pépites ajoutées, ${errors} échecs.` 
    });
    setExcelData([]); // Clear data after import
  };

  // Reconstruit les fiches auteur (nom, œuvres, IDs des livres) à partir
  // de TOUS les livres déjà présents dans masterBooks — pas seulement ceux
  // importés par Excel, mais aussi ceux ajoutés via la recherche/l'API.
  // Permet de compléter les fiches auteur après coup, sans réimporter.
  const syncAuthors = async () => {
    if (!db) return;
    setIsSyncingAuthors(true);
    let booksProcessed = 0;
    let authorsTouched = 0;
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      for (const bookDoc of snap.docs) {
        const data = bookDoc.data();
        const authorStr = (data.author || "").toString();
        if (!authorStr) continue;
        const authorNames = authorStr.split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const authName of authorNames) {
          const authId = slugify(authName);
          if (!authId) continue;
          try {
            await setDoc(doc(db, "authors", authId), {
              name: authName,
              slug: authId,
              works: arrayUnion(data.title || "Titre inconnu"),
              bookIds: arrayUnion(bookDoc.id),
              updatedAt: serverTimestamp()
            }, { merge: true });
            authorsTouched++;
          } catch (err) {
            console.error("Sync Author Error:", authName, err);
          }
        }
        booksProcessed++;
      }
      toast({
        title: "Synchronisation terminée",
        description: `${booksProcessed} livres parcourus, ${authorsTouched} fiches auteur mises à jour.`
      });
    } catch (err) {
      console.error("Sync Authors Error:", err);
      toast({ variant: "destructive", title: "Échec de la synchronisation", description: "Vérifie les règles Firestore (lecture sur masterBooks, écriture sur authors)." });
    } finally {
      setIsSyncingAuthors(false);
    }
  };

  // Recherche un résumé via Google Books (par ISBN si disponible, sinon
  // par titre + auteur) pour toutes les fiches maître qui n'en ont pas
  // encore — utile pour les livres ajoutés avant l'enrichissement
  // systématique des résumés, ou dont la source d'origine n'en fournissait
  // pas. Ne touche jamais aux livres qui ont déjà un résumé.
  const fillMissingDescriptions = async () => {
    if (!db) return;
    setIsFillingDescriptions(true);
    setFillProgress(0);
    setFillResults(null);
    let filled = 0;
    let notFound = 0;
    let skipped = 0;
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      const candidates = snap.docs.filter((d) => !((d.data().description || "").toString().trim()));
      skipped = snap.docs.length - candidates.length;

      for (let i = 0; i < candidates.length; i++) {
        const bookDoc = candidates[i];
        const data = bookDoc.data();
        const isbn = (data.isbn13 || data.isbn || "").toString().trim();
        const title = (data.title || "").toString().trim();
        const author = (data.author || "").toString().trim();
        let description = "";

        try {
          if (isbn) {
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`, {}, 8000);
            const json = await res.json();
            description = json.items?.[0]?.volumeInfo?.description || "";
          }
          if (!description && title) {
            const q = author ? `${title} ${author}` : title;
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}`, {}, 8000);
            const json = await res.json();
            description = json.items?.[0]?.volumeInfo?.description || "";
          }
        } catch (err) {
          console.error("Recherche résumé échouée:", title, err);
        }

        if (description) {
          try {
            await setDoc(doc(db, "masterBooks", bookDoc.id), { description, updatedAt: serverTimestamp() }, { merge: true });
            filled++;
          } catch (err) {
            console.error("Écriture résumé échouée:", title, err);
            notFound++;
          }
        } else {
          notFound++;
        }

        setFillProgress(Math.round(((i + 1) / candidates.length) * 100));
      }

      setFillResults({ filled, notFound, skipped });
      toast({
        title: "Recherche terminée",
        description: `${filled} résumés complétés, ${notFound} introuvables, ${skipped} en avaient déjà un.`
      });
    } catch (err) {
      console.error("Fill Descriptions Error:", err);
      toast({ variant: "destructive", title: "Échec", description: "Vérifie les règles Firestore (lecture/écriture sur masterBooks)." });
    } finally {
      setIsFillingDescriptions(false);
    }
  };

  const importByIsbn = async () => {
    const cleanIsbn = isbn.trim();
    if (!cleanIsbn || !db) return;
    setLoading(true);
    try {
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}`;
      const res = await fetchWithTimeout(gUrl, {}, 8000);
      const data = await res.json();

      if (data.items?.[0]?.volumeInfo) {
        const info = data.items[0].volumeInfo;
        // On nettoie l'ISBN avant de l'utiliser comme identifiant de document
        // Firestore (un "/" dans l'ID casserait le chemin).
        const docId = slugify(cleanIsbn);
        const masterRef = doc(db, "masterBooks", docId);
        await setDoc(masterRef, {
          title: info.title || "Titre inconnu",
          author: info.authors ? info.authors.join(", ") : "Inconnu",
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
          isbn13: cleanIsbn,
          description: info.description || "",
          publisher: info.publisher || "",
          pageCount: info.pageCount || 0,
          updatedAt: serverTimestamp(),
          source: "admin-isbn-import"
        }, { merge: true });
        toast({ title: "Livre importé", description: `${info.title || "Le livre"} a été ajouté à la base centrale.` });
        setIsbn("");
      } else {
        toast({ variant: "destructive", title: "ISBN introuvable" });
      }
    } catch (err) {
      console.error("Import ISBN Error:", err);
      toast({ variant: "destructive", title: "Erreur d'importation" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-paper pb-24 max-w-7xl mx-auto px-4">
      <header className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Shield className="h-12 w-12 text-primary" />
          <div className="space-y-1">
            <h1 className="text-5xl font-headline italic">Sanctuaire Admin</h1>
            <p className="text-primary/60 italic text-sm font-medium">Gestion de la base de données centrale Plume.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-10">
        {/* EXCEL IMPORT SECTION */}
        <Card className="glass-card border-none bg-white/60 shadow-xl">
          <CardHeader className="p-10 border-b border-primary/5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-500" /> Importer ma base de données
                </CardTitle>
                <CardDescription className="italic">Fichier .xlsx, .xls ou .csv — colonnes : isbn13, title, authors, publisher, genres, tropes...</CardDescription>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".xlsx,.xls,.csv"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline"
                className="rounded-2xl h-14 px-8 border-emerald-200 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-50 italic font-headline text-xl"
              >
                <Upload className="mr-3" /> Choisir un fichier
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            {excelData.length > 0 && !isProcessing && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-headline italic flex items-center gap-3">
                    <Eye className="h-6 w-6 opacity-40" /> Aperçu des 20 premières lignes
                  </h3>
                  <Badge className="bg-primary/10 text-primary border-none py-2 px-4 italic">{excelData.length} lignes à importer</Badge>
                </div>
                <div className="rounded-2xl border border-primary/5 overflow-hidden shadow-inner bg-white/40">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-white/60">
                        <TableRow>
                          <TableHead className="font-bold italic">ISBN13</TableHead>
                          <TableHead className="font-bold italic">Titre</TableHead>
                          <TableHead className="font-bold italic">Auteur(s)</TableHead>
                          <TableHead className="font-bold italic">Éditeur</TableHead>
                          <TableHead className="font-bold italic">Genres</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {excelData.slice(0, 20).map((row, i) => (
                          <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                            <TableCell className="text-xs font-mono">{row.isbn13 || row.ISBN13 || "-"}</TableCell>
                            <TableCell className="font-headline italic text-sm">{row.title || row.Titre}</TableCell>
                            <TableCell className="text-xs opacity-60 font-bold uppercase">{row.authors || row.Auteurs}</TableCell>
                            <TableCell className="text-xs italic">{row.publisher || row.Editeur}</TableCell>
                            <TableCell className="text-[10px] opacity-40">{row.genres || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                <Button 
                  onClick={importToFirestore} 
                  className="w-full h-16 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-200 font-headline italic text-2xl transition-transform active:scale-95"
                >
                  <CheckCircle2 className="mr-4 h-8 w-8" /> Lancer l'importation dans PLUME
                </Button>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-6 text-center py-10">
                <div className="flex items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-headline italic text-3xl">Gravure en cours... {progress}%</p>
                </div>
                <Progress value={progress} className="h-4 bg-primary/10" />
                <p className="text-primary/40 italic">La base Plume s'enrichit de nouvelles pépites.</p>
              </div>
            )}

            {importResults && (
              <div className="p-10 rounded-[3rem] bg-emerald-50 border border-emerald-100 flex flex-col items-center gap-6 animate-in zoom-in duration-500">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-headline italic text-emerald-700">Importation terminée !</h3>
                  <p className="text-emerald-600/60 font-medium">
                    {importResults.success} pépites ajoutées avec succès, {importResults.errors} erreurs.
                  </p>
                </div>
                <Button onClick={() => setImportResults(null)} variant="ghost" className="text-emerald-700 font-headline italic text-xl">Fermer</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ISBN SINGLE IMPORT SECTION */}
        <div className="grid md:grid-cols-2 gap-10">
          <Card className="glass-card border-none bg-white/60 shadow-lg">
            <CardHeader className="p-10 border-b border-primary/5">
              <CardTitle className="font-headline text-2xl italic flex items-center gap-3">
                <Book className="h-6 w-6 text-primary" /> Import Unique MasterBook
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">ISBN 13</label>
                <Input 
                  placeholder="9782..." 
                  value={isbn} 
                  onChange={(e) => setIsbn(e.target.value)}
                  className="h-14 italic bg-white/40 rounded-2xl border-none shadow-inner"
                />
              </div>
              <Button onClick={importByIsbn} disabled={loading} className="w-full h-14 bg-primary rounded-2xl italic text-xl shadow-xl shadow-primary/10 transition-transform active:scale-95">
                {loading ? <Loader2 className="animate-spin" /> : "Importer via Google Books"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-none bg-white/60 shadow-lg">
            <CardHeader className="p-10 border-b border-primary/5">
              <CardTitle className="font-headline text-2xl italic flex items-center gap-3">
                <Landmark className="h-6 w-6 text-amber-500" /> Maintenance Système
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10 flex flex-col gap-4">
               <Button variant="outline" onClick={syncAuthors} disabled={isSyncingAuthors} className="h-14 rounded-2xl italic font-headline text-lg border-primary/10">
                 {isSyncingAuthors ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null} Synchroniser les Auteurs
               </Button>
               <Button variant="outline" onClick={fillMissingDescriptions} disabled={isFillingDescriptions} className="h-14 rounded-2xl italic font-headline text-lg border-primary/10">
                 {isFillingDescriptions ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null} Compléter les résumés manquants
               </Button>
               {isFillingDescriptions && (
                 <div className="space-y-1">
                   <Progress value={fillProgress} className="h-2 bg-primary/10" />
                   <p className="text-[10px] text-center opacity-40 italic">{fillProgress}%</p>
                 </div>
               )}
               {fillResults && (
                 <p className="text-[10px] text-center opacity-60 italic">
                   {fillResults.filled} résumés complétés, {fillResults.notFound} introuvables, {fillResults.skipped} en avaient déjà un.
                 </p>
               )}
               <Button variant="outline" className="h-14 rounded-2xl italic font-headline text-lg border-primary/10">Nettoyer les Genres</Button>
               <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest mt-4">Statut : En ligne et sécurisé</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, className, variant }: any) {
  return (
    <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", className)}>
      {children}
    </div>
  );
}
