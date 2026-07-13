
"use client";

import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Newspaper, Loader2, Plus, Pencil, Trash2, X, Save, Sparkles } from "lucide-react";
import { slugify, authorKey } from "@/lib/utils";

/**
 * Gestion complète des actualités d'auteur / littéraires (CRUD), pensée
 * pour être affichée en mode admin directement sur la page Actualités.
 * Le rattachement à un auteur se fait par slug insensible à l'ordre du
 * nom (authorKey), pour matcher quelle que soit la façon dont le nom est
 * écrit ("Rina Kent" / "Kent Rina").
 */
export function ActualitesManager({ onChanged }: { onChanged?: () => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [actualites, setActualites] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ title: "", authorName: "", content: "", cover: "", isRelease: false, releaseDate: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "actualites"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        list.sort((a, b) => (b.publishedAt?.toMillis?.() || 0) - (a.publishedAt?.toMillis?.() || 0));
        setActualites(list);
      })
      .catch((err) => { console.error("Load Actualites Error:", err); setActualites([]); });
  }, [db]);

  const startNew = () => { setEditing({ isNew: true }); setForm({ title: "", authorName: "", content: "", cover: "", isRelease: false, releaseDate: "" }); };
  const startEdit = (item: any) => { setEditing(item); setForm({ title: item.title || "", authorName: item.authorName || "", content: item.content || "", cover: item.cover || "", isRelease: Boolean(item.isRelease), releaseDate: item.releaseDate || "" }); };
  const cancel = () => { setEditing(null); setForm({ title: "", authorName: "", content: "", cover: "", isRelease: false, releaseDate: "" }); };

  const save = async () => {
    if (!db || !editing) return;
    if (!form.title?.trim() || !form.content?.trim()) {
      toast({ variant: "destructive", title: "Titre et contenu sont obligatoires" });
      return;
    }
    setIsSaving(true);
    try {
      const docId = editing.isNew ? doc(collection(db, "actualites")).id : editing.id;
      const authorName = form.authorName?.trim() || "";
      const dataToSave = {
        title: form.title.trim(),
        content: form.content.trim(),
        authorName,
        authorSlug: authorName ? authorKey(authorName) : "",
        cover: form.cover?.trim() || "",
        isRelease: Boolean(form.isRelease),
        releaseDate: form.isRelease ? (form.releaseDate || "") : "",
        publishedAt: editing.isNew ? serverTimestamp() : (editing.publishedAt || serverTimestamp()),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "actualites", docId), dataToSave, { merge: true });
      const saved = { id: docId, ...dataToSave };
      setActualites((prev) => {
        const list = prev || [];
        const exists = list.some((a) => a.id === docId);
        return exists ? list.map((a) => (a.id === docId ? saved : a)) : [saved, ...list];
      });
      toast({ title: editing.isNew ? "Actualité publiée" : "Actualité mise à jour" });
      cancel();
      onChanged?.();
    } catch (err) {
      console.error("Save Actuality Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!db || !confirm("Supprimer cette actualité ?")) return;
    try {
      await deleteDoc(doc(db, "actualites", id));
      setActualites((prev) => (prev || []).filter((a) => a.id !== id));
      toast({ title: "Actualité supprimée" });
      onChanged?.();
    } catch (err) {
      console.error("Delete Actuality Error:", err);
      toast({ variant: "destructive", title: "Erreur de suppression" });
    }
  };

  return (
    <div className="space-y-6">
      {!editing && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-xl font-headline italic flex items-center gap-3"><Newspaper className="h-6 w-6 text-primary" /> Gérer les actualités</h3>
            <Button onClick={startNew} variant="outline" className="rounded-2xl h-11 px-5 border-primary/20 bg-white/40 text-primary italic font-headline">
              <Plus className="mr-2 h-4 w-4" /> Nouvelle actualité
            </Button>
          </div>
          <div className="space-y-3">
            {actualites === null && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin opacity-40" /></div>}
            {actualites !== null && actualites.length === 0 && <p className="text-sm italic opacity-50 text-center py-6">Aucune actualité publiée.</p>}
            {actualites !== null && actualites.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/40">
                <div className="flex-1 min-w-0">
                  <p className="font-headline italic truncate">{item.title}</p>
                  <p className="text-xs opacity-50 truncate">{item.authorName || "Actualité littéraire générale"}</p>
                </div>
                <button onClick={() => startEdit(item)} className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-primary hover:scale-110 transition-transform"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(item.id)} className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-destructive hover:scale-110 transition-transform"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-headline italic flex items-center gap-3">
              {editing.isNew ? <Sparkles className="h-5 w-5 text-primary" /> : <Pencil className="h-5 w-5 text-primary" />}
              {editing.isNew ? "Nouvelle actualité" : "Modification"}
            </h3>
            <Button variant="ghost" size="sm" onClick={cancel} className="rounded-xl"><X className="h-4 w-4 mr-2" /> Annuler</Button>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Titre *</Label>
            <Input value={form.title || ""} onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Auteur concerné (vide = actualité générale)</Label>
            <Input value={form.authorName || ""} onChange={(e) => setForm((p: any) => ({ ...p, authorName: e.target.value }))} placeholder="Ex : Rina Kent" className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Image (optionnel)</Label>
            <Input value={form.cover || ""} onChange={(e) => setForm((p: any) => ({ ...p, cover: e.target.value }))} placeholder="URL de l'image" className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <label className="flex items-center gap-3 p-4 rounded-2xl bg-rose/5 border border-rose/10 cursor-pointer">
            <Checkbox
              checked={Boolean(form.isRelease)}
              onCheckedChange={(v) => setForm((p: any) => ({ ...p, isRelease: Boolean(v) }))}
              className="border-rose/30 data-[state=checked]:bg-rose data-[state=checked]:border-rose"
            />
            <span className="text-sm font-headline italic">C'est une sortie de livre — l'épingler dans "Sorties de la semaine"</span>
          </label>
          {form.isRelease && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Date de sortie</Label>
              <Input
                type="date"
                value={form.releaseDate || ""}
                onChange={(e) => setForm((p: any) => ({ ...p, releaseDate: e.target.value }))}
                className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Contenu *</Label>
            <Textarea value={form.content || ""} onChange={(e) => setForm((p: any) => ({ ...p, content: e.target.value }))} className="min-h-40 italic bg-white/40 rounded-2xl border-none shadow-inner" />
          </div>
          <Button onClick={save} disabled={isSaving} className="w-full h-14 rounded-2xl bg-primary italic font-headline text-xl shadow-xl shadow-primary/10">
            {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} Publier
          </Button>
        </div>
      )}
    </div>
  );
}
