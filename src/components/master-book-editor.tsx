
"use client";

import { useState, useEffect, useRef } from "react";
import { useFirestore, useStorage, useUser } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, X, Save, Sparkles, Upload } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { GENRES_LIST, TROPES_LIST, THEMES_LIST } from "@/app/library/page";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { cn, slugify, cleanIsbnValue, cleanDescriptionHtml } from "@/lib/utils";
import { TagDropdown } from "@/components/tag-dropdown";

/**
 * Éditeur complet d'une fiche MasterBook (base partagée Lectoria) — couvre
 * tous les champs : couverture, résumé, genres, tropes, thèmes, etc.
 *
 * Composant volontairement autonome (state interne géré ici) pour être
 * utilisé aussi bien depuis la page /admin (recherche + édition) que
 * directement depuis Bibliothèque, Coups de Cœur ou Ajouter via un
 * bouton "éditer" contextuel (en général dans un Dialog) — sans dupliquer
 * cette logique à chaque endroit.
 *
 * `book` : la fiche à éditer (avec son `id`), ou `{ isNew: true }` pour
 * une création depuis zéro. `onClose` est appelé à l'annulation ET après
 * un enregistrement réussi ; `onSaved` reçoit la fiche enregistrée pour
 * que l'appelant puisse rafraîchir son propre affichage si besoin.
 */
