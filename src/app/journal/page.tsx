"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, orderBy, query } from "firebase/firestore";
import { Share2 } from "lucide-react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn, cleanBookTitle, cleanAuthorName, getBookQuotes } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { TaxonomyEditor } from "@/components/taxonomy-editor";
import { Tags } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { RANKS } from "@/app/library/page";
import { NotesView } from "@/components/journal/notes-view";
import { NuageView } from "@/components/journal/nuage-view";
import { CitationsView } from "@/components/journal/citations-view";
import { AvisView } from "@/components/journal/avis-view";

// ─── Partage natif ─────────────────────────────────────────────────────────
async function shareText(title: string, text: string, onFallback: () => void) {
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try { await (navigator as any).share({ title, text }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(text); onFallback(); } catch {}
}

// Un onglet = une page, comme dans la Bibliothèque. Le lien /journal?tab=avis
// ouvre directement le bon onglet (anciennes sous-pages redirigées ici).
const TABS = [
  { id: "notes", label: "Notes au fil de l'eau" },
  { id: "nuage", label: "Nuage des mots" },
  { id: "citations", label: "Carnet de citations" },
  { id: "avis", label: "Mes avis & réflexions" },
  { id: "reco", label: "Mes recommandations" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function JournalPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { adminMode } = useAdminMode();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabId>("notes");

  useEffect(() => {
    const t = params?.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, [params]);

  const entriesRef = useMemo(() => (db && user ? query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc")) : null), [db, user]);
  const { data: entries = [] } = useCollection(entriesRef);
  const booksRef = useMemo(() => (db && user ? collection(db, "users", user.uid, "books") : null), [db, user]);
  const { data: books = [] } = useCollection(booksRef);
  const savedRef = useMemo(() => (db && user ? collection(db, "users", user.uid, "savedQuotes") : null), [db, user]);
  const { data: saved = [] } = useCollection(savedRef);

  const recommendedBooks = useMemo(
    () => (books as any[]).filter((b) => !!b.plumeRank).sort((a, b) => (b.dateAdded?.toMillis?.() || 0) - (a.dateAdded?.toMillis?.() || 0)),
    [books]
  );
  const quotesCount = useMemo(
    () => (books as any[]).reduce((n, b) => n + getBookQuotes(b).length, 0) + (saved as any[]).length,
    [books, saved]
  );
  const reviewsCount = useMemo(() => (books as any[]).filter((b) => (b.review || "").toString().trim()).length, [books]);

  const counts: Record<TabId, number | null> = {
    notes: entries.length,
    nuage: null,
    citations: quotesCount,
    avis: reviewsCount,
    reco: recommendedBooks.length,
  };

  const shareBook = (book: any) => {
    const text = `${cleanBookTitle(book.title)}, par ${cleanAuthorName(book.author)} — une pépite de ma bibliothèque Lisoria.`;
    shareText(book.title, text, () => toast({ title: "Copié", description: "Le texte de partage a été copié dans le presse-papier." }));
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="pt-8 space-y-2">
        <h1 className={cn("text-3xl sm:text-4xl md:text-5xl font-headline italic tracking-tight", isAmbientDark && "text-[#F5F1E8]")}>Journal de bord</h1>
        <p className={cn("italic font-medium", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>Capturez l'essence de vos voyages littéraires.</p>
      </header>

      <div role="tablist" aria-label="Sections du journal" className="flex justify-center flex-wrap gap-1 sm:gap-2 border-b border-primary/10 max-w-5xl mx-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-3 font-headline italic text-[13px] sm:text-sm border-b-[3px] transition-colors",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-primary/50 hover:text-primary/80"
            )}
          >
            {t.label}
            {counts[t.id] !== null && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", tab === t.id ? "bg-primary text-white" : "bg-primary/10 text-primary/60")}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="max-w-4xl mx-auto">
        {tab === "notes" && <NotesView embedded />}
        {tab === "nuage" && <NuageView embedded />}
        {tab === "citations" && <CitationsView embedded />}
        {tab === "avis" && <AvisView />}
        {tab === "reco" && (
          recommendedBooks.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {recommendedBooks.map((book: any) => {
                const rank = RANKS[book.plumeRank as keyof typeof RANKS];
                return (
                  <Card key={book.id} className="glass-card border-none shadow-sm">
                    <CardContent className="p-5 space-y-3">
                      <Link href={`/book/${book.id}`} className="flex gap-3 items-start group">
                        <div className="relative h-24 w-16 shrink-0 rounded-lg overflow-hidden shadow-sm">
                          <BookCover src={book.cover} alt={book.title} className="object-cover" />
                        </div>
                        <div className="space-y-1 overflow-hidden">
                          <h4 className="font-headline italic text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">{cleanBookTitle(book.title)}</h4>
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
          )
        )}
      </section>

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
    </div>
  );
}
