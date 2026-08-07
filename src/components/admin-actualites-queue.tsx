"use client";

import { useEffect, useRef, useState } from "react";
import { useFirestore, useStorage, useUser } from "@/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Check, X, Sparkles, ChevronDown, ChevronUp, Newspaper, Upload } from "lucide-react";
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
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [pending, setPending] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [coverDrafts, setCoverDrafts] = useState<Record<string, string>>({});
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [contentDrafts, setContentDrafts] = useState<Record<string, string>>({});
  const [coverFileTargetId, setCoverFileTargetId] = useState<string | null>(null);

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
          isTrending:  Boolean(item.isTrending),
          genres:      Array.isArray(item.genres) ? item.genres : [],
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

  // ── Couverture ajoutée manuellement avant validation ──────────────────
  // Les sources automatiques (capture d'écran notamment) ne fournissent
  // jamais de couverture — l'administratrice l'ajoute ici, sauvegardée
  // directement sur le brouillon en attente (pas besoin de republier pour
  // que le choix soit conservé).
  const saveCoverUrl = async (id: string, url: string) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "actualitesPending", id), { cover: url }, { merge: true });
      setPending(prev => (prev || []).map(p => (p.id === id ? { ...p, cover: url } : p)));
      toast({ title: "Couverture enregistrée" });
    } catch (err) {
      console.error("Save Cover Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    }
  };

  // ── Titre / date modifiables avant validation ──────────────────────────
  // Utile quand une source détecte un titre dans une autre langue que la
  // VF, ou une date approximative — corrigeable ici sans devoir republier.
  const saveTitle = async (id: string, title: string) => {
    if (!db || !title.trim()) return;
    try {
      await setDoc(doc(db, "actualitesPending", id), { title: title.trim() }, { merge: true });
      setPending(prev => (prev || []).map(p => (p.id === id ? { ...p, title: title.trim() } : p)));
      toast({ title: "Titre enregistré" });
    } catch (err) {
      console.error("Save Title Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    }
  };

  const saveDate = async (id: string, releaseDate: string) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "actualitesPending", id), { releaseDate, isRelease: Boolean(releaseDate) }, { merge: true });
      setPending(prev => (prev || []).map(p => (p.id === id ? { ...p, releaseDate, isRelease: Boolean(releaseDate) } : p)));
      toast({ title: "Date enregistrée" });
    } catch (err) {
      console.error("Save Date Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    }
  };

  const saveContent = async (id: string, content: string) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "actualitesPending", id), { content }, { merge: true });
      setPending(prev => (prev || []).map(p => (p.id === id ? { ...p, content } : p)));
      toast({ title: "Contenu enregistré" });
    } catch (err) {
      console.error("Save Content Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    }
  };

  const openCoverFilePicker = (id: string) => {
    setCoverFileTargetId(id);
    coverFileInputRef.current?.click();
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = coverFileTargetId;
    if (!file || !storage || !user || !targetId) return;
    setUploadingCoverId(targetId);
    try {
      const path = `actualites/covers/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await saveCoverUrl(targetId, url);
      setCoverDrafts(prev => ({ ...prev, [targetId]: url }));
    } catch (err) {
      console.error("Cover Upload Error:", err);
      toast({ variant: "destructive", title: "Erreur d'importation", description: "L'image n'a pas pu être envoyée." });
    } finally {
      setUploadingCoverId(null);
      setCoverFileTargetId(null);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
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
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverFileChange}
        className="hidden"
      />

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
                      ) : item.isTrending ? (
                        <span className="text-[10px] bg-amber-500/10 text-amber-700 px-2 py-1 rounded-full font-bold whitespace-nowrap">🔥 Tendance</span>
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
                          {/* ── Titre et date : modifiables (ex: titre VO vs VF, date approximative) ── */}
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Titre</p>
                              <Input
                                value={titleDrafts[item.id] ?? item.title ?? ""}
                                onChange={(e) => setTitleDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                onBlur={(e) => {
                                  const title = e.target.value.trim();
                                  if (title && title !== (item.title || "")) saveTitle(item.id, title);
                                }}
                                className="h-10 text-sm bg-white/60 rounded-lg border-none shadow-inner"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Date de sortie</p>
                              <Input
                                type="date"
                                value={dateDrafts[item.id] ?? item.releaseDate ?? ""}
                                onChange={(e) => setDateDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                onBlur={(e) => {
                                  const releaseDate = e.target.value.trim();
                                  if (releaseDate !== (item.releaseDate || "")) saveDate(item.id, releaseDate);
                                }}
                                className="h-10 text-sm bg-white/60 rounded-lg border-none shadow-inner"
                              />
                            </div>
                          </div>
                          {item.authorName && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/50">{item.authorName}</p>
                          )}
                          {Array.isArray(item.genres) && item.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {item.genres.map((g: string) => (
                                <span key={g} className="text-[9px] bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full font-bold">{g}</span>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Contenu</p>
                            <Textarea
                              value={contentDrafts[item.id] ?? item.content ?? ""}
                              onChange={(e) => setContentDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={(e) => {
                                const content = e.target.value.trim();
                                if (content !== (item.content || "")) saveContent(item.id, content);
                              }}
                              placeholder="(aucun contenu)"
                              className="min-h-24 text-sm italic bg-white/60 rounded-lg border-none shadow-inner leading-relaxed"
                            />
                          </div>

                          {/* ── Couverture : ajoutée/modifiée manuellement avant validation ── */}
                          <div className="pt-2 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Couverture</p>
                            <div className="flex items-start gap-3">
                              {item.cover ? (
                                <img src={item.cover} alt="" className="h-24 w-16 object-cover rounded-lg shadow-sm shrink-0" />
                              ) : (
                                <div className="h-24 w-16 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                  <Newspaper className="h-5 w-5 text-primary/20" />
                                </div>
                              )}
                              <div className="flex-1 space-y-2 min-w-0">
                                <Input
                                  value={coverDrafts[item.id] ?? item.cover ?? ""}
                                  onChange={(e) => setCoverDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onBlur={(e) => {
                                    const url = e.target.value.trim();
                                    if (url !== (item.cover || "")) saveCoverUrl(item.id, url);
                                  }}
                                  placeholder="URL de l'image"
                                  className="h-10 text-xs bg-white/60 rounded-lg border-none shadow-inner"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={uploadingCoverId === item.id}
                                  onClick={() => openCoverFilePicker(item.id)}
                                  className="h-8 px-3 rounded-lg text-[11px] italic font-headline border-primary/20"
                                >
                                  {uploadingCoverId === item.id
                                    ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                    : <Upload className="mr-1.5 h-3 w-3" />}
                                  Téléverser une image
                                </Button>
                              </div>
                            </div>
                          </div>
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
