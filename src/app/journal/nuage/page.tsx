"use client";

import { useMemo, useRef, useState } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { useUser, useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, doc, addDoc, deleteDoc, updateDoc, orderBy, query, serverTimestamp, arrayUnion } from "firebase/firestore";
import { ArrowLeft, Cloud, FileDown, Plus, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const FR_STOP = new Set([
  "le","la","les","de","du","des","un","une","et","en","au","aux","à","a",
  "je","il","elle","ils","elles","nous","vous","on","me","te","se","lui",
  "mon","ma","mes","ton","ta","tes","son","sa","ses","notre","nos","leur","leurs",
  "ce","cet","cette","ces","cela","ceci","ça","ca",
  "qui","que","quoi","dont","où","quand","comment","pourquoi",
  "plus","très","bien","tout","tous","toute","toutes","mais","ou","donc","ni","car",
  "ne","pas","rien","jamais","aussi","ainsi","si","comme",
  "avec","pour","sur","dans","par","sans","sous","entre","vers","chez",
  "après","avant","pendant","depuis","lors","même",
  "est","sont","était","étaient","être","avoir","fait","faire","dit","dire",
  "peut","vais","aller","suis","ai","ont","avait","été","vas","va",
  "alors","puis","voilà","voila","qu","c","d","l","m","n","j","s","t","y",
]);

const CLOUD_COLORS = ["#C07A40","#8A72C7","#7BAA6A","#5496B6","#E07098","#F0845A","#F5C400"];

export default function NuagePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();
  const cloudRef = useRef<HTMLDivElement>(null);

  const [wordInput, setWordInput]     = useState("");
  const [isAdding, setIsAdding]       = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Profil (mots auto supprimés)
  const profileRef = useMemo(() => db && user ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc(profileRef);
  const deletedAutoWords = useMemo(() => new Set<string>(profile?.nuageDeletedWords || []), [profile]);

  // Mots ajoutés manuellement
  const manualQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "nuageWords"), orderBy("addedAt", "desc"));
  }, [db, user]);
  const { data: manualWords = [] } = useCollection(manualQuery);

  // Notes + livres pour le nuage auto
  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc"));
  }, [db, user]);
  const { data: entries = [] } = useCollection(entriesQuery);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [] } = useCollection(booksQuery);

  // Fréquences auto
  const autoFrequencies = useMemo(() => {
    const texts = [
      ...(entries as any[]).map(e => e.content || ""),
      ...(books as any[]).filter(b => b.favoriteQuote).map(b => b.favoriteQuote || ""),
      ...(books as any[]).filter(b => (b as any).review).map(b => (b as any).review || ""),
    ].join(" ");

    const words = texts
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûüç\s'-]/g, " ")
      .split(/\s+/)
      .map(w => w.replace(/^[-']+|[-']+$/g, ""))
      .filter(w => w.length > 3 && !FR_STOP.has(w));

    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return freq;
  }, [entries, books]);

  // Nuage combiné
  const cloudWords = useMemo(() => {
    const manualSet = new Set((manualWords as any[]).map((m: any) => m.word));
    const maxAuto   = Math.max(...Object.values(autoFrequencies), 1);
    const meanAuto  = Math.round(maxAuto * 0.45);

    const auto = Object.entries(autoFrequencies)
      .filter(([w]) => !deletedAutoWords.has(w) && !manualSet.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([word, count], i) => ({ word, count, color: CLOUD_COLORS[i % CLOUD_COLORS.length], isManual: false, id: null as string | null }));

    const manual = (manualWords as any[]).map((m: any, i: number) => ({
      word: m.word,
      count: meanAuto,
      color: m.color || CLOUD_COLORS[(auto.length + i) % CLOUD_COLORS.length],
      isManual: true,
      id: m.id as string,
    }));

    return [...manual, ...auto];
  }, [autoFrequencies, manualWords, deletedAutoWords]);

  const maxCount = Math.max(...cloudWords.map(w => w.count), 1);
  const getSize = (count: number) => {
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.round(13 + ratio * 44);
  };

  // ── Ajouter un mot ────────────────────────────────────────────────────
  const addWord = async () => {
    const word = wordInput.trim().toLowerCase();
    if (!word || !db || !user) return;
    if (cloudWords.some(w => w.word === word)) {
      toast({ title: `"${word}" est déjà dans le nuage` }); return;
    }
    setIsAdding(true);
    try {
      await addDoc(collection(db, "users", user.uid, "nuageWords"), {
        word,
        color: CLOUD_COLORS[manualWords.length % CLOUD_COLORS.length],
        addedAt: serverTimestamp(),
      });
      setWordInput("");
      toast({ title: `"${word}" ajouté au nuage` });
    } catch {
      toast({ variant: "destructive", title: "Erreur d'ajout" });
    } finally {
      setIsAdding(false);
    }
  };

  // ── Supprimer un mot ──────────────────────────────────────────────────
  const deleteWord = async (word: string, isManual: boolean, id: string | null) => {
    if (!db || !user) return;
    try {
      if (isManual && id) {
        await deleteDoc(doc(db, "users", user.uid, "nuageWords", id));
      } else if (profileRef) {
        await updateDoc(profileRef, { nuageDeletedWords: arrayUnion(word) });
      }
      toast({ title: `"${word}" retiré` });
    } catch {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  // ── Export PDF ────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!cloudRef.current || cloudWords.length === 0) {
      toast({ title: "Pas encore assez de mots" }); return;
    }
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const imgData = await toPng(cloudRef.current, { pixelRatio: 2 });
      const doc = new (jsPDF as any)("landscape", "mm", "a4");
      doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text("Mon Nuage des Mots", 20, 18);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")} — ${cloudWords.length} mots`, 20, 27);
      doc.addImage(imgData, "PNG", 15, 33, 265, 164);
      doc.save("nuage-des-mots-lectoria.pdf");
      toast({ title: "PDF téléchargé ✓" });
    } catch {
      toast({ variant: "destructive", title: "Erreur export PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="pt-2">
        <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Journal
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <header>
          <h1 className={cn("text-3xl sm:text-4xl font-headline italic", isAmbientDark && "text-[#F5F1E8]")}>
            Nuage des mots
          </h1>
          <p className={cn("italic font-medium text-sm mt-1", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>
            {cloudWords.length > 0 ? `${cloudWords.length} mots — survolez pour supprimer` : "Ajoutez des mots ou prenez des notes"}
          </p>
        </header>
        <button onClick={exportPDF} disabled={isExporting || cloudWords.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary/20 bg-white/40 text-primary/60 hover:bg-primary/5 transition-all disabled:opacity-40">
          <FileDown className="h-4 w-4" /> {isExporting ? "Export…" : "PDF"}
        </button>
      </div>

      {/* Ajouter un mot */}
      <div className="flex gap-2">
        <input value={wordInput} onChange={e => setWordInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addWord()}
          placeholder="Ajouter un mot au nuage…"
          className="flex-1 h-12 px-4 rounded-2xl bg-white/60 glass-card border-none shadow-sm italic text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button onClick={addWord} disabled={isAdding || !wordInput.trim()}
          className="h-12 px-5 rounded-2xl bg-primary text-white font-headline italic text-sm shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>

      {/* Nuage */}
      {cloudWords.length > 0 ? (
        <div ref={cloudRef}
          className="p-8 rounded-[2rem] bg-white/70 glass-card border-none shadow-sm min-h-[350px] flex flex-wrap gap-x-6 gap-y-4 items-center justify-center">
          {cloudWords.map((entry) => (
            <div key={entry.word} className="relative group/word inline-flex items-center">
              <span
                style={{
                  fontSize: getSize(entry.count),
                  color: entry.color,
                  opacity: 0.55 + (entry.count / maxCount) * 0.45,
                  fontStyle: entry.isManual ? "italic" : entry.word.length % 3 === 0 ? "italic" : "normal",
                  fontWeight: entry.count > maxCount * 0.6 ? 700 : entry.count > maxCount * 0.3 ? 500 : 400,
                  lineHeight: 1.2,
                  textDecoration: entry.isManual ? "underline dotted" : "none",
                  textUnderlineOffset: "3px",
                }}
                className="font-headline select-none cursor-default"
              >
                {entry.word}
              </span>
              <button
                onClick={() => deleteWord(entry.word, entry.isManual, entry.id)}
                className="absolute -top-2 -right-3 h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground opacity-0 group-hover/word:opacity-100 hover:text-destructive hover:bg-red-50 transition-all z-10"
                title="Retirer du nuage"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center glass-card rounded-[2rem] border-dashed border-primary/20 bg-white/20">
          <Cloud className="h-14 w-14 mx-auto text-primary/20 mb-6" />
          <p className="italic text-muted-foreground">
            Ajoutez un mot ci-dessus ou prenez des{" "}
            <Link href="/journal/notes" className="text-primary underline underline-offset-2">notes de lecture</Link>
            {" "}pour construire votre nuage.
          </p>
        </div>
      )}

      {cloudWords.length > 0 && (
        <p className="text-[10px] text-center opacity-35 italic">
          Mots soulignés = ajoutés manuellement · Survolez un mot pour le supprimer
        </p>
      )}
    </div>
  );
}
