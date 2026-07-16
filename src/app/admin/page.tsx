"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, getDoc, getDocs, arrayUnion } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { navItems } from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Landmark, 
  FileSpreadsheet, 
  Loader2, 
  Upload, 
  CheckCircle2, 
  Eye,
  FileJson,
  Save,
  Sparkles,
  Hash
} from "lucide-react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MasterBookManager } from "@/components/master-book-manager";
import { AdminMessagerie } from "@/components/admin-messagerie";
import { PublisherReviewQueue } from "@/components/publisher-review-queue";
import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminActualitesQueue } from "@/components/admin-actualites-queue";
import { cn, fetchWithTimeout, ADMIN_EMAILS, slugify, cleanIsbnValue, cleanDescriptionHtml, stableBookKey, authorKey, searchBnF } from "@/lib/utils";

export default function AdminPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number } | null>(null);
  const [isSyncingAuthors, setIsSyncingAuthors] = useState(false);
  const [isFillingDescriptions, setIsFillingDescriptions] = useState(false);
  const [isCleaningDescriptions, setIsCleaningDescriptions] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);
  const [fillResults, setFillResults] = useState<{ filled: number; notFound: number; skipped: number } | null>(null);
  const [isCleaningGenres, setIsCleaningGenres] = useState(false);
  const [cleanResults, setCleanResults] = useState<{ cleaned: number } | null>(null);

  // ── Compléter ISBN + Éditeur via BnF ──────────────────────────────────
  const [isFillingIsbn, setIsFillingIsbn] = useState(false);
  const [isbnProgress, setIsbnProgress] = useState(0);
  const [isbnResults, setIsbnResults] = useState<{ filled: number; notFound: number; skipped: number } | null>(null);

  const [navOverrides, setNavOverrides] = useState<Record<string, { label?: string; visible?: boolean }>>({});
  const [isLoadingNav, setIsLoadingNav] = useState(false);
  const [isSavingNav, setIsSavingNav] = useState(false);
  const [navLoaded, setNavLoaded] = useState(false);

  useEffect(() => {
    if (!db || navLoaded) return;
    setIsLoadingNav(true);
    getDoc(doc(db, "config", "navigation"))
      .then((snap) => {
        if (snap.exists()) setNavOverrides(snap.data()?.items || {});
        setNavLoaded(true);
      })
      .catch((err) => { console.error("Load Nav Config Error:", err); })
      .finally(() => setIsLoadingNav(false));
  }, [db, navLoaded]);

  const updateNavLabel = (id: string, label: string) => {
    setNavOverrides((prev) => ({ ...prev, [id]: { ...prev[id], label } }));
  };

  const toggleNavVisible = (id: string) => {
    setNavOverrides((prev) => {
      const current = prev[id]?.visible !== false;
      return { ...prev, [id]: { ...prev[id], visible: !current } };
    });
  };

  const saveNavConfig = async () => {
    if (!db) return;
    setIsSavingNav(true);
    try {
      await setDoc(doc(db, "config", "navigation"), { items: navOverrides, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Navigation mise à jour" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setIsSavingNav(false);
    }
  };

  const cleanGenres = async () => {
    if (!db) return;
    setIsCleaningGenres(true);
    setCleanResults(null);
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      let cleaned = 0;
      const dedupe = (arr: any): string[] => {
        const list = Array.isArray(arr) ? arr : [];
        const seen = new Set<string>();
        const out: string[] = [];
        list.forEach((v: any) => {
          const t = v?.toString().trim();
          if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
        });
        return out;
      };
      for (const d of snap.docs) {
        const data = d.data();
        const newGenres = dedupe(data.genres);
        const newTropes = dedupe(data.tropes);
        const newThemes = dedupe(data.themes);
        const changed =
          JSON.stringify(newGenres) !== JSON.stringify(data.genres || []) ||
          JSON.stringify(newTropes) !== JSON.stringify(data.tropes || []) ||
          JSON.stringify(newThemes) !== JSON.stringify(data.themes || []);
        if (changed) {
          await setDoc(doc(db, "masterBooks", d.id), { genres: newGenres, tropes: newTropes, themes: newThemes }, { merge: true });
          cleaned++;
        }
      }
      setCleanResults({ cleaned });
      toast({ title: "Nettoyage terminé", description: `${cleaned} fiche(s) nettoyée(s).` });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur de nettoyage" });
    } finally {
      setIsCleaningGenres(false);
    }
  };

  // ── Compléter ISBN + Éditeur manquants via BnF UNIQUEMENT ─────────────
  const fillMissingIsbnPublisher = async () => {
    if (!db) return;
    setIsFillingIsbn(true);
    setIsbnProgress(0);
    setIsbnResults(null);
    let filled = 0; let notFound = 0; let skipped = 0;
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      // On ne traite que les fiches où ISBN ou éditeur est manquant
      const candidates = snap.docs.filter(d => {
        const data = d.data();
        return !data.isbn13?.toString().trim() || !data.publisher?.toString().trim();
      });
      skipped = snap.docs.length - candidates.length;

      for (let i = 0; i < candidates.length; i++) {
        const bookDoc = candidates[i];
        const data = bookDoc.data();
        const title  = (data.title  || "").toString().trim();
        const author = (data.author || "").toString().trim();
        if (!title) { notFound++; setIsbnProgress(Math.round(((i+1)/candidates.length)*100)); continue; }

        let foundIsbn      = "";
        let foundPublisher = "";
        let foundDescription = "";

        try {
          // Recherche BnF par titre + auteur
          const q = author ? `${title} ${author}` : title;
          const results = await searchBnF(q, "general");

          // On cherche d'abord une correspondance exacte de titre
          const match = results.find(r =>
            r.title?.toLowerCase().trim() === title.toLowerCase().trim()
          ) || results[0]; // sinon premier résultat

          if (match) {
            if (!data.isbn13?.toString().trim() && match.isbn?.trim())
              foundIsbn = match.isbn.trim();
            if (!data.publisher?.toString().trim() && match.publisher?.trim())
              foundPublisher = match.publisher.trim();
            // Bonus : résumé si manquant
            if (!data.description?.toString().trim() && match.description?.trim())
              foundDescription = cleanDescriptionHtml(match.description);
          }
        } catch (err) {
          console.error("BnF search error:", title, err);
        }

        if (foundIsbn || foundPublisher || foundDescription) {
          const updates: any = { updatedAt: serverTimestamp() };
          if (foundIsbn)        updates.isbn13      = foundIsbn;
          if (foundPublisher)   updates.publisher   = foundPublisher;
          if (foundDescription) updates.description = foundDescription;
          try {
            await setDoc(doc(db, "masterBooks", bookDoc.id), updates, { merge: true });
            filled++;
          } catch (err) {
            console.error("Write error:", title, err);
            notFound++;
          }
        } else {
          notFound++;
        }

        setIsbnProgress(Math.round(((i + 1) / candidates.length) * 100));
      }

      setIsbnResults({ filled, notFound, skipped });
      toast({
        title: "Terminé",
        description: `${filled} fiche(s) complétée(s), ${notFound} introuvables dans la BnF, ${skipped} déjà complètes.`,
      });
    } catch (err) {
      console.error("FillMissingIsbn Error:", err);
      toast({ variant: "destructive", title: "Erreur", description: (err as any)?.message });
    } finally {
      setIsFillingIsbn(false);
    }
  };

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || "");
  if (!user || !isAdmin) {
    return <div className="p-20 text-center italic">Accès réservé aux gardiens de Lectoria.</div>;
  }

  const normalizeContributor = (raw: string): string => {
    const namePart = raw.split(/\s-\s|\./)[0].trim();
    const parts = namePart.split(",");
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return `${parts[1].trim()} ${parts[0].trim()}`;
    }
    return namePart;
  };

  const getField = (row: any, ...names: string[]): string => {
    const lowerMap: Record<string, any> = {};
    Object.keys(row).forEach((k) => { lowerMap[k.toLowerCase().trim()] = row[k]; });
    for (const name of names) {
      const v = lowerMap[name.toLowerCase()];
      if (v !== undefined && v !== null && v.toString().trim() !== "") return v.toString().trim();
    }
    return "";
  };

  const downloadTemplate = () => {
    const headers = ["Titre", "Auteur", "Traducteur", "Editeur", "Annee", "ISBN", "Langue", "Pages", "Description", "Genres", "Tropes", "Themes", "Tome"];
    const example = ["Deviant King", "Rina Kent", "Marie Bagot", "BMR", "2024", "9782017286271", "FR", "460", "Le premier tome de la saga Royal Elite.", "Dark romance, New adult", "Enemies to lovers, Forbidden love", "Pouvoir, Vengeance", "1"];
    const note = ["Astuce : Genres / Tropes / Themes acceptent plusieurs valeurs séparées par une virgule."];
    const ws = XLSX.utils.aoa_to_sheet([headers, example, [], note]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Lectoria");
    XLSX.writeFile(wb, "modele-import-lectoria.xlsx");
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
    let success = 0; let errors = 0;
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      try {
        const title = getField(row, "title", "titre");
        const authorStr = getField(row, "authors", "auteurs", "auteur") || "Inconnu";
        if (!title) { errors++; continue; }
        const isbn13 = cleanIsbnValue(getField(row, "isbn13", "isbn"));
        const bookId = isbn13 || stableBookKey(title.toString(), authorStr.toString());
        const masterBookRef = doc(db, "masterBooks", bookId);
        const existingSnap = await getDoc(masterBookRef);
        const existing: any = existingSnap.exists() ? existingSnap.data() : {};
        const keepText = (incoming: string, current: any) => (incoming && incoming.trim()) ? incoming : (current ?? "");
        const keepArray = (incoming: string[], current: any) => (incoming && incoming.length) ? incoming : (Array.isArray(current) ? current : []);
        const keepNumber = (incoming: number, current: any) => incoming > 0 ? incoming : (current ?? 0);
        const excelGenres = getField(row, "genres").split(",").map((s: string) => s.trim()).filter(Boolean);
        const excelTropes = getField(row, "tropes").split(",").map((s: string) => s.trim()).filter(Boolean);
        const excelThemes = getField(row, "themes").split(",").map((s: string) => s.trim()).filter(Boolean);
        const bookData = {
          title: keepText(title.toString(), existing.title),
          subtitle: keepText(getField(row, "subtitle", "soustitre", "sous-titre"), existing.subtitle),
          author: keepText(authorStr.toString(), existing.author),
          translator: keepText(normalizeContributor(getField(row, "translator", "traducteur", "contributeur")), existing.translator),
          isbn13: keepText(isbn13, existing.isbn13),
          isbn10: keepText(cleanIsbnValue(getField(row, "isbn10")), existing.isbn10),
          publisher: keepText(getField(row, "publisher", "editeur", "éditeur"), existing.publisher),
          collection: keepText(getField(row, "collection"), existing.collection),
          publishedDate: keepText(getField(row, "publisheddate", "datepublication", "date", "annee", "année"), existing.publishedDate),
          language: keepText(getField(row, "language", "langue"), existing.language) || "Français",
          pageCount: keepNumber(parseInt(getField(row, "pagecount", "pages") || "0"), existing.pageCount),
          cover: keepText(getField(row, "cover", "couverture"), existing.cover),
          description: keepText(getField(row, "description"), existing.description),
          genres: keepArray(excelGenres, existing.genres),
          tropes: keepArray(excelTropes, existing.tropes),
          themes: keepArray(excelThemes, existing.themes),
          series: keepText(getField(row, "series", "serie", "série"), existing.series),
          volume: keepText(getField(row, "volume", "tome"), existing.volume),
          updatedAt: serverTimestamp(),
          source: existing.source || "excel-import"
        };
        await setDoc(masterBookRef, bookData, { merge: true });
        if (bookData.publisher) {
          const pubId = slugify(bookData.publisher);
          await setDoc(doc(db, "publishers", pubId), { name: bookData.publisher, slug: pubId, updatedAt: serverTimestamp() }, { merge: true });
        }
        const actualAuthors = bookData.author.split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const authName of actualAuthors) {
          const authId = authorKey(authName);
          await setDoc(doc(db, "authors", authId), { name: authName, slug: authId, works: arrayUnion(bookData.title), bookIds: arrayUnion(bookId), updatedAt: serverTimestamp() }, { merge: true });
        }
        success++;
      } catch (err) { console.error("Row import error:", err); errors++; }
      if ((i + 1) % 10 === 0 || i === excelData.length - 1) {
        setProgress(Math.round(((i + 1) / excelData.length) * 100));
      }
    }
    setImportResults({ success, errors });
    setIsProcessing(false);
    toast({ title: "Importation terminée", description: `${success} pépites ajoutées, ${errors} échecs.` });
    setExcelData([]);
  };

  const syncAuthors = async () => {
    if (!db) return;
    setIsSyncingAuthors(true);
    let booksProcessed = 0; let authorsTouched = 0;
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      for (const bookDoc of snap.docs) {
        const data = bookDoc.data();
        const authorStr = (data.author || "").toString();
        if (!authorStr) continue;
        const authorNames = authorStr.split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const authName of authorNames) {
          const authId = authorKey(authName);
          if (!authId) continue;
          try {
            await setDoc(doc(db, "authors", authId), { name: authName, slug: authId, works: arrayUnion(data.title || "Titre inconnu"), bookIds: arrayUnion(bookDoc.id), updatedAt: serverTimestamp() }, { merge: true });
            authorsTouched++;
          } catch (err) { console.error("Sync Author Error:", authName, err); }
        }
        booksProcessed++;
      }
      toast({ title: "Synchronisation terminée", description: `${booksProcessed} livres parcourus, ${authorsTouched} fiches auteur mises à jour.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Échec de la synchronisation" });
    } finally {
      setIsSyncingAuthors(false);
    }
  };

  const fillMissingDescriptions = async () => {
    if (!db) return;
    setIsFillingDescriptions(true);
    setFillProgress(0);
    setFillResults(null);
    let filled = 0; let notFound = 0; let skipped = 0;
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
          if (title) {
            const bnfResults = isbn ? await searchBnF(isbn, "isbn") : await searchBnF(author ? `${title} ${author}` : title, "general");
            description = cleanDescriptionHtml(bnfResults[0]?.description);
          }
          if (!description && isbn) {
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&langRestrict=fr`, {}, 8000);
            const json = await res.json();
            description = cleanDescriptionHtml(json.items?.[0]?.volumeInfo?.description);
          }
          if (!description && title) {
            const q = author ? `${title} ${author}` : title;
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=fr`, {}, 8000);
            const json = await res.json();
            description = cleanDescriptionHtml(json.items?.[0]?.volumeInfo?.description);
          }
          if (!description && isbn) {
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`, {}, 8000);
            const json = await res.json();
            description = cleanDescriptionHtml(json.items?.[0]?.volumeInfo?.description);
          }
          if (!description && title) {
            const q = author ? `${title} ${author}` : title;
            const res = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}`, {}, 8000);
            const json = await res.json();
            description = cleanDescriptionHtml(json.items?.[0]?.volumeInfo?.description);
          }
        } catch (err) { console.error("Recherche résumé échouée:", title, err); }
        if (description) {
          try {
            await setDoc(doc(db, "masterBooks", bookDoc.id), { description, updatedAt: serverTimestamp() }, { merge: true });
            filled++;
          } catch (err) { notFound++; }
        } else { notFound++; }
        setFillProgress(Math.round(((i + 1) / candidates.length) * 100));
      }
      setFillResults({ filled, notFound, skipped });
      toast({ title: "Recherche terminée", description: `${filled} résumés complétés, ${notFound} introuvables, ${skipped} en avaient déjà un.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Échec" });
    } finally {
      setIsFillingDescriptions(false);
    }
  };

  const cleanRawHtmlDescriptions = async () => {
    if (!db) return;
    setIsCleaningDescriptions(true);
    let cleaned = 0; let checked = 0;
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      const writes: Promise<any>[] = [];
      snap.docs.forEach((bookDoc) => {
        const raw = (bookDoc.data() as any)?.description as string | undefined;
        if (!raw) return;
        checked++;
        const fixed = cleanDescriptionHtml(raw);
        if (fixed && fixed !== raw) {
          writes.push(setDoc(doc(db, "masterBooks", bookDoc.id), { description: fixed, updatedAt: serverTimestamp() }, { merge: true }));
          cleaned++;
        }
      });
      await Promise.all(writes);
      toast({ title: "Nettoyage terminé", description: `${cleaned} résumé(s) nettoyé(s) sur ${checked} vérifié(s).` });
    } catch (err) {
      toast({ variant: "destructive", title: "Échec" });
    } finally {
      setIsCleaningDescriptions(false);
    }
  };

  return (
    <div className="space-y-12 animate-paper pb-24 max-w-7xl mx-auto px-4">
      <header className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Shield className="h-12 w-12 text-primary" />
          <div className="space-y-1">
            <h1 className="text-5xl font-headline italic">Sanctuaire Admin</h1>
            <p className="text-primary/60 italic text-sm font-medium">Gestion de la base de données centrale Lectoria.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-10">

        {/* ── ACTUALITÉS EN ATTENTE ── */}
        <Card className="glass-card border-none bg-white/60 shadow-xl">
          <CardHeader className="p-10 border-b border-primary/5">
            <div className="space-y-2">
              <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-rose" /> Actualités en attente
              </CardTitle>
              <CardDescription className="italic">
                Détectées automatiquement — lisez, cochez et validez avant publication sur /actualites.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <AdminActualitesQueue />
          </CardContent>
        </Card>

        <MasterBookManager />
        <AdminMessagerie />
        <PublisherReviewQueue />
        <AdminAnalytics />

        {/* EXCEL IMPORT SECTION */}
        <Card className="glass-card border-none bg-white/60 shadow-xl">
          <CardHeader className="p-10 border-b border-primary/5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-500" /> Importer ma base de données
                </CardTitle>
                <CardDescription className="italic">Fichier .xlsx, .xls ou .csv — n'importe quelle casse ou langue de colonnes acceptée.</CardDescription>
              </div>
              <div className="flex gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls,.csv" />
                <Button onClick={downloadTemplate} variant="outline" className="rounded-2xl h-14 px-6 border-primary/20 bg-white/40 text-primary/70 hover:bg-white/60 italic font-headline text-lg">
                  <FileJson className="mr-3 h-5 w-5" /> Modèle vierge
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="rounded-2xl h-14 px-8 border-emerald-200 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-50 italic font-headline text-xl">
                  <Upload className="mr-3" /> Choisir un fichier
                </Button>
              </div>
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
                            <TableCell className="text-xs font-mono">{getField(row, "isbn13", "isbn") || "-"}</TableCell>
                            <TableCell className="font-headline italic text-sm">{getField(row, "title", "titre")}</TableCell>
                            <TableCell className="text-xs opacity-60 font-bold uppercase">{getField(row, "authors", "auteurs", "auteur")}</TableCell>
                            <TableCell className="text-xs italic">{getField(row, "publisher", "editeur", "éditeur")}</TableCell>
                            <TableCell className="text-[10px] opacity-40">{getField(row, "genres") || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                <Button onClick={importToFirestore} className="w-full h-16 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-200 font-headline italic text-2xl transition-transform active:scale-95">
                  <CheckCircle2 className="mr-4 h-8 w-8" /> Lancer l'importation dans LECTORIA
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
              </div>
            )}
            {importResults && (
              <div className="p-10 rounded-[3rem] bg-emerald-50 border border-emerald-100 flex flex-col items-center gap-6 animate-in zoom-in duration-500">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-headline italic text-emerald-700">Importation terminée !</h3>
                  <p className="text-emerald-600/60 font-medium">{importResults.success} pépites ajoutées, {importResults.errors} erreurs.</p>
                </div>
                <Button onClick={() => setImportResults(null)} variant="ghost" className="text-emerald-700 font-headline italic text-xl">Fermer</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NAVIGATION MANAGEMENT SECTION */}
        <Card className="glass-card border-none bg-white/60 shadow-xl">
          <CardHeader className="p-10 border-b border-primary/5">
            <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" /> Gérer la navigation
            </CardTitle>
            <CardDescription className="italic">Renomme une rubrique ou masque-la sans avoir à coder.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-6">
            {isLoadingNav && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>}
            {!isLoadingNav && (
              <div className="space-y-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const override = navOverrides[item.id];
                  const isVisible = override?.visible !== false;
                  return (
                    <div key={item.id} className={cn("flex items-center gap-4 p-4 rounded-2xl bg-white/40 transition-opacity", !isVisible && "opacity-40")}>
                      <Icon className="h-5 w-5 text-primary/60 flex-shrink-0" />
                      <Input value={override?.label ?? item.label} onChange={(e) => updateNavLabel(item.id, e.target.value)} placeholder={item.label} className="h-11 italic bg-white/60 rounded-xl border-none shadow-inner flex-1" />
                      <span className="text-[10px] opacity-40 italic hidden sm:inline">{item.href}</span>
                      <Switch checked={isVisible} onCheckedChange={() => toggleNavVisible(item.id)} />
                    </div>
                  );
                })}
                <Button onClick={saveNavConfig} disabled={isSavingNav} className="w-full h-14 rounded-2xl bg-primary italic font-headline text-xl shadow-xl shadow-primary/10 transition-transform active:scale-95">
                  {isSavingNav ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} Enregistrer la navigation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MAINTENANCE SECTION */}
        <Card className="glass-card border-none bg-white/60 shadow-lg">
          <CardHeader className="p-10 border-b border-primary/5">
            <CardTitle className="font-headline text-2xl italic flex items-center gap-3">
              <Landmark className="h-6 w-6 text-amber-500" /> Maintenance Système
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 flex flex-col gap-4">

            {/* ── NOUVEAU : Compléter ISBN + Éditeur via BnF ── */}
            <Button variant="outline" onClick={fillMissingIsbnPublisher} disabled={isFillingIsbn} className="h-14 rounded-2xl italic font-headline text-lg border-amber-200 text-amber-700 hover:bg-amber-50">
              {isFillingIsbn ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Hash className="mr-3 h-5 w-5" />}
              Compléter ISBN + Éditeur manquants (BnF)
            </Button>
            {isFillingIsbn && (
              <div className="space-y-1">
                <Progress value={isbnProgress} className="h-2 bg-amber-100" />
                <p className="text-[10px] text-center opacity-40 italic">{isbnProgress}% — interrogation de la BnF…</p>
              </div>
            )}
            {isbnResults && (
              <p className="text-[10px] text-center opacity-60 italic">
                {isbnResults.filled} fiche(s) complétée(s), {isbnResults.notFound} introuvables dans la BnF, {isbnResults.skipped} déjà complètes.
              </p>
            )}

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
            <Button variant="outline" onClick={cleanRawHtmlDescriptions} disabled={isCleaningDescriptions} className="h-14 rounded-2xl italic font-headline text-lg border-primary/10">
              {isCleaningDescriptions ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null} Nettoyer les résumés (HTML brut)
            </Button>
            <Button variant="outline" onClick={cleanGenres} disabled={isCleaningGenres} className="h-14 rounded-2xl italic font-headline text-lg border-primary/10">
              {isCleaningGenres ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null} Nettoyer les Genres
            </Button>
            {cleanResults && (
              <p className="text-[10px] text-center opacity-60 italic">{cleanResults.cleaned} fiche(s) nettoyée(s).</p>
            )}
            <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest mt-4">Statut : En ligne et sécurisé</p>
          </CardContent>
        </Card>

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
