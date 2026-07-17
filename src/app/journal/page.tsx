"use client";

import { useState, useMemo, useRef } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen, Headset, Save, History, Plus, Star, Sparkles, MessageCircle,
  Quote, PlusCircle, Share2, Heart, FileDown, Cloud, LayoutList, BookMarked
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { TaxonomyEditor } from "@/components/taxonomy-editor";
import { Tags } from "lucide-react";
import { collection, addDoc, orderBy, query, limit, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from "next/link";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { RANKS } from "@/app/library/page";

// ─── Partage natif ─────────────────────────────────────────────────────────
async function shareText(title: string, text: string, onFallback: () => void) {
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try { await (navigator as any).share({ title, text }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(text); onFallback(); } catch {}
}

// ─── Constantes tags & humeurs ─────────────────────────────────────────────
const NOTE_TAGS = [
  { id: "citation",   label: "Citation",    emoji: "💬" },
  { id: "réflexion", label: "Réflexion",   emoji: "💭" },
  { id: "personnage", label: "Personnage",  emoji: "👤" },
  { id: "intrigue",  label: "Intrigue",    emoji: "🔍" },
  { id: "émotion",   label: "Émotion",     emoji: "💫" },
];

const NOTE_HUMEURS = [
  { id: "😍", label: "Coup de cœur" },
  { id: "😤", label: "Frustration"  },
  { id: "😭", label: "Émotion"      },
  { id: "😱", label: "Surprise"     },
];

// ─── Stop words FR pour le nuage ──────────────────────────────────────────
const FR_STOP = new Set([
  "le","la","les","de","du","des","un","une","et","en","au","aux","à","a",
  "je","il","elle","ils","elles","nous","vous","on","me","te","se","lui",
  "mon","ma","mes","ton","ta","tes","son","sa","ses","notre","nos","leur","leurs",
  "ce","cet","cette","ces","cela","ceci","ça","ca",
  "qui","que","quoi","dont","où","quand","comment","pourquoi",
  "plus","très","bien","tout","tous","toute","toutes","mais","ou","donc","ni","car",
  "ne","pas","rien","jamais","aussi","ainsi","si","comme",
  "avec","pour","sur","dans","par","sans","sous","entre","vers","chez",
  "après","avant","pendant","depuis","lors","même",
  "est","sont","était","étaient","être","avoir","fait","faire","dit","dire",
  "peut","vais","aller","suis","ai","ont","avait","été","vas","va",
  "alors","puis","voilà","voila",
  "qu","c","d","l","m","n","j","s","t","y",
]);

const CLOUD_COLORS = ["#C07A40","#8A72C7","#7BAA6A","#5496B6","#E07098","#F0845A","#F5C400"];

// ─── Page ──────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { adminMode } = useAdminMode();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();
  const wordCloudRef = useRef<HTMLDivElement>(null);

  // État formulaire
  const [readingNotes, setReadingNotes]   = useState("");
  const [listeningNotes, setListeningNotes] = useState("");
  const [title, setTitle]                 = useState("");
  const [noteTag, setNoteTag]             = useState("");
  const [noteHumeur, setNoteHumeur]       = useState("");
  const [viewByBook, setViewByBook]       = useState(false);
  const [isExportingNotes, setIsExportingNotes] = useState(false);
  const [isExportingCloud, setIsExportingCloud] = useState(false);

  // Requêtes Firestore — sans limit pour PDF et nuage
  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc"));
  }, [db, user]);
  const { data: pastEntries = [] } = useCollection(entriesQuery);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [] } = useCollection(booksQuery);

  // Données dérivées
  const notableBooks = useMemo(() =>
    (books as any[])
      .filter(b => b.status === "progress" || b.status === "pal")
      .sort((a, b) => (a.status === "progress" ? -1 : 1) - (b.status === "progress" ? -1 : 1)),
    [books]
  );

  const recommendedBooks = useMemo(() =>
    books.filter((b: any) => !!b.plumeRank)
      .sort((a: any, b: any) => (b.dateAdded?.toMillis?.() || 0) - (a.dateAdded?.toMillis?.() || 0)),
    [books]
  );

  const quotedBooks = useMemo(() =>
    books.filter((b: any) => (b.favoriteQuote || "").toString().trim()),
    [books]
  );

  // Notes groupées par livre
  const notesByBook = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pastEntries.forEach((e: any) => {
      const key = e.title || "Sans livre";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups);
  }, [pastEntries]);

  // ── Nuage des mots ────────────────────────────────────────────────────
  const wordFrequencies = useMemo(() => {
    const texts = [
      ...pastEntries.map((e: any) => e.content || ""),
      ...quotedBooks.map((b: any) => b.favoriteQuote || ""),
      ...(books as any[]).filter(b => (b as any).review).map((b: any) => b.review || ""),
    ].join(" ");

    const words = texts
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûüç\s'-]/g, " ")
      .split(/\s+/)
      .map(w => w.replace(/^[-']+|[-']+$/g, ""))
      .filter(w => w.length > 3 && !FR_STOP.has(w));

    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([word, count], i) => ({ word, count, color: CLOUD_COLORS[i % CLOUD_COLORS.length] }));
  }, [pastEntries, quotedBooks, books]);

  const maxCount = wordFrequencies[0]?.count || 1;
  const getSize = (count: number) => {
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.round(13 + ratio * 40);
  };

  // ── Export PDF notes ──────────────────────────────────────────────────
  const exportNotesPDF = async () => {
    if (pastEntries.length === 0) { toast({ title: "Aucune note à exporter" }); return; }
    setIsExportingNotes(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new (jsPDF as any)();
      let y = 20;

      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text("Mes notes de lecture", 20, y); y += 10;
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")}`, 20, y); y += 15;

      notesByBook.forEach(([bookTitle, entries]: [string, any[]]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(bookTitle, 20, y); y += 10;

        entries.forEach((entry: any) => {
          if (y > 265) { doc.addPage(); y = 20; }
          const date = entry.date?.toDate?.()?.toLocaleDateString("fr-FR") || "";
          const meta = [date, entry.tag, entry.humeur].filter(Boolean).join("  ·  ");
          doc.setFontSize(8); doc.setFont("helvetica", "normal");
          doc.setTextColor(150, 120, 90);
          doc.text(meta, 22, y); y += 6;

          doc.setFontSize(10); doc.setFont("helvetica", "italic");
          doc.setTextColor(40, 30, 20);
          const lines = doc.splitTextToSize(`"${entry.content}"`, 160);
          doc.text(lines, 22, y);
          y += lines.length * 5.5 + 8;
        });
        y += 4;
      });

      doc.save("mes-notes-de-lecture.pdf");
      toast({ title: "PDF téléchargé ✓" });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur export PDF" });
    } finally {
      setIsExportingNotes(false);
    }
  };

  // ── Export PDF nuage ──────────────────────────────────────────────────
  const exportWordCloudPDF = async () => {
    if (!wordCloudRef.current || wordFrequencies.length === 0) {
      toast({ title: "Pas encore assez de texte pour le nuage" }); return;
    }
    setIsExportingCloud(true);
    try {
      const { toPng }  = await import("html-to-image");
      const { jsPDF }  = await import("jspdf");
      const imgData    = await toPng(wordCloudRef.current, { pixelRatio: 2 });
      const doc        = new (jsPDF as any)("landscape", "mm", "a4");

      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text("Mon Nuage des Mots", 20, 18);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")} — ${wordFrequencies.length} mots`, 20, 26);
      doc.addImage(imgData, "PNG", 15, 32, 265, 165);
      doc.save("nuage-des-mots-lectoria.pdf");
      toast({ title: "PDF téléchargé ✓" });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur export PDF" });
    } finally {
      setIsExportingCloud(false);
    }
  };

  // ── Enregistrer une note ──────────────────────────────────────────────
  const handleSaveNote = (type: "lecture" | "écoute") => {
    if (!db || !user) return;
    const content = type === "lecture" ? readingNotes : listeningNotes;
    const data: any = { type, title: title || "Sans titre", content, date: serverTimestamp() };
    if (noteTag)    data.tag    = noteTag;
    if (noteHumeur) data.humeur = noteHumeur;

    const journalRef = collection(db, "users", user.uid, "journal");
    addDoc(journalRef, data)
      .then(() => {
        toast({ title: "Note enregistrée", description: `Votre réflexion de ${type} a été ajoutée à votre journal.` });
        if (type === "lecture") setReadingNotes(""); else setListeningNotes("");
        setTitle(""); setNoteTag(""); setNoteHumeur("");
      })
      .catch(async e => {
        const permissionError = new FirestorePermissionError({ path: journalRef.path, operation: "create", requestResourceData: data });
        errorEmitter.emit("permission-error", permissionError);
      });
  };

  const shareBook = (book: any) => {
    const text = `${cleanBookTitle(book.title)}, par ${cleanAuthorName(book.author)} — une pépite de ma bibliothèque Lectoria.`;
    shareText(book.title, text, () => toast({ title: "Copié", description: "Le texte de partage a été copié dans le presse-papier." }));
  };
  const shareQuote = (book: any) => {
    const text = `"${book.favoriteQuote}"\n— ${cleanBookTitle(book.title)}, ${cleanAuthorName(book.author)}`;
    shareText(book.title, text, () => toast({ title: "Copié", description: "La citation a été copiée dans le presse-papier." }));
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="pt-8">
        <h1 className={cn("text-3xl sm:text-4xl md:text-5xl font-headline italic tracking-tight", isAmbientDark && "text-[#F5F1E8]")}>Journal de bord</h1>
        <p className={cn("italic font-medium", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>Capturez l'essence de vos voyages littéraires.</p>
      </header>

      {/* ── Recommandations ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-2xl font-headline italic flex items-center gap-2 md:gap-3">
            <Heart className="h-4 w-4 md:h-6 md:w-6 text-primary/40" /> Mes Recommandations
          </h2>
        </div>
        {recommendedBooks.length > 0 ? (
          <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
            {recommendedBooks.map((book: any) => {
              const rank = RANKS[book.plumeRank as keyof typeof RANKS];
              return (
                <Card key={book.id} className="glass-card min-w-[220px] border-none shadow-sm shrink-0">
                  <CardContent className="p-5 space-y-3">
                    <Link href={`/book/${book.id}`} className="flex gap-3 items-start group">
                      <div className="relative h-24 w-16 shrink-0 rounded-lg overflow-hidden shadow-sm">
                        <BookCover src={book.cover} alt={book.title} className="object-cover" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <h4 className="font-headline italic text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{cleanBookTitle(book.title)}</h4>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 line-clamp-1">{cleanAuthorName(book.author)}</p>
                        {rank && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-70">
                            <rank.icon className={cn("h-3 w-3", rank.color)} /> {rank.label}
                          </span>
                        )}
                      </div>
                    </Link>
                    <Button onClick={() => shareBook(book)} variant="outline" size="sm" className="w-full rounded-xl text-[10px] font-bold uppercase tracking-widest border-primary/10 h-9">
                      <Share2 className="h-3 w-3 mr-2" /> Partager
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="w-full py-10 text-center glass-card border-dashed border-primary/20 bg-white/20">
            <p className="italic text-muted-foreground text-sm">Attribuez une Palme à vos lectures pour les voir apparaître ici.</p>
          </div>
        )}
      </section>

      {/* ── Carnet de Citations ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-2xl font-headline italic flex items-center gap-2 md:gap-3">
            <Quote className="h-4 w-4 md:h-6 md:w-6 text-primary/40" /> Carnet de Citations
          </h2>
          {quotedBooks.length > 0 && (
            <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic">
              <Link href="/journal/citations">Voir tout <Plus className="ml-2 h-4 w-4" /></Link>
            </Button>
          )}
        </div>
        {quotedBooks.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {quotedBooks.slice(0, 4).map((book: any) => (
              <Card key={book.id} className="glass-card border-none shadow-sm bg-white/60">
                <CardContent className="p-6 space-y-3">
                  <Link href={`/book/${book.id}`}>
                    <p className="text-sm italic leading-relaxed hover:text-primary transition-colors">"{book.favoriteQuote}"</p>
                  </Link>
                  <div className="flex items-center justify-between">
                    <Link href={`/book/${book.id}`} className="text-[10px] font-bold uppercase tracking-widest opacity-50 line-clamp-1 hover:opacity-100 transition-opacity">
                      {cleanBookTitle(book.title)} — {cleanAuthorName(book.author)}
                    </Link>
                    <button onClick={() => shareQuote(book)} className="shrink-0 h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary hover:scale-110 transition-transform" title="Partager la citation">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="w-full py-10 text-center glass-card border-dashed border-primary/20 bg-white/20">
            <p className="italic text-muted-foreground text-sm">Ajoutez une citation favorite depuis la fiche d'un livre pour l'épingler ici.</p>
          </div>
        )}
      </section>

      {/* ── Admin ── */}
      {adminMode && (
        <Card className="glass-card border-2 border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="p-8 border-b border-primary/5">
            <CardTitle className="font-headline text-2xl italic flex items-center gap-3">
              <Tags className="h-6 w-6 text-primary" /> Gérer genres, tropes & thèmes
            </CardTitle>
            <CardDescription className="italic">Ajoute ou masque des entrées pour toute l'app. Masquer une entrée ne retire jamais le tag des livres qui l'ont déjà.</CardDescription>
          </CardHeader>
          <CardContent className="p-8"><TaxonomyEditor /></CardContent>
        </Card>
      )}

      {/* ── Mon Avis & Réflexions ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-2xl font-headline italic flex items-center gap-2 md:gap-3">
            <Sparkles className="h-4 w-4 md:h-6 md:w-6 text-primary/40" /> Mon Avis & Réflexions
          </h2>
          <div className="flex items-center gap-2">
            {books.filter((b: any) => (b as any).review).length > 0 && (
              <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic">
                <Link href="/journal/avis">Voir tout <Plus className="ml-2 h-4 w-4" /></Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic">
              <Link href="/library">Rédiger un avis <Plus className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
          {books.filter((b: any) => (b as any).review).slice(0, 6).map((book: any) => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className="glass-card min-w-[300px] border-none shadow-sm hover:shadow-md transition-shadow group shrink-0">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="relative h-20 w-14 shrink-0 rounded-lg overflow-hidden shadow-sm">
                      <BookCover src={book.cover} alt={book.title} className="object-cover" />
                    </div>
                    <div className="space-y-1 overflow-hidden">
                      <h4 className="font-headline italic text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {cleanBookTitle(book.title)}{(book as any).volume ? ` — ${(book as any).volume}` : ""}
                      </h4>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 line-clamp-1">{cleanAuthorName(book.author)}</p>
                      <div className="pt-1">
                        <StarRating rating={book.rating || 0} size={12} gap="gap-1" colorClass="text-copper fill-copper" emptyClass="text-muted-foreground/20" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm italic text-muted-foreground line-clamp-3 leading-relaxed">"{(book as any).review}"</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {books.filter((b: any) => (b as any).review).length === 0 && (
            <div className="w-full py-12 text-center glass-card border-dashed border-primary/20 bg-white/20">
              <p className="italic text-muted-foreground">Aucun avis de lecture rédigé pour le moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Notes + Nuage : navigation vers pages dédiées ── */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 md:gap-3">
          <MessageCircle className="h-4 w-4 md:h-6 md:w-6 text-primary/40" />
          <h2 className="text-base md:text-2xl font-headline italic">Notes au fil de l'eau</h2>
        </div>
        <div className="flex gap-3">
          <Link href="/journal/notes" className="flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-2xl bg-primary text-white font-headline italic shadow-md hover:bg-primary/90 transition-colors text-sm">
            <BookMarked className="h-5 w-5" /> Mes notes de lecture
          </Link>
          <Link href="/journal/nuage" className="flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 rounded-2xl bg-white/60 glass-card border-none text-primary/70 font-headline italic shadow-sm hover:bg-white/80 transition-colors text-sm">
            <Cloud className="h-5 w-5" /> Nuage des mots
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Composant carte de note ──────────────────────────────────────────────
function NoteCard({ entry }: { entry: any }) {
  const tag = NOTE_TAGS.find(t => t.id === entry.tag);
  return (
    <Card className="bg-white/40 border-none shadow-sm hover:bg-white/60 transition-colors">
      <CardContent className="p-5 flex gap-4">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm text-lg",
          entry.humeur ? "" : entry.type === "lecture" ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-400"
        )}>
          {entry.humeur || (entry.type === "lecture" ? <BookOpen className="h-5 w-5" /> : <Headset className="h-5 w-5" />)}
        </div>
        <div className="space-y-1.5 w-full min-w-0">
          <div className="flex justify-between items-start flex-wrap gap-1">
            <h4 className="font-headline italic text-base leading-tight">{entry.title}</h4>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-40 shrink-0">
              {entry.date?.toDate ? entry.date.toDate().toLocaleDateString("fr-FR") : "Maintenant"}
            </span>
          </div>
          {tag && (
            <span className="inline-block text-[9px] font-bold uppercase tracking-widest bg-primary/5 text-primary/60 px-2 py-0.5 rounded-full border border-primary/15">
              {tag.emoji} {tag.label}
            </span>
          )}
          <p className="text-sm text-muted-foreground italic leading-relaxed">"{entry.content}"</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyNotes() {
  return (
    <div className="py-12 text-center glass-card rounded-2xl border-dashed border-primary/20 bg-white/20">
      <p className="italic text-muted-foreground text-sm">Aucune note enregistrée pour le moment.</p>
    </div>
  );
}