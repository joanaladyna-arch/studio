"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Check, X, Sparkles, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tableau admin de validation des actualités détectées automatiquement.
 * - Affiche toutes les entrées de `actualitesPending`
 * - Cases à cocher pour sélection multiple
 * - Clic sur la ligne → développe le contenu complet
 * - Publier (✓) → copie dans `actualites` + supprime de `actualitesPending`
 * - Rejeter (✗) → supprime de `actualitesPending` sans publication
 * - Actions groupées : Publier sélection / Rejeter sélection / Tout publier
 */
export function AdminActualitesQueue() {
  const db = useFirestore();
  const { toast } = useToast();
  const [pending, setPending] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "actualitesPending"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        list.sort((a, b) => (b.detectedAt?.toMillis?.() || 0) - (a.detectedAt?.toMillis?.() || 0));
        setPending(list);
      })
      .catch((err) => { console.error("Load Pending Error:", err); setPending([]); });
  }, [db]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      selected.size === (pending || []).length
        ? new Set()
        : new Set((pending || []).map(p => p.id))
    );
  };

  const approveItems = async (ids: string[]) => {
    if (!db || ids.length === 0) return;
    setIsBusy(true);
    try {
      const batch = writeBatch(db);
      const items = (pending || []).filter(p => ids.includes(p.id));
      for (const item of items) {
        batch.set(doc(db, "actualites", item.id), {
          title:       item.title        || "",
          content:     item.content      || "",
          authorName:  item.authorName   || "",
          authorSlug:  item.authorSlug   || "",
          publisherName: item.publisherName || "",
          cover:       item.cover        || "",
          isRelease:   Boolean(item.isRelease),
          releaseDate: item.releaseDate  || "",
          publishedAt: serverTimestamp(),
          updatedAt:   serverTimestamp(),
        });
        batch.delete(doc(db, "actualitesPending", item.id));
      }
      await batch.commit();
      setPending(prev => (prev || []).filter(p => !ids.includes(p.id)));
      setSelected(new Set());
      toast({ title: `${ids.length} actualité(s) publiée(s) ✓` });
    } catch (err) {
      console.error("Approve Error:", err);
      toast({ variant: "destructive", title: "Erreur de publication", description: (err as any)?.message });
    } finally {
      setIsBusy(false);
    }
  };

  const rejectItems = async (ids: string[]) => {
    if (!db || ids.length === 0) return;
    if (!confirm(`Rejeter ${ids.length} actualité(s) ? Elles seront supprimées définitivement.`)) return;
    setIsBusy(true);
    try {
      const batch = writeBatch(db);
      for (const id of ids) batch.delete(doc(db, "actualitesPending", id));
      await batch.commit();
      setPending(prev => (prev || []).filter(p => !ids.includes(p.id)));
      setSelected(new Set());
      toast({ title: `${ids.length} actualité(s) rejetée(s)` });
    } catch (err) {
      console.error("Reject Error:", err);
      toast({ variant: "destructive", title: "Erreur", description: (err as any)?.message });
    } finally {
      setIsBusy(false);
    }
  };

  // ── États de chargement / vide ─────────────────────────────────────────
  if (pending === null) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-30" /></div>;
  }

  if (pending.length === 0) {
    return (
      <div className="py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 mx-auto text-primary/20" />
        <p className="text-sm italic opacity-50">Aucune actualité en attente — la file est vide.</p>
      </div>
    );
  }

  const allIds = pending.map(p => p.id);

  return (
    <div className="space-y-4">

      {/* ── Barre d'actions ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm italic text-primary/50">
          {selected.size > 0
            ? `${selected.size} sélectionnée(s) sur ${pending.length}`
            : `${pending.length} en attente de validation`}
        </p>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <Button
                onClick={() => approveItems(Array.from(selected))}
                disabled={isBusy}
                className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-headline italic shadow-sm"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                Publier ({selected.size})
              </Button>
              <Button
                onClick={() => rejectItems(Array.from(selected))}
                disabled={isBusy}
                variant="outline"
                className="h-9 px-4 rounded-xl border-destructive/30 text-destructive text-sm font-headline italic hover:bg-destructive/5"
              >
                <X className="h-4 w-4 mr-1.5" /> Rejeter ({selected.size})
              </Button>
            </>
          )}
          <Button
            onClick={() => approveItems(allIds)}
            disabled={isBusy}
            variant="outline"
            className="h-9 px-4 rounded-xl text-sm font-headline italic border-primary/20 bg-white/40"
          >
            <Check className="h-4 w-4 mr-1.5" /> Tout publier
          </Button>
        </div>
      </div>

      {/* ── Tableau ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/5 overflow-hidden bg-white/40 shadow-inner">
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader className="bg-white/70 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={selected.size === pending.length && pending.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-bold italic">Titre</TableHead>
                <TableHead className="font-bold italic hidden sm:table-cell">Auteur / Éditeur</TableHead>
                <TableHead className="font-bold italic w-20 hidden md:table-cell">Type</TableHead>
                <TableHead className="font-bold italic w-24 hidden lg:table-cell">Date</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((item) => {
                const isExp = expanded === item.id;
                const dateLabel = item.detectedAt?.toDate?.()
                  ?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
                  ?? '—';

                return [
                  // ── Ligne principale ──────────────────────────────────
                  <TableRow
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      isExp ? "bg-primary/5" : "hover:bg-primary/3 cursor-pointer"
                    )}
                  >
                    {/* Case à cocher */}
                    <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>

                    {/* Couverture */}
                    <TableCell onClick={() => setExpanded(isExp ? null : item.id)}>
                      {item.cover ? (
                        <img src={item.cover} alt="" className="h-12 w-8 object-cover rounded-lg shadow-sm" />
                      ) : (
                        <div className="h-12 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                          <Newspaper className="h-4 w-4 text-primary/20" />
                        </div>
                      )}
                    </TableCell>

                    {/* Titre */}
                    <TableCell
                      className="font-headline italic max-w-[180px]"
                      onClick={() => setExpanded(isExp ? null : item.id)}
                    >
                      <span className="line-clamp-2 leading-tight">{item.title}</span>
                    </TableCell>

                    {/* Auteur / Éditeur */}
                    <TableCell
                      className="text-xs opacity-55 hidden sm:table-cell max-w-[120px] truncate"
                      onClick={() => setExpanded(isExp ? null : item.id)}
                    >
                      {item.authorName || item.publisherName || '—'}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="hidden md:table-cell" onClick={() => setExpanded(isExp ? null : item.id)}>
                      {item.isRelease ? (
                        <span className="text-[10px] bg-rose/10 text-rose px-2 py-1 rounded-full font-bold whitespace-nowrap">📅 Sortie</span>
                      ) : (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold whitespace-nowrap">📰 Actu</span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell
                      className="text-xs opacity-40 hidden lg:table-cell"
                      onClick={() => setExpanded(isExp ? null : item.id)}
                    >
                      {dateLabel}
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5 justify-end pr-2">
                        <button
                          onClick={() => approveItems([item.id])}
                          disabled={isBusy}
                          title="Publier"
                          className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40 shadow-sm"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => rejectItems([item.id])}
                          disabled={isBusy}
                          title="Rejeter"
                          className="h-8 w-8 rounded-full bg-white text-destructive flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40 shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setExpanded(isExp ? null : item.id)}
                          title={isExp ? "Réduire" : "Lire le contenu"}
                          className="h-8 w-8 rounded-full bg-white text-primary/40 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                        >
                          {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>,

                  // ── Ligne développée (contenu complet) ───────────────
                  isExp && (
                    <TableRow key={`${item.id}-exp`} className="bg-primary/3 hover:bg-primary/3">
                      <TableCell colSpan={7} className="pt-0 pb-4 pl-10 pr-6">
                        <div className="p-5 rounded-2xl bg-white/70 space-y-3 shadow-inner">
                          {item.isRelease && item.releaseDate && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose/70">
                              📅 Sortie prévue le {new Date(`${item.releaseDate}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                          {item.authorName && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/50">{item.authorName}</p>
                          )}
                          <p className="text-sm italic leading-relaxed whitespace-pre-line text-muted-foreground">
                            {item.content || '(aucun contenu)'}
                          </p>
                          {item.cover && (
                            <img src={item.cover} alt="" className="h-24 object-contain rounded-lg mt-2" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                ];
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
