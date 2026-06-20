
"use client";

import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/book-cover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, GitMerge, Search, AlertTriangle, X, ArrowRight } from "lucide-react";
import { cleanAuthorName, authorKey, cn } from "@/lib/utils";

/**
 * Détection et fusion de doublons de fiches livre.
 *
 * Principe de sûreté central : on ne fusionne JAMAIS deux bibliothèques
 * personnelles de lectrices. La page d'une lectrice référence une fiche
 * partagée par son id (masterBookId), stocké dans SA bibliothèque privée
 * — à laquelle l'admin n'a pas accès en écriture (et ne doit pas y avoir
 * accès). Fusionner deux fiches consiste donc à :
 *  1. recopier dans la fiche conservée tout champ non vide manquant,
 *     sans jamais écraser une valeur déjà renseignée (même logique que
 *     la protection anti-écrasement de l'import Excel) ;
 *  2. enregistrer une redirection (config/bookMerges) : { [idRetiré]:
 *     idConservé } — ainsi, toute lectrice dont la bibliothèque pointe
 *     encore vers l'ancienne fiche est automatiquement redirigée vers la
 *     fiche fusionnée à l'affichage, SANS qu'on modifie sa bibliothèque ;
 *  3. supprimer la fiche désormais redondante de la base partagée, pour
 *     qu'elle n'apparaisse plus en double dans les résultats de recherche.
 *
 * La détection automatique ne fait que SUGGÉRER des groupes à examiner —
 * elle ne fusionne jamais rien seule. Les tomes d'une même série peuvent
 * se retrouver dans le même groupe suggéré (ex. Tome 1 et Tome 2) : le
 * titre complet de chaque fiche reste toujours visible pour éviter toute
 * confusion avant de valider une fusion précise.
 */

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Clé de regroupement volontairement "floue" : but de SUGGESTION
// uniquement, jamais de fusion automatique. Elle ignore la ponctuation,
// les mots tome/volume et les chiffres de tome, ainsi qu'un éventuel
// suffixe "/ {auteur}" ajouté par erreur lors d'un import BnF, ainsi
// que les mentions d'édition génériques (Réédition, nouvelle édition...).
function fuzzyClusterKey(title: string, author?: string): string {
  let t = title || "";
  t = t.replace(/\s*\/\s*([^/]+)$/, (m, name) => {
    const cand = stripAccents(name).toLowerCase().trim();
    const a = author ? stripAccents(cleanAuthorName(author)).toLowerCase().trim() : "";
    return cand === a ? "" : m;
  });
  t = t.replace(/\s*[(\[](?:r[ée][ée]dition|nouvelle [ée]dition|[ée]dition (?:collector|r[ée]vis[ée]e|augment[ée]e|illustr[ée]e|reli[ée]e|poche|grand format))[)\]]\s*$/i, "");
  t = stripAccents(t).toLowerCase();
  t = t.replace(/\b(tome|volume|vol|t)\b/g, " ");
  t = t.replace(/[^a-z]/g, "");
  return t;
}

function keepText(incoming: any, current: any) {
  const v = (incoming ?? "").toString().trim();
  return v ? v : (current ?? "");
}
function keepArray(incoming: any, current: any) {
  return Array.isArray(incoming) && incoming.length ? incoming : (Array.isArray(current) ? current : []);
}
function keepNumber(incoming: any, current: any) {
  return incoming > 0 ? incoming : (current ?? 0);
}

