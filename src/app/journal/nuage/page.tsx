"use client";

import { useMemo, useRef, useState } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, doc, addDoc, deleteDoc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Cloud, FileDown, Plus, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CLOUD_COLORS = ["#C07A40","#8A72C7","#7BAA6A","#5496B6","#E07098","#F0845A","#F5C400","#B06030","#5B8DD9","#E8A838"];

export default function NuagePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();
  const cloudRef = useRef<HTMLDivElement>(null);

  const [wordInput, setWordInput]     = useState("");
  const [isAdding, setIsAdding]       = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Mots ajoutés manuellement uniquement
  const manualQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "nuageWords"), orderBy("addedAt", "desc"));
  }, [db, user]);
  const { data: manualWords = [] } = useCollection(manualQuery);

  // Taille proportionnelle à l'ordre d'ajout (les premiers = plus gros)
  const total = manualWords.length;
  const getSize = (index: number) => {
    if (total <= 1) return 32;
    const ratio = 1 - (index / (total - 1)) * 0.6; // 100% → 40%
    return Math.round(14 + ratio * 34); // 14px → 48px
  };

  // ── Ajouter un mot ────────────────────────────────────────────────────
  const addWord = async () => {
    const word = wordInput.trim().toLowerCase();
    if (!word || !db || !user) return;
    if ((manualWords as any[]).some((m: any) => m.word === word)) {
      toast({ title: `"${word}" est déjà dans ton nuage` }); return;
    }
    setIsAdding(true);
    try {
      await addDoc(collection(db, "users", user.uid, "nuageWords"), {
        word,
        color: CLOUD_COLORS[manualWords.length % CLOUD_COLORS.length],
        addedAt: serverTimestamp(),
      });
      setWordInput("");
      toast({ title: `"${word}" ajouté` });
    } catch {
      toast({ variant: "destructive", title: "Erreur d'ajout" });
    } finally {
      setIsAdding(false);
    }
  };

  // ── Supprimer un mot ──────────────────────────────────────────────────
  const deleteWord = async (id: string, word: string) => {
    if (!db || !user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "nuageWords", id));
      toast({ title: `"${word}" retiré` });
    } catch {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  // ── Export PDF ────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!cloudRef.current || manualWords.length === 0) {
      toast({ title: "Aucun mot dans le nuage" }); return;
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
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")} — ${manualWords.length} mots`, 20, 27);
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
            {manualWords.length > 0
              ? `${manualWords.length} mot${manualWords.length > 1 ? "s" : ""} — survolez pour supprimer`
              : "Ajoute les mots qui comptent pour toi"}
          </p>
        </header>
        <button onClick={exportPDF} disabled={isExporting || manualWords.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary/20 bg-white/40 text-primary/60 hover:bg-primary/5 transition-all disabled:opacity-40">
          <FileDown className="h-4 w-4" /> {isExporting ? "Export…" : "PDF"}
        </button>
      </div>

      {/* Ajouter un mot */}
      <div className="flex gap-2">
        <input
          value={wordInput}
          onChange={e => setWordInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addWord()}
          placeholder="Ajoute un mot à ton nuage…"
          className="flex-1 h-12 px-4 rounded-2xl bg-white/60 glass-card border-none shadow-sm italic text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button onClick={addWord} disabled={isAdding || !wordInput.trim()}
          className="h-12 px-5 rounded-2xl bg-primary text-white font-headline italic text-sm shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>

      {/* Nuage */}
      {manualWords.length > 0 ? (
        <div ref={cloudRef}
          className="p-6 sm:p-10 rounded-[2rem] bg-white/70 glass-card border-none shadow-sm min-h-[300px] flex flex-wrap gap-x-5 sm:gap-x-8 gap-y-4 sm:gap-y-5 items-center justify-center">
          {(manualWords as any[]).map((m: any, i: number) => (
            <div key={m.id} className="relative group/word inline-flex items-center">
              <span
                style={{
                  fontSize: getSize(i),
                  color: m.color || CLOUD_COLORS[i % CLOUD_COLORS.length],
                  fontWeight: i < 3 ? 700 : i < 8 ? 500 : 400,
                  fontStyle: i % 4 === 2 ? "italic" : "normal",
                  lineHeight: 1.2,
                }}
                className="font-headline select-none cursor-default"
              >
                {m.word}
              </span>
              {/* X — visible sur mobile, hover sur desktop */}
              <button
                onClick={() => deleteWord(m.id, m.word)}
                className="absolute -top-2 -right-3 h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground opacity-100 md:opacity-0 md:group-hover/word:opacity-100 hover:text-destructive hover:bg-red-50 transition-all z-10"
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
            Commence à ajouter des mots pour construire ton nuage personnel.
          </p>
        </div>
      )}

      {manualWords.length > 0 && (
        <p className="text-[10px] text-center opacity-35 italic">
          Survolez un mot pour le supprimer · Les premiers mots ajoutés apparaissent en plus grand
        </p>
      )}
    </div>
  );
}
