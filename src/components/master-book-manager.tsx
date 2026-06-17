
"use client";

import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/book-cover";
import { MasterBookEditor } from "@/components/master-book-editor";
import { AuthorEditor } from "@/components/author-editor";
import { BookDuplicatesManager } from "@/components/book-duplicates-manager";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Pencil, Plus, Loader2, BookPlus, UserCog, Copy } from "lucide-react";

/**
 * Outils admin de gestion du catalogue, affichés sur la Bibliothèque en
 * mode admin : créer une nouvelle fiche livre, chercher/éditer une fiche
 * existante, et éditer/fusionner les fiches auteur.
 */
export function MasterBookManager() {
  const db = useFirestore();
  const [cache, setCache] = useState<any[] | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [search, setSearch] = useState("");
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [showAuthorEditor, setShowAuthorEditor] = useState(false);
  const [showDuplicatesManager, setShowDuplicatesManager] = useState(false);

  const loadAll = async () => {
    if (!db || cache) return;
    setLoadingCache(true);
    try {
      const snap = await getDocs(collection(db, "masterBooks"));
      setCache(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load MasterBooks Error:", err);
      setCache([]);
    } finally {
      setLoadingCache(false);
    }
  };

  const results = (cache || []).filter((b) => {
    if (!search.trim()) return false;
    const q = search.toLowerCase().trim();
    const qDigits = search.replace(/[-\s]/g, "");
    return (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q) || (b.isbn13 || "").includes(qDigits);
  }).slice(0, 15);

  const handleSaved = (saved: any) => {
    setCache((prev) => {
      if (!prev) return prev;
      const exists = prev.some((b) => b.id === saved.id);
      return exists ? prev.map((b) => (b.id === saved.id ? saved : b)) : [saved, ...prev];
    });
  };

  return (
    <div className="rounded-[2rem] border-2 border-primary/20 bg-primary/5 p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-headline italic text-2xl flex items-center gap-3"><BookPlus className="h-6 w-6 text-primary" /> Catalogue (admin)</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowDuplicatesManager(true)} variant="outline" className="rounded-2xl h-11 px-4 border-primary/20 bg-white/40 text-primary italic font-headline text-sm">
            <Copy className="mr-2 h-4 w-4" /> Doublons
          </Button>
          <Button onClick={() => setShowAuthorEditor(true)} variant="outline" className="rounded-2xl h-11 px-4 border-primary/20 bg-white/40 text-primary italic font-headline text-sm">
            <UserCog className="mr-2 h-4 w-4" /> Éditer un auteur
          </Button>
          <Button onClick={() => setEditingBook({ id: null, isNew: true })} className="rounded-2xl h-11 px-4 bg-primary italic font-headline text-sm">
            <Plus className="mr-2 h-4 w-4" /> Nouvelle fiche
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
        <Input
          placeholder="Chercher une fiche par titre, auteur ou ISBN..."
          value={search}
          onFocus={loadAll}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 pl-14 italic bg-white/60 rounded-2xl border-none shadow-inner"
        />
        {loadingCache && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin opacity-40" />}
      </div>

      {search.trim() && (
        <div className="rounded-2xl border border-primary/5 bg-white/40 divide-y divide-primary/5 overflow-hidden">
          {results.length === 0 && !loadingCache && <p className="p-5 text-sm italic opacity-50 text-center">Aucune fiche pour "{search}".</p>}
          {results.map((b) => (
            <button key={b.id} onClick={() => setEditingBook(b)} className="w-full flex items-center gap-4 p-3 hover:bg-primary/5 transition-colors text-left">
              <div className="relative h-14 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-primary/5">
                <BookCover src={b.cover} alt={b.title} className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-headline italic truncate text-sm">{b.title}</p>
                <p className="text-xs opacity-50 truncate">{b.author}</p>
              </div>
              <Pencil className="h-4 w-4 opacity-30 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
        <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {editingBook && <MasterBookEditor book={editingBook} onClose={() => setEditingBook(null)} onSaved={(s) => { handleSaved(s); setEditingBook(null); }} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthorEditor} onOpenChange={setShowAuthorEditor}>
        <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {showAuthorEditor && <AuthorEditor onClose={() => setShowAuthorEditor(false)} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicatesManager} onOpenChange={setShowDuplicatesManager}>
        <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {showDuplicatesManager && <BookDuplicatesManager />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
