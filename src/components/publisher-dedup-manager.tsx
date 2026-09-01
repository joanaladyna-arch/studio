"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Search, Merge } from "lucide-react";
import { publisherKey, levenshteinRatio } from "@/lib/utils";

/**
 * Fusion des doublons d'éditeurs dans masterBooks (ex: "Editions
 * Addictives" / "Edition Addictives" / "Addictives" sont la même
 * maison). Toujours en deux temps, jamais de fusion automatique en un
 * clic : "Analyser" ne fait que LIRE et proposer un plan (dry-run),
 * "Confirmer la fusion" écrit réellement — et seulement pour les
 * groupes cochés.
 *
 * Deux types de groupes proposés :
 * - "Détecté" (coché par défaut) : même publisherKey après
 *   normalisation stricte (accents, casse, ville entre parenthèses,
 *   mot "Editions/Edition" en trop) — quasi certain d'être le même
 *   éditeur, écrit sous des graphies différentes.
 * - "À vérifier" (décoché par défaut) : noms différents mais très
 *   proches (Levenshtein) ou dont l'un est un préfixe de mots de
 *   l'autre (ex: "Hugo" / "Hugo Roman") — peut être une vraie
 *   collection distincte du même groupe, jamais fusionné sans que
 *   l'admin coche explicitement la case.
 */

interface Variant {
  name: string;
  count: number;
  docIds: string[];
}

interface DedupGroup {
  id: string;
  variants: Variant[];
  canonicalName: string;
  fuzzy: boolean;
  selected: boolean;
}

function majorityName(variants: Variant[]): string {
  let best = variants[0]?.name || "";
  let bestCount = -1;
  for (const v of variants) {
    if (v.count > bestCount) { best = v.name; bestCount = v.count; }
  }
  return best;
}

