"use client";

import { useState, useMemo, useRef } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, deleteDoc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Headset, Save, History, FileDown, LayoutList, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";

const NOTE_TAGS = [
  { id: "citation",   label: "Citation",   emoji: "💬" },
  { id: "réflexion", label: "Réflexion",  emoji: "💭" },
  { id: "personnage", label: "Personnage", emoji: "👤" },
  { id: "intrigue",  label: "Intrigue",   emoji: "🔍" },
  { id: "émotion",   label: "Émotion",    emoji: "💫" },
];

const NOTE_HUMEURS = [
  { id: "😍", label: "Coup de cœur" },
  { id: "😤", label: "Frustration"  },
  { id: "😭", label: "Émotion"      },
  { id: "😱", label: "Surprise"     },
];

export default function NotesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();

  const [readingNotes, setReadingNotes]     = useState("");
  const [listeningNotes, setListeningNotes] = useState("");
  const [title, setTitle]                   = useState("");
  const [noteTag, setNoteTag]               = useState("");
  const [noteHumeur, setNoteHumeur]         = useState("");
  const [viewByBook, setViewByBook]         = useState(false);
  const [isExporting, setIsExporting]       = useState(false);

  // Toutes les notes (sans limit)
  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc"));
  }, [db, user]);
  const { data: entries = [] } = useCollection(entriesQuery);

  // Livres en cours / PAL pour la liste déroulante
  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [] } = useCollection(booksQuery);

  const notableBooks = useMemo(() =>
    (books as any[])
      .filter(b => b.status === "progress" || b.status === "pal")
      .sort((a, b) => (a.status === "progress" ? -1 : 1) - (b.status === "progress" ? -1 : 1)),
    [books]
  );

  // Groupement par livre
  const notesByBook = useMemo(() => {
    const groups: Record<string, any[]> = {};
    entries.forEach((e: any) => {
      const key = e.title || "Sans livre";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups);
  }, [entries]);

  // ── Enregistrer ────────────────────────────────────────────────────────
  const handleSave = (type: "lecture" | "écoute") => {
    if (!db || !user) return;
    const content = type === "lecture" ? readingNotes : listeningNotes;
    const data: any = { type, title: title || "Sans titre", content, date: serverTimestamp() };
    if (noteTag)    data.tag    = noteTag;
    if (noteHumeur) data.humeur = noteHumeur;

    const journalRef = collection(db, "users", user.uid, "journal");
    addDoc(journalRef, data)
      .then(() => {
        toast({ title: "Note enregistrée" });
        if (type === "lecture") setReadingNotes(""); else setListeningNotes("");
        setTitle(""); setNoteTag(""); setNoteHumeur("");
      })
      .catch(async e => {
        const err = new FirestorePermissionError({ path: journalRef.path, operation: "create", requestResourceData: data });
        errorEmitter.emit("permission-error", err);
      });
  };

  // ── Supprimer ──────────────────────────────────────────────────────────
  const handleDelete = async (noteId: string) => {
    if (!db || !user || !noteId) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "journal", noteId));
      toast({ title: "Note supprimée" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur de suppression" });
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (entries.length === 0) { toast({ title: "Aucune note à exporter" }); return; }
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new (jsPDF as any)();
      let y = 20;

      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text("Mes notes de lecture", 20, y); y += 10;
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")} — ${entries.length} notes`, 20, y); y += 15;

      notesByBook.forEach(([bookTitle, bookEntries]: [string, any[]]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(40, 30, 20);
        doc.text(bookTitle, 20, y); y += 10;

        bookEntries.forEach((entry: any) => {
          if (y > 265) { doc.addPage(); y = 20; }
          const date = entry.date?.toDate?.()?.toLocaleDateString("fr-FR") || "";
          const meta = [date, entry.tag, entry.humeur].filter(Boolean).join("  ·  ");
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 120, 90);
          doc.text(meta, 22, y); y += 6;
          doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(60, 45, 25);
          const lines = doc.splitTextToSize(`"${entry.content}"`, 160);
          doc.text(lines, 22, y); y += lines.length * 5.5 + 8;
        });
        y += 4;
      });

      doc.save("mes-notes-de-lecture.pdf");
      toast({ title: "PDF téléchargé ✓" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur export PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Journal
        </Link>
      </div>
      <header>
        <h1 className={cn("text-3xl sm:text-4xl font-headline italic", isAmbientDark && "text-[#F5F1E8]")}>
          Mes notes de lecture
        </h1>
        <p className={cn("italic font-medium text-sm mt-1", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>
          {entries.length} note{entries.length > 1 ? "s" : ""} enregistrée{entries.length > 1 ? "s" : ""}
        </p>
      </header>

      {/* Formulaire */}
      <Tabs defaultValue="reading" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-14 bg-white/40 p-1.5 rounded-2xl">
          <TabsTrigger value="reading" className="rounded-xl flex gap-2 font-headline italic">
            <BookOpen className="h-4 w-4" /> Lecture
          </TabsTrigger>
          <TabsTrigger value="listening" className="rounded-xl flex gap-2 font-headline italic">
            <Headset className="h-4 w-4" /> Écoute
          </TabsTrigger>
        </TabsList>

        <Card className="glass-card shadow-lg border-none bg-white/60">
          <CardHeader>
            <Select value={title} onValueChange={setTitle}>
              <SelectTrigger className="text-2xl font-headline italic border-none bg-transparent h-auto px-0 focus:ring-0 [&>span]:truncate">
                <SelectValue placeholder="Choisir un livre..." />
              </SelectTrigger>
              <SelectContent>
                {notableBooks.length > 0 ? (
                  notableBooks.map((b: any) => (
                    <SelectItem key={b.id} value={`${cleanBookTitle(b.title)}${b.author ? " — " + cleanAuthorName(b.author) : ""}`}>
                      <span className="italic">{b.status === "progress" ? "📖 " : "📚 "}{cleanBookTitle(b.title)}</span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm italic opacity-50 text-center">Aucun livre en cours ou en PAL.</div>
                )}
              </SelectContent>
            </Select>
            <CardDescription className="italic">Partagez votre réflexion du moment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TabsContent value="reading" className="m-0">
              <Textarea placeholder="Quelles émotions ce passage a-t-il éveillé en vous ?"
                className="min-h-[160px] bg-white/40 border-none rounded-3xl p-6 italic shadow-inner resize-none"
                value={readingNotes} onChange={e => setReadingNotes(e.target.value)} />
            </TabsContent>
            <TabsContent value="listening" className="m-0">
              <Textarea placeholder="Quelles notes, quels arguments retenez-vous ?"
                className="min-h-[160px] bg-white/40 border-none rounded-3xl p-6 italic shadow-inner resize-none"
                value={listeningNotes} onChange={e => setListeningNotes(e.target.value)} />
            </TabsContent>

            {/* Tags */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Catégorie</p>
              <div className="flex flex-wrap gap-2">
                {NOTE_TAGS.map(tag => (
                  <button key={tag.id} onClick={() => setNoteTag(noteTag === tag.id ? "" : tag.id)}
                    className={cn("px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold border transition-all",
                      noteTag === tag.id ? "bg-primary text-white border-primary shadow-sm" : "bg-white/40 border-primary/20 text-primary/60 hover:border-primary/40")}>
                    {tag.emoji} {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Humeur */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Humeur</p>
              <div className="flex gap-3">
                {NOTE_HUMEURS.map(h => (
                  <button key={h.id} onClick={() => setNoteHumeur(noteHumeur === h.id ? "" : h.id)} title={h.label}
                    className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-full text-lg sm:text-xl transition-all",
                      noteHumeur === h.id ? "bg-primary/15 scale-110 shadow-sm ring-2 ring-primary/30" : "opacity-50 hover:opacity-100 hover:scale-110")}>
                    {h.id}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => handleSave(readingNotes ? "lecture" : "écoute")}
              disabled={(!readingNotes && !listeningNotes) || !user}
              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 font-headline italic text-xl">
              <Save className="mr-3 h-5 w-5" /> Enregistrer la note
            </Button>
          </CardContent>
        </Card>
      </Tabs>

      {/* Historique */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-headline italic flex items-center gap-2 text-muted-foreground/60">
            <History className="h-5 w-5" /> Historique ({entries.length})
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewByBook(v => !v)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                viewByBook ? "bg-primary text-white border-primary" : "bg-white/40 border-primary/20 text-primary/60 hover:border-primary/40")}>
              <LayoutList className="h-3.5 w-3.5" /> Par livre
            </button>
            <button onClick={exportPDF} disabled={isExporting || entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/20 bg-white/40 text-primary/60 hover:bg-primary/5 transition-all disabled:opacity-40">
              <FileDown className="h-3.5 w-3.5" /> {isExporting ? "Export…" : "PDF"}
            </button>
          </div>
        </div>

        {/* Vue par livre */}
        {viewByBook ? (
          <div className="space-y-6">
            {notesByBook.length === 0 ? <EmptyState /> : notesByBook.map(([bookTitle, bookEntries]) => (
              <div key={bookTitle} className="space-y-3">
                <h4 className="font-headline italic text-lg text-primary/80 border-b border-primary/10 pb-2">{bookTitle}</h4>
                <div className="grid gap-3 pl-2">
                  {(bookEntries as any[]).map((entry: any) => (
                    <NoteCard key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {entries.length === 0 ? <EmptyState /> :
              (entries as any[]).map((entry: any) => (
                <NoteCard key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ entry, onDelete }: { entry: any; onDelete: () => void }) {
  const tag = NOTE_TAGS.find(t => t.id === entry.tag);
  return (
    <Card className="bg-white/40 border-none shadow-sm hover:bg-white/60 transition-colors relative group">
      {/* Bouton supprimer */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive hover:bg-red-50 transition-all z-10"
        title="Supprimer cette note"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="p-4 sm:p-5 flex gap-3 sm:gap-4 pr-10">
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

function EmptyState() {
  return (
    <div className="py-16 text-center glass-card rounded-2xl border-dashed border-primary/20 bg-white/20">
      <BookOpen className="h-10 w-10 mx-auto text-primary/20 mb-4" />
      <p className="italic text-muted-foreground">Aucune note enregistrée pour le moment.</p>
    </div>
  );
}
