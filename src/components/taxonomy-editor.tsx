
"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { doc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, EyeOff, Eye } from "lucide-react";
import { GENRES_LIST, TROPES_LIST, THEMES_LIST } from "@/app/library/page";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { cn } from "@/lib/utils";

/**
 * Éditeur des listes globales de genres, tropes et thèmes.
 *
 * - Ajouter une entrée : stockée dans config/taxonomy (addedX), disponible
 *   immédiatement partout dans l'app.
 * - Masquer une entrée : retirée des choix proposés. Les entrées de BASE
 *   (définies dans le code) ne sont jamais réellement supprimées — juste
 *   masquées — pour ne jamais casser les badges du profil. Les entrées
 *   ajoutées par l'admin, elles, peuvent être retirées définitivement.
 * - Aucun livre déjà tagué ne perd son tag quand une entrée est masquée.
 */

const BASE = {
  genres: new Set(GENRES_LIST.map((g) => g.toLowerCase())),
  tropes: new Set(TROPES_LIST.map((t) => t.toLowerCase())),
  themes: new Set(THEMES_LIST.map((t) => t.toLowerCase())),
};

const FIELD_MAP = {
  genres: { added: "addedGenres", hidden: "hiddenGenres", color: "primary" },
  tropes: { added: "addedTropes", hidden: "hiddenTropes", color: "secondary" },
  themes: { added: "addedThemes", hidden: "hiddenThemes", color: "primary" },
} as const;

type Cat = keyof typeof FIELD_MAP;

export function TaxonomyEditor() {
  const db = useFirestore();
  const { toast } = useToast();
  const taxonomy = useTaxonomy();
  const [newValues, setNewValues] = useState<Record<Cat, string>>({ genres: "", tropes: "", themes: "" });
  const [busy, setBusy] = useState(false);

  const ref = () => doc(db!, "config", "taxonomy");

  const addEntry = async (cat: Cat) => {
    const value = newValues[cat].trim();
    if (!db || !value) return;
    setBusy(true);
    try {
      await setDoc(ref(), { [FIELD_MAP[cat].added]: arrayUnion(value), updatedAt: serverTimestamp() }, { merge: true });
      // Si l'entrée était masquée, on la ré-affiche.
      await setDoc(ref(), { [FIELD_MAP[cat].hidden]: arrayRemove(value) }, { merge: true });
      setNewValues((p) => ({ ...p, [cat]: "" }));
      toast({ title: "Ajouté", description: `"${value}" est disponible partout dans l'app.` });
    } catch (err) {
      console.error("Add Taxonomy Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  const hideEntry = async (cat: Cat, value: string) => {
    if (!db) return;
    const isBase = BASE[cat].has(value.toLowerCase());
    setBusy(true);
    try {
      if (isBase) {
        // Entrée de base : on la masque seulement (réversible, sûr).
        await setDoc(ref(), { [FIELD_MAP[cat].hidden]: arrayUnion(value), updatedAt: serverTimestamp() }, { merge: true });
        toast({ title: "Masqué", description: `"${value}" n'est plus proposé. Les livres déjà tagués le gardent.` });
      } else {
        // Entrée ajoutée par l'admin : on la retire vraiment.
        await setDoc(ref(), { [FIELD_MAP[cat].added]: arrayRemove(value), updatedAt: serverTimestamp() }, { merge: true });
        toast({ title: "Retiré", description: `"${value}" a été supprimé de la liste.` });
      }
    } catch (err) {
      console.error("Hide Taxonomy Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  const restoreEntry = async (cat: Cat, value: string) => {
    if (!db) return;
    setBusy(true);
    try {
      await setDoc(ref(), { [FIELD_MAP[cat].hidden]: arrayRemove(value), updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Réaffiché", description: `"${value}" est de nouveau proposé.` });
    } catch (err) {
      console.error("Restore Taxonomy Error:", err);
    } finally {
      setBusy(false);
    }
  };

  const renderCategory = (cat: Cat, label: string, baseList: string[]) => {
    const active = taxonomy[cat];
    // Entrées de base actuellement masquées (donc absentes de `active`).
    const hidden = baseList.filter((b) => !active.some((a) => a.toLowerCase() === b.toLowerCase()));
    const colorActive = FIELD_MAP[cat].color === "secondary"
      ? "bg-secondary/10 text-secondary border-secondary/20"
      : "bg-primary/10 text-primary border-primary/20";

    return (
      <div className="space-y-4">
        <Label className="italic text-xl font-headline">{label}</Label>
        <div className="flex gap-2">
          <Input
            value={newValues[cat]}
            onChange={(e) => setNewValues((p) => ({ ...p, [cat]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(cat); } }}
            placeholder={`Ajouter un ${label.toLowerCase().replace(/s$/, "")}...`}
            className="h-11 italic bg-white/40 rounded-xl border-none shadow-inner"
          />
          <Button onClick={() => addEntry(cat)} disabled={busy || !newValues[cat].trim()} className="h-11 px-5 rounded-xl bg-primary shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {active.map((item) => (
            <span key={item} className={cn("group inline-flex items-center gap-1.5 rounded-full border text-xs px-3 py-1.5 italic", colorActive)}>
              {item}
              <button onClick={() => hideEntry(cat, item)} disabled={busy} className="opacity-40 hover:opacity-100 transition-opacity" title="Retirer / masquer">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        {hidden.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2"><EyeOff className="h-3 w-3" /> Masqués (les livres déjà tagués les gardent)</p>
            <div className="flex flex-wrap gap-2">
              {hidden.map((item) => (
                <button key={item} onClick={() => restoreEntry(cat, item)} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/20 text-xs px-3 py-1.5 italic opacity-50 hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!taxonomy.loaded) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>;
  }

  return (
    <div className="space-y-10">
      {renderCategory("genres", "Genres", GENRES_LIST)}
      {renderCategory("tropes", "Tropes", TROPES_LIST)}
      {renderCategory("themes", "Thèmes principaux", THEMES_LIST)}
    </div>
  );
}
