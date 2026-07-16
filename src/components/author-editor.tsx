"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFirestore, useStorage, useUser } from "@/firebase";
import { collection, doc, getDocs, setDoc, getDoc, serverTimestamp, query, where, deleteDoc, writeBatch } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Pencil, X, Save, Upload, User as UserIcon, GitMerge, Sparkles } from "lucide-react";
import Image from "next/image";
import { cn, slugify, authorKey } from "@/lib/utils";

export function AuthorEditor({
  onClose,
  onSaved,
  initialAuthorId,
  initialAuthorName,
}: {
  onClose: () => void;
  onSaved?: (author: any) => void;
  initialAuthorId?: string;
  initialAuthorName?: string;
}) {
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const [authorsCache, setAuthorsCache] = useState<any[] | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", bio: "", photo: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [isAutoMerging, setIsAutoMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!db) return;
    setLoadingCache(true);
    getDocs(collection(db, "authors"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAuthorsCache(list);
        if (initialAuthorId) {
          const found = list.find((a: any) => a.id === initialAuthorId);
          const author = found || { id: initialAuthorId, name: initialAuthorName || initialAuthorId };
          setEditing(author);
          setForm({ name: (author as any).name || "", bio: (author as any).bio || "", photo: (author as any).photo || "" });
        }
      })
      .catch((err) => { console.error("Load Authors Error:", err); setAuthorsCache([]); })
      .finally(() => setLoadingCache(false));
  }, [db]);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    const matched = (authorsCache || []).filter((a) =>
      (a.name || "").toLowerCase().includes(q)
    );
    const groups: Record<string, any[]> = {};
    for (const a of matched) {
      const key = (a.name || "").toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.values(groups)
      .map((group) => {
        const best = group.sort((a, b) => {
          const aScore = (a.photo ? 100 : 0) + (Array.isArray(a.works) ? a.works.length : 0);
          const bScore = (b.photo ? 100 : 0) + (Array.isArray(b.works) ? b.works.length : 0);
          return bScore - aScore;
        })[0];
        return { ...best, _duplicates: group.length, _allIds: group.map((a) => a.id) };
      })
      .slice(0, 15);
  }, [authorsCache, search]);

  const startEdit = (author: any) => {
    setEditing(author);
    setForm({ name: author.name || "", bio: author.bio || "", photo: author.photo || "" });
    setMergeTarget("");
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;
    setIsUploading(true);
    try {
      const path = `authors/photos/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setForm((p: any) => ({ ...p, photo: url }));
      toast({ title: "Photo importée" });
    } catch (err) {
      console.error("Author Photo Upload Error:", err);
      toast({ variant: "destructive", title: "Erreur d'importation" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!db || !editing) return;
    if (!form.name?.trim()) {
      toast({ variant: "destructive", title: "Le nom est obligatoire" });
      return;
    }
    setIsSaving(true);
    try {
      const ref = doc(db, "authors", editing.id);
      const dataToSave = {
        name: form.name.trim(),
        bio: form.bio?.trim() || "",
        photo: form.photo?.trim() || "",
        manualBio: !!form.bio?.trim(),
        manualPhoto: !!form.photo?.trim(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, dataToSave, { merge: true });
      const saved = { id: editing.id, ...editing, ...dataToSave };
      setAuthorsCache((prev) => (prev || []).map((a) => (a.id === editing.id ? saved : a)));
      toast({ title: "Fiche auteur enregistrée" });
      onSaved?.(saved);
      if (initialAuthorId) {
        onClose();
      } else {
        setEditing(null);
      }
    } catch (err) {
      console.error("Save Author Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement", description: (err as any)?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const autoMergeDuplicates = useCallback(async () => {
    if (!db || !authorsCache) return;
    if (!confirm("Fusionner automatiquement tous les doublons de la base auteur ? L'opération est irréversible.")) return;
    setIsAutoMerging(true);
    let merged = 0;
    let deleted = 0;
    try {
      const groups: Record<string, any[]> = {};
      for (const a of authorsCache) {
        const key = (a.name || "").toLowerCase().trim();
        if (!key) continue;
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      }
      for (const group of Object.values(groups)) {
        if (group.length < 2) continue;
        group.sort((a, b) => {
          const aS = (a.photo ? 100 : 0) + (Array.isArray(a.works) ? a.works.length : 0);
          const bS = (b.photo ? 100 : 0) + (Array.isArray(b.works) ? b.works.length : 0);
          return bS - aS;
        });
        const target = group[0];
        const rest = group.slice(1);
        const allWorks = Array.from(new Set(group.flatMap((a) => Array.isArray(a.works) ? a.works : [])));
        const allBookIds = Array.from(new Set(group.flatMap((a) => Array.isArray(a.bookIds) ? a.bookIds : [])));
        const batch = writeBatch(db);
        batch.set(doc(db, "authors", target.id), {
          ...target,
          works: allWorks,
          bookIds: allBookIds,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        for (const dup of rest) {
          batch.delete(doc(db, "authors", dup.id));
          deleted++;
        }
        await batch.commit();
        merged++;
      }
      const snap = await getDocs(collection(db, "authors"));
      setAuthorsCache(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      toast({ title: "Doublons fusionnés", description: `${merged} groupe(s) traité(s), ${deleted} fiche(s) supprimée(s).` });
    } catch (err) {
      console.error("AutoMerge Error:", err);
      toast({ variant: "destructive", title: "Erreur lors de la fusion", description: (err as any)?.message });
    } finally {
      setIsAutoMerging(false);
    }
  }, [db, authorsCache, toast]);

  // ─── FUSION MANUELLE — VERSION CORRIGÉE ───────────────────────────────────
  // Corrections apportées :
  //   1. Utilise un writeBatch pour des opérations atomiques
  //   2. Met à jour la fiche CIBLE avec les works/bookIds combinés
  //   3. SUPPRIME la fiche SOURCE après fusion (c'était l'oubli principal)
  //   4. Met à jour le cache local correctement
  //   5. Affiche le message d'erreur réel en cas d'échec
  const handleMerge = async () => {
    if (!db || !editing || !mergeTarget.trim()) return;
    const target = (authorsCache || []).find((a) => a.id === mergeTarget);
    if (!target) return;
    if (!confirm(
      `Fusionner "${editing.name}" dans "${target.name}" ?\n` +
      `• Les livres de "${editing.name}" seront réattribués à "${target.name}"\n` +
      `• La fiche "${editing.name}" sera supprimée\n` +
      `Cette action est irréversible.`
    )) return;

    setIsMerging(true);
    try {
      // 1. Récupérer tous les masterBooks dont l'auteur est la fiche source
      const booksSnap = await getDocs(
        query(collection(db, "masterBooks"), where("author", "==", editing.name))
      );

      const batch = writeBatch(db);

      // 2. Réécrire l'auteur dans chaque masterBook vers le nom cible
      for (const b of booksSnap.docs) {
        batch.set(
          doc(db, "masterBooks", b.id),
          { author: target.name, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }

      // 3. Combiner works et bookIds dans la fiche CIBLE
      const allWorks = Array.from(new Set([
        ...(Array.isArray(target.works)  ? target.works  : []),
        ...(Array.isArray(editing.works) ? editing.works : []),
      ]));
      const allBookIds = Array.from(new Set([
        ...(Array.isArray(target.bookIds)  ? target.bookIds  : []),
        ...(Array.isArray(editing.bookIds) ? editing.bookIds : []),
      ]));

      batch.set(
        doc(db, "authors", target.id),
        { works: allWorks, bookIds: allBookIds, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // 4. SUPPRIMER la fiche source (c'était l'oubli)
      batch.delete(doc(db, "authors", editing.id));

      await batch.commit();

      // 5. Mettre à jour le cache local
      setAuthorsCache(prev =>
        (prev || [])
          .filter(a => a.id !== editing.id)
          .map(a => a.id === target.id
            ? { ...a, works: allWorks, bookIds: allBookIds }
            : a
          )
      );

      toast({
        title: "Fusion effectuée",
        description: `${booksSnap.size} livre(s) réattribué(s) à "${target.name}". Fiche "${editing.name}" supprimée.`,
      });
      setEditing(null);
    } catch (err) {
      console.error("Merge Authors Error:", err);
      toast({
        variant: "destructive",
        title: "Erreur de fusion",
        description: (err as any)?.message || "Erreur inconnue",
      });
    } finally {
      setIsMerging(false);
    }
  };

  // --- Liste / recherche ---
  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-headline italic flex items-center gap-3"><UserIcon className="h-5 w-5 text-primary" /> Éditer une fiche auteur</h3>
          <div className="flex items-center gap-2">
            {authorsCache && authorsCache.length > 0 && (
              <Button variant="outline" size="sm" onClick={autoMergeDuplicates} disabled={isAutoMerging} className="rounded-xl text-xs border-orange-200 text-orange-600 hover:bg-orange-50">
                {isAutoMerging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitMerge className="h-3 w-3 mr-1" />}
                Fusionner les doublons
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl"><X className="h-4 w-4 mr-2" /> Fermer</Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
          <Input
            placeholder="Cherche un auteur par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-14 pl-14 italic bg-white/40 rounded-2xl border-none shadow-inner"
          />
          {loadingCache && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin opacity-40" />}
        </div>
        {search.trim() && (
          <div className="rounded-2xl border border-primary/5 bg-white/40 divide-y divide-primary/5 overflow-hidden">
            {results.length === 0 && !loadingCache && (
              <p className="p-6 text-sm italic opacity-50 text-center">Aucun auteur trouvé pour "{search}".</p>
            )}
            {results.map((a) => (
              <button key={a.id} onClick={() => startEdit(a)} className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left">
                <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0 bg-primary/5 flex items-center justify-center">
                  {a.photo ? <Image src={a.photo} alt={a.name} fill className="object-cover" /> : <UserIcon className="h-5 w-5 text-primary/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-headline italic truncate">{a.name}</p>
                    {a._duplicates > 1 && (
                      <span className="shrink-0 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                        ×{a._duplicates}
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-50 truncate">
                    {Array.isArray(a.works) ? `${a.works.length} œuvre(s)` : ""}
                    {a._duplicates > 1 ? ` · ${a._duplicates} fiches en doublon` : ""}
                  </p>
                </div>
                <Pencil className="h-4 w-4 opacity-30 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Édition d'une fiche ---
  const mergeCandidates = (authorsCache || []).filter((a) => a.id !== editing.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-headline italic flex items-center gap-3"><Pencil className="h-5 w-5 text-primary" /> {editing.name}</h3>
        <Button variant="ghost" size="sm" onClick={() => (initialAuthorId ? onClose() : setEditing(null))} className="rounded-xl"><X className="h-4 w-4 mr-2" /> {initialAuthorId ? "Fermer" : "Retour"}</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="space-y-3 w-full sm:w-44">
          <div className="relative h-44 w-44 mx-auto rounded-full overflow-hidden bg-primary/5 shadow-inner flex items-center justify-center">
            {form.photo ? <Image src={form.photo} alt={form.name} fill className="object-cover" /> : <UserIcon className="h-16 w-16 text-primary/20" />}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full h-10 rounded-xl border-primary/20 bg-white/40 text-primary/70 italic text-sm">
            {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Importer une photo
          </Button>
        </div>

        <div className="flex-1 space-y-5 w-full">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Nom affiché</Label>
            <Input value={form.name || ""} onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">URL photo (ou importe ci-contre)</Label>
            <Input value={form.photo || ""} onChange={(e) => setForm((p: any) => ({ ...p, photo: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Biographie</Label>
        <Textarea value={form.bio || ""} onChange={(e) => setForm((p: any) => ({ ...p, bio: e.target.value }))} className="min-h-32 italic bg-white/40 rounded-2xl border-none shadow-inner" />
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 rounded-2xl bg-primary italic font-headline text-xl shadow-xl shadow-primary/10">
        {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} Enregistrer la fiche
      </Button>

      <div className="pt-6 border-t border-primary/10 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2"><GitMerge className="h-3.5 w-3.5" /> Fusionner ce doublon dans une autre fiche</Label>
        <p className="text-xs italic opacity-50">Les livres de "{editing.name}" seront réattribués à l'auteur choisi. La fiche "{editing.name}" sera supprimée.</p>
        <div className="flex gap-2">
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="flex-1 h-11 rounded-xl bg-white/40 border-none shadow-inner italic px-4 text-sm"
          >
            <option value="">Choisir l'auteur à conserver...</option>
            {mergeCandidates.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <Button onClick={handleMerge} disabled={isMerging || !mergeTarget} variant="outline" className="h-11 px-5 rounded-xl border-primary/20 shrink-0">
            {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