export function MasterBookEditor({
  book,
  onClose,
  onSaved,
}: {
  book: any;
  onClose: () => void;
  onSaved?: (savedBook: any) => void;
}) {
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const taxonomy = useTaxonomy();
  const [form, setForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Téléverse une couverture depuis l'appareil vers Firebase Storage
  // (dossier partagé masterBooks/covers), puis stocke l'URL publique
  // obtenue dans le champ cover. Permet d'ajouter une image sans avoir à
  // coller un lien web — comme demandé.
  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;
    setIsUploading(true);
    try {
      const path = `masterBooks/covers/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setForm((p: any) => ({ ...p, cover: url }));
      toast({ title: "Couverture importée" });
    } catch (err) {
      console.error("Cover Upload Error:", err);
      toast({ variant: "destructive", title: "Erreur d'importation", description: "L'image n'a pas pu être envoyée." });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    setForm({
      title: book?.title || "",
      subtitle: book?.subtitle || "",
      author: book?.author || "",
      translator: book?.translator || "",
      publisher: book?.publisher || "",
      isbn13: book?.isbn13 || "",
      isbn10: book?.isbn10 || "",
      language: book?.language || "Français",
      publishedDate: book?.publishedDate || "",
      pageCount: book?.pageCount || "",
      volume: book?.volume || "",
      saga: book?.saga || "",
      cover: book?.cover || "",
      description: cleanDescriptionHtml(book?.description) || "",
      genres: Array.isArray(book?.genres) ? book.genres : [],
      tropes: Array.isArray(book?.tropes) ? book.tropes : [],
      themes: Array.isArray(book?.themes) ? book.themes : [],
    });
  }, [book?.id]);

  const toggleTag = (field: "genres" | "tropes" | "themes", value: string) => {
    setForm((prev: any) => {
      const current: string[] = Array.isArray(prev[field]) ? prev[field] : [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const isNew = !book?.id;

  const handleSave = async () => {
    if (!db) return;
    if (!form.title?.trim()) {
      toast({ variant: "destructive", title: "Le titre est obligatoire" });
      return;
    }
    setIsSaving(true);
    try {
      const docId = isNew ? (cleanIsbnValue(form.isbn13) || slugify(`${form.title}-${form.author}`)) : book.id;
      const ref = doc(db, "masterBooks", docId);
      const dataToSave = {
        title: form.title.trim(),
        subtitle: form.subtitle?.trim() || "",
        author: form.author?.trim() || "Inconnu",
        translator: form.translator?.trim() || "",
        publisher: form.publisher?.trim() || "",
        isbn13: cleanIsbnValue(form.isbn13) || "",
        isbn10: cleanIsbnValue(form.isbn10) || "",
        language: form.language?.trim() || "Français",
        publishedDate: form.publishedDate?.trim() || "",
        pageCount: parseInt(form.pageCount) || 0,
        volume: form.volume?.trim() || "",
        saga: form.saga?.trim() || "",
        cover: form.cover?.trim() || "",
        description: form.description?.trim() || "",
        genres: form.genres || [],
        tropes: form.tropes || [],
        themes: form.themes || [],
        updatedAt: serverTimestamp(),
        source: isNew ? "admin-manual" : (book.source || "admin-manual"),
      };
      await setDoc(ref, dataToSave, { merge: true });
      toast({ title: isNew ? "Fiche créée" : "Fiche mise à jour", description: `${dataToSave.title} a été enregistré.` });
      onSaved?.({ id: docId, ...dataToSave });
      onClose();
    } catch (err) {
      console.error("Save MasterBook Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-headline italic flex items-center gap-3">
          {isNew ? <Sparkles className="h-5 w-5 text-primary" /> : <Pencil className="h-5 w-5 text-primary" />}
          {isNew ? "Nouvelle fiche" : "Modification de la fiche"}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
          <X className="h-4 w-4 mr-2" /> Annuler
        </Button>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-8">
        <div className="space-y-3">
          <div className="relative h-64 rounded-2xl overflow-hidden bg-primary/5 shadow-inner">
            <BookCover src={form.cover} alt={form.title || "Couverture"} className="object-cover" />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-11 rounded-xl border-primary/20 bg-white/40 text-primary/70 italic text-sm"
          >
            {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importer une image
          </Button>
          <Input
            placeholder="ou colle une URL d'image"
            value={form.cover || ""}
            onChange={(e) => setForm((p: any) => ({ ...p, cover: e.target.value }))}
            className="text-xs italic bg-white/40 rounded-xl border-none shadow-inner h-11"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Titre *</Label>
            <Input value={form.title || ""} onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sous-titre</Label>
            <Input value={form.subtitle || ""} onChange={(e) => setForm((p: any) => ({ ...p, subtitle: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Auteur</Label>
            <Input value={form.author || ""} onChange={(e) => setForm((p: any) => ({ ...p, author: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Traducteur</Label>
            <Input value={form.translator || ""} onChange={(e) => setForm((p: any) => ({ ...p, translator: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Éditeur</Label>
            <Input value={form.publisher || ""} onChange={(e) => setForm((p: any) => ({ ...p, publisher: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tome</Label>
            <Input value={form.volume || ""} onChange={(e) => setForm((p: any) => ({ ...p, volume: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Saga (facultatif)</Label>
            <Input
              value={form.saga || ""}
              onChange={(e) => setForm((p: any) => ({ ...p, saga: e.target.value }))}
              placeholder="ex : Legacy of God"
              className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">ISBN 13</Label>
            <Input value={form.isbn13 || ""} onChange={(e) => setForm((p: any) => ({ ...p, isbn13: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">ISBN 10</Label>
            <Input value={form.isbn10 || ""} onChange={(e) => setForm((p: any) => ({ ...p, isbn10: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Langue</Label>
            <Input value={form.language || ""} onChange={(e) => setForm((p: any) => ({ ...p, language: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Année</Label>
            <Input value={form.publishedDate || ""} onChange={(e) => setForm((p: any) => ({ ...p, publishedDate: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pages</Label>
            <Input type="number" value={form.pageCount || ""} onChange={(e) => setForm((p: any) => ({ ...p, pageCount: e.target.value }))} className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Résumé</Label>
        <Textarea
          value={form.description || ""}
          onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
          className="min-h-32 italic bg-white/40 rounded-2xl border-none shadow-inner"
        />
      </div>

      <TagDropdown
        label="Genres"
        options={taxonomy.genres}
        selected={form.genres || []}
        onToggle={(v) => toggleTag("genres", v)}
        accent="primary"
      />

      <TagDropdown
        label="Tropes"
        options={taxonomy.tropes}
        selected={form.tropes || []}
        onToggle={(v) => toggleTag("tropes", v)}
        accent="secondary"
      />

      <TagDropdown
        label="Thèmes principaux"
        options={taxonomy.themes}
        selected={form.themes || []}
        onToggle={(v) => toggleTag("themes", v)}
        accent="primary"
      />

      <Button onClick={handleSave} disabled={isSaving} className="w-full h-16 rounded-[2rem] bg-primary shadow-xl shadow-primary/10 font-headline italic text-2xl transition-transform active:scale-95">
        {isSaving ? <Loader2 className="mr-4 h-8 w-8 animate-spin" /> : <Save className="mr-4 h-8 w-8" />} Enregistrer la fiche
      </Button>
    </div>
  );
}