export function BookDuplicatesManager() {
  const db = useFirestore();
  const { toast } = useToast();
  const [books, setBooks] = useState<any[] | null>(null);
  const [isMerging, setIsMerging] = useState<string | null>(null);

  // Liaison manuelle (titres trop différents pour être détectés, ex.
  // "Twisted Games" / "Games").
  const [linkSourceSearch, setLinkSourceSearch] = useState("");
  const [linkTargetSearch, setLinkTargetSearch] = useState("");
  const [linkSource, setLinkSource] = useState<any | null>(null);
  const [linkTarget, setLinkTarget] = useState<any | null>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "masterBooks"))
      .then((snap) => setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => { console.error("Load MasterBooks Error:", err); setBooks([]); });
  }, [db]);

  const clusters = (() => {
    if (!books) return [];
    const groups: Record<string, any[]> = {};
    const groupKeys: string[] = [];
    for (const b of books) {
      const author = authorKey(cleanAuthorName(b.author));
      const key = `${author}::${fuzzyClusterKey(b.title || "", b.author)}`;
      if (!groups[key]) { groups[key] = []; groupKeys.push(key); }
      groups[key].push(b);
    }
    // Seconde passe : relie les groupes du même auteur dont le titre
    // normalisé de l'un commence par celui de l'autre ("Into pieces" /
    // "Into pieces : leur amour né du chaos") — un cas que la
    // correspondance exacte ne peut pas attraper, mais qui reste assez
    // fiable pour une SUGGESTION (jamais de fusion automatique). Seuil
    // de 6 caractères pour éviter les faux positifs sur des titres très
    // courts partagés par hasard.
    const parent: Record<string, string> = {};
    const find = (k: string): string => (parent[k] && parent[k] !== k ? (parent[k] = find(parent[k])) : (parent[k] = parent[k] || k));
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    groupKeys.forEach((k) => { parent[k] = k; });
    for (let i = 0; i < groupKeys.length; i++) {
      const [authorA, titleA] = groupKeys[i].split("::");
      if (titleA.length < 6) continue;
      for (let j = i + 1; j < groupKeys.length; j++) {
        const [authorB, titleB] = groupKeys[j].split("::");
        if (authorA !== authorB || titleB.length < 6) continue;
        if (titleA.startsWith(titleB) || titleB.startsWith(titleA)) union(groupKeys[i], groupKeys[j]);
      }
    }
    const merged: Record<string, any[]> = {};
    groupKeys.forEach((k) => {
      const root = find(k);
      if (!merged[root]) merged[root] = [];
      merged[root].push(...groups[k]);
    });
    return Object.values(merged).filter((g) => g.length > 1);
  })();

  const removeBookEverywhere = (id: string) => {
    setBooks((prev) => (prev || []).filter((b) => b.id !== id));
  };

  const mergeBooks = async (source: any, target: any) => {
    if (!db) return;
    const mergeKey = `${source.id}-${target.id}`;
    setIsMerging(mergeKey);
    try {
      const merged: any = {
        title: keepText(target.title, source.title),
        subtitle: keepText(target.subtitle, source.subtitle),
        author: keepText(target.author, source.author),
        translator: keepText(target.translator, source.translator),
        publisher: keepText(target.publisher, source.publisher),
        collection: keepText(target.collection, source.collection),
        publishedDate: keepText(target.publishedDate, source.publishedDate),
        language: keepText(target.language, source.language),
        pageCount: keepNumber(target.pageCount, source.pageCount),
        cover: keepText(target.cover, source.cover),
        description: keepText(target.description, source.description),
        genres: keepArray(target.genres, source.genres),
        tropes: keepArray(target.tropes, source.tropes),
        themes: keepArray(target.themes, source.themes),
        series: keepText(target.series, source.series),
        volume: keepText(target.volume, source.volume),
        isbn13: keepText(target.isbn13, source.isbn13),
        isbn10: keepText(target.isbn10, source.isbn10),
        updatedAt: serverTimestamp(),
      };
      // Si les deux fiches ont chacune un ISBN différent et non vide, on
      // ne perd pas la trace du second : il est conservé en référence
      // plutôt qu'écrasé.
      if (source.isbn13 && target.isbn13 && source.isbn13 !== target.isbn13) {
        merged.alternateIsbns = arrayUnion(source.isbn13);
      }

      await setDoc(doc(db, "masterBooks", target.id), merged, { merge: true });
      // Redirection : toute lectrice référençant encore l'ancienne fiche
      // sera automatiquement renvoyée vers la fiche conservée, sans que
      // sa bibliothèque personnelle soit jamais modifiée.
      await setDoc(doc(db, "config", "bookMerges"), { map: { [source.id]: target.id } }, { merge: true });
      await deleteDoc(doc(db, "masterBooks", source.id));

      removeBookEverywhere(source.id);
      setBooks((prev) => (prev || []).map((b) => (b.id === target.id ? { ...b, ...merged } : b)));
      toast({ title: "Fiches fusionnées", description: `"${source.title}" a été fusionnée dans "${target.title}".` });
      setLinkSource(null);
      setLinkTarget(null);
    } catch (err) {
      console.error("Merge Books Error:", err);
      toast({ variant: "destructive", title: "Erreur de fusion" });
    } finally {
      setIsMerging(null);
    }
  };

  const searchResults = (q: string) => {
    if (!q.trim() || !books) return [];
    const needle = q.toLowerCase();
    return books.filter((b) => (b.title || "").toLowerCase().includes(needle) || (b.author || "").toLowerCase().includes(needle)).slice(0, 8);
  };

  if (books === null) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>;
  }

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Copy className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-headline italic">Doublons détectés ({clusters.length} groupe{clusters.length !== 1 ? "s" : ""})</h3>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 italic">Les tomes d'une même série peuvent apparaître dans le même groupe — vérifie toujours le numéro de tome avant de fusionner deux fiches.</p>
        </div>

        {clusters.length === 0 && (
          <p className="text-sm italic opacity-50 text-center py-6">Aucun doublon évident détecté pour le moment.</p>
        )}

        {clusters.map((group, gi) => (
          <div key={gi} className="rounded-2xl border border-primary/10 bg-white/40 p-5 space-y-3">
            {group.map((b) => (
              <div key={b.id} className="flex items-center gap-4">
                <div className="relative h-16 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-primary/5">
                  <BookCover src={b.cover} alt={b.title} className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline italic truncate">{b.title}</p>
                  <p className="text-xs opacity-50 truncate">{cleanAuthorName(b.author)} {b.publisher ? `· ${b.publisher}` : ""} {b.isbn13 ? `· ${b.isbn13}` : ""}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end max-w-[40%]">
                  {group.filter((other) => other.id !== b.id).map((other) => (
                    <Button
                      key={other.id}
                      size="sm"
                      variant="outline"
                      disabled={isMerging === `${b.id}-${other.id}` || isMerging === `${other.id}-${b.id}`}
                      onClick={() => mergeBooks(b, other)}
                      className="h-8 rounded-lg text-[10px] px-2 border-primary/20 text-primary/70"
                      title={`Fusionner "${b.title}" dans "${other.title}"`}
                    >
                      {isMerging === `${b.id}-${other.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><GitMerge className="h-3 w-3 mr-1" /> → {other.title.slice(0, 18)}{other.title.length > 18 ? "…" : ""}</>}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="pt-8 border-t border-primary/10 space-y-5">
        <div className="flex items-center gap-3">
          <GitMerge className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-headline italic">Lier deux fiches manuellement</h3>
        </div>
        <p className="text-xs italic opacity-50">Pour les cas où deux fiches sont la même œuvre sous des titres différents (ex. "Twisted Games Tome 2" et "Games").</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Fiche à retirer (doublon)</p>
            {linkSource ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5">
                <p className="flex-1 text-sm italic truncate">{linkSource.title}</p>
                <button onClick={() => setLinkSource(null)}><X className="h-4 w-4 opacity-40" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                <Input value={linkSourceSearch} onChange={(e) => setLinkSourceSearch(e.target.value)} placeholder="Chercher un titre..." className="h-11 pl-11 italic bg-white/40 rounded-xl border-none shadow-inner text-sm" />
                {linkSourceSearch.trim() && (
                  <div className="mt-2 rounded-xl border border-primary/5 bg-white/60 divide-y divide-primary/5 overflow-hidden">
                    {searchResults(linkSourceSearch).map((b) => (
                      <button key={b.id} onClick={() => { setLinkSource(b); setLinkSourceSearch(""); }} className="w-full text-left p-3 text-sm italic hover:bg-primary/5 truncate">{b.title} <span className="opacity-40">— {cleanAuthorName(b.author)}</span></button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Fiche à conserver</p>
            {linkTarget ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5">
                <p className="flex-1 text-sm italic truncate">{linkTarget.title}</p>
                <button onClick={() => setLinkTarget(null)}><X className="h-4 w-4 opacity-40" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                <Input value={linkTargetSearch} onChange={(e) => setLinkTargetSearch(e.target.value)} placeholder="Chercher un titre..." className="h-11 pl-11 italic bg-white/40 rounded-xl border-none shadow-inner text-sm" />
                {linkTargetSearch.trim() && (
                  <div className="mt-2 rounded-xl border border-primary/5 bg-white/60 divide-y divide-primary/5 overflow-hidden">
                    {searchResults(linkTargetSearch).map((b) => (
                      <button key={b.id} onClick={() => { setLinkTarget(b); setLinkTargetSearch(""); }} className="w-full text-left p-3 text-sm italic hover:bg-primary/5 truncate">{b.title} <span className="opacity-40">— {cleanAuthorName(b.author)}</span></button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {linkSource && linkTarget && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <p className="text-sm italic flex items-center gap-2"><span className="truncate max-w-[180px]">{linkSource.title}</span> <ArrowRight className="h-4 w-4 opacity-40" /> <span className="truncate max-w-[180px] font-bold">{linkTarget.title}</span></p>
            <Button onClick={() => mergeBooks(linkSource, linkTarget)} disabled={!!isMerging} className="h-11 rounded-xl bg-primary italic px-6">
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />} Fusionner
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