export function PublisherDedupManager() {
  const db = useFirestore();
  const { toast } = useToast();
  const [groups, setGroups] = useState<DedupGroup[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [results, setResults] = useState<{ updated: number; groups: number } | null>(null);

  const analyze = async () => {
    if (!db) return;
    setIsAnalyzing(true);
    setResults(null);
    try {
      const snap = await getDocs(collection(db, "masterBooks"));

      // key -> nom exact -> { count, docIds }
      const byKey = new Map<string, Map<string, Variant>>();
      snap.forEach((d) => {
        const raw = (d.data()?.publisher || "").toString().trim();
        const cleaned = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
        if (cleaned.length <= 1) return;
        const key = publisherKey(cleaned);
        if (!key) return;
        const variants = byKey.get(key) || new Map<string, Variant>();
        const existing = variants.get(cleaned);
        if (existing) { existing.count++; existing.docIds.push(d.id); }
        else variants.set(cleaned, { name: cleaned, count: 1, docIds: [d.id] });
        byKey.set(key, variants);
      });

      const exactGroups: DedupGroup[] = [];
      byKey.forEach((variants, key) => {
        if (variants.size > 1) {
          const list = Array.from(variants.values());
          exactGroups.push({ id: key, variants: list, canonicalName: majorityName(list), fuzzy: false, selected: true });
        }
      });

      // Suggestions floues entre clés DIFFÉRENTES restantes : soit très
      // proches lettre à lettre (typo), soit l'une est un préfixe de
      // mots de l'autre (collection/déclinaison du même éditeur).
      const keys = Array.from(byKey.keys());
      const fuzzyGroups: DedupGroup[] = [];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = keys[i], b = keys[j];
          if (!a || !b) continue;
          const wordsA = a.split(" ");
          const wordsB = b.split(" ");
          const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
          const isPrefix = shorter.length > 0 && shorter.every((w, idx) => longer[idx] === w) && shorter.length !== longer.length;
          const closeSpelling = levenshteinRatio(a, b) >= 0.82;
          if (isPrefix || closeSpelling) {
            const combined = [...(byKey.get(a)?.values() || []), ...(byKey.get(b)?.values() || [])];
            fuzzyGroups.push({ id: `${a}__${b}`, variants: combined, canonicalName: majorityName(combined), fuzzy: true, selected: false });
          }
        }
      }

      const all = [...exactGroups, ...fuzzyGroups];
      setGroups(all);
      if (all.length === 0) {
        toast({ title: "Aucun doublon détecté", description: "Toutes les maisons d'édition semblent uniques." });
      }
    } catch (err) {
      console.error("Publisher Dedup Analyze Error:", err);
      toast({ variant: "destructive", title: "Erreur d'analyse" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateCanonicalName = (id: string, name: string) => {
    setGroups((prev) => (prev || []).map((g) => (g.id === id ? { ...g, canonicalName: name } : g)));
  };

  const toggleSelected = (id: string) => {
    setGroups((prev) => (prev || []).map((g) => (g.id === id ? { ...g, selected: !g.selected } : g)));
  };

  const mergeSelected = async () => {
    if (!db || !groups) return;
    const toMerge = groups.filter((g) => g.selected && g.canonicalName.trim());
    if (toMerge.length === 0) {
      toast({ variant: "destructive", title: "Aucun groupe sélectionné" });
      return;
    }
    setIsMerging(true);
    let updated = 0;
    try {
      for (const group of toMerge) {
        const canonical = group.canonicalName.trim();
        for (const variant of group.variants) {
          if (variant.name === canonical) continue; // déjà la bonne graphie
          for (const docId of variant.docIds) {
            await setDoc(doc(db, "masterBooks", docId), { publisher: canonical }, { merge: true });
            updated++;
          }
        }
      }
      setResults({ updated, groups: toMerge.length });
      setGroups((prev) => (prev || []).filter((g) => !toMerge.includes(g)));
      toast({ title: "Fusion terminée", description: `${updated} fiche(s) mise(s) à jour sur ${toMerge.length} groupe(s).` });
    } catch (err) {
      console.error("Publisher Dedup Merge Error:", err);
      toast({ variant: "destructive", title: "Erreur pendant la fusion" });
    } finally {
      setIsMerging(false);
    }
  };

  const selectedCount = (groups || []).filter((g) => g.selected).length;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-headline italic flex items-center gap-3">
        <Building2 className="h-5 w-5 text-primary" /> Fusionner les doublons éditeurs
      </h3>
      <p className="text-xs italic opacity-60">
        Analyse en lecture seule d'abord — rien n'est modifié tant que tu n'as pas coché des groupes et cliqué sur
        "Confirmer la fusion".
      </p>

      <Button
        variant="outline"
        onClick={analyze}
        disabled={isAnalyzing}
        className="h-11 rounded-xl italic font-headline border-primary/20"
      >
        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
        Analyser
      </Button>

      {results && (
        <p className="text-xs opacity-60 italic">
          {results.updated} fiche(s) mise(s) à jour sur {results.groups} groupe(s) fusionné(s).
        </p>
      )}

      {groups && groups.length > 0 && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className={
                group.fuzzy
                  ? "p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2"
                  : "p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2"
              }
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={group.selected} onCheckedChange={() => toggleSelected(group.id)} className="mt-1" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                    {group.fuzzy ? "À vérifier — noms proches, pas forcément identiques" : "Détecté — même éditeur, graphies différentes"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.variants.map((v) => (
                      <span key={v.name} className="text-xs italic bg-white/60 rounded-full px-3 py-1 shadow-sm">
                        {v.name} <span className="opacity-40">×{v.count}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 shrink-0">Nom final</span>
                    <Input
                      value={group.canonicalName}
                      onChange={(e) => updateCanonicalName(group.id, e.target.value)}
                      className="h-9 text-sm bg-white/60 rounded-lg border-none shadow-inner"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button
            onClick={mergeSelected}
            disabled={isMerging || selectedCount === 0}
            className="w-full h-12 rounded-xl italic font-headline bg-primary"
          >
            {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
            Confirmer la fusion ({selectedCount} groupe{selectedCount > 1 ? "s" : ""})
          </Button>
        </div>
      )}
    </div>
  );
}
