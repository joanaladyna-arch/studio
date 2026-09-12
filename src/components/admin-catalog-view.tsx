"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { MasterBookEditor } from "@/components/master-book-editor";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cleanDescriptionHtml, cn } from "@/lib/utils";
import { GENRES_LIST } from "@/app/library/page";
import { Library, Loader2, ChevronDown, AlertTriangle } from "lucide-react";

/**
 * Liste les anomalies d'une fiche partagée : champs vides ou résumé
 * encore pollué par du HTML brut (cas <br> non nettoyé). Sert à la fois
 * à décider si la fiche mérite le badge rouge, et à expliquer pourquoi
 * au survol/clic — toujours basé sur les mêmes règles que les outils de
 * nettoyage en masse, pour ne jamais afficher un problème déjà résolu
 * ailleurs.
 */
function getBookIssues(book: any): string[] {
  const issues: string[] = [];
  const desc = (book.description || "").toString();
  if (!desc.trim()) issues.push("Résumé manquant");
  else if (cleanDescriptionHtml(desc) !== desc) issues.push("HTML brut dans le résumé");
  if (!(book.cover || "").toString().trim()) issues.push("Couverture manquante");
  if (!Array.isArray(book.genres) || book.genres.length === 0) issues.push("Genres manquants");
  if (!(book.isbn13 || book.isbn || "").toString().trim()) issues.push("ISBN manquant");
  if (!(book.publisher || "").toString().trim()) issues.push("Éditeur manquant");
  return issues;
}

/**
 * Vue admin des fiches à compléter (masterBooks avec au moins une
 * anomalie détectée par getBookIssues), regroupées par genre. Calculée
 * en direct à chaque chargement à partir de l'état réel des champs —
 * dès qu'une fiche est complétée, elle ressort naturellement de cette
 * liste au prochain chargement, sans nettoyage manuel à faire.
 */
export function AdminCatalogView() {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [cache, setCache] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingBook, setEditingBook] = useState<any | null>(null);

  const load = async () => {
    if (!db || cache) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      setCache(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load Catalog Error:", err);
      setCache([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (next: boolean) => {
    setOpen(next);
    if (next) load();
  };

  const handleSaved = (saved: any) => {
    setCache((prev) => (prev ? prev.map((b) => (b.id === saved.id ? saved : b)) : prev));
  };

  const incompleteBooks = (cache || []).filter((b) => getBookIssues(b).length > 0);

  const groups: Record<string, any[]> = {};
  incompleteBooks.forEach((b) => {
    const genre = Array.isArray(b.genres) && b.genres[0] ? b.genres[0] : "Sans genre";
    if (!groups[genre]) groups[genre] = [];
    groups[genre].push(b);
  });
  const orderedGenreKeys = [...GENRES_LIST.filter((g) => groups[g]), ...Object.keys(groups).filter((g) => !GENRES_LIST.includes(g))];

  return (
    <Collapsible open={open} onOpenChange={handleToggle} className="rounded-[2rem] border-2 border-primary/10 bg-white/30">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-6 hover:bg-primary/5 transition-colors rounded-[2rem]">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <span className="font-headline italic text-2xl">Fiches à compléter (admin)</span>
          {cache && (
            <span className={cn("text-xs font-bold px-3 py-1 rounded-full", incompleteBooks.length > 0 ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
              {incompleteBooks.length} à corriger
            </span>
          )}
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin opacity-40" /> : <ChevronDown className={cn("h-5 w-5 text-primary/40 transition-transform", open && "rotate-180")} />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-6 pt-0 space-y-4">
        {orderedGenreKeys.map((genre) => {
          const books = groups[genre];
          return (
            <Collapsible key={genre} className="rounded-2xl bg-white/50">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3 hover:bg-primary/5 rounded-2xl transition-colors">
                <span className="italic font-headline text-lg">{genre}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-bold text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" /> {books.length}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-30" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="divide-y divide-primary/5 px-2">
                {books.map((b) => {
                  const issues = getBookIssues(b);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setEditingBook(b)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-primary/5 transition-colors text-left"
                    >
                      <div className="relative h-14 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-primary/5">
                        <BookCover src={b.cover} alt={b.title} className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-headline italic truncate text-sm">{b.title}</p>
                        <p className="text-xs opacity-50 truncate">{b.author}</p>
                        <p className="text-[10px] text-red-500 italic truncate">{issues.join(" · ")}</p>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {cache && incompleteBooks.length === 0 && (
          <p className="text-sm italic opacity-50 text-center py-6">Toutes les fiches sont complètes. ✨</p>
        )}
      </CollapsibleContent>

      <Dialog open={!!editingBook} onOpenChange={(o) => !o && setEditingBook(null)}>
        <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {editingBook && <MasterBookEditor book={editingBook} onClose={() => setEditingBook(null)} onSaved={(s) => { handleSaved(s); setEditingBook(null); }} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
