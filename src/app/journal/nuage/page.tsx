"use client";

import { useMemo, useRef, useState } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, orderBy, query } from "firebase/firestore";
import { ArrowLeft, Cloud, FileDown } from "lucide-react";
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
  "alors","puis","voilà","voila",
  "qu","c","d","l","m","n","j","s","t","y",
]);

const CLOUD_COLORS = ["#C07A40","#8A72C7","#7BAA6A","#5496B6","#E07098","#F0845A","#F5C400"];

export default function NuagePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const isAmbientDark = useAmbientDark();
  const cloudRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Toutes les notes
  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc"));
  }, [db, user]);
  const { data: entries = [] } = useCollection(entriesQuery);

  // Livres pour citations et avis
  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [] } = useCollection(booksQuery);

  // Calcul du nuage
  const wordFrequencies = useMemo(() => {
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

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([word, count], i) => ({ word, count, color: CLOUD_COLORS[i % CLOUD_COLORS.length] }));
  }, [entries, books]);

  const maxCount = wordFrequencies[0]?.count || 1;
  const getSize = (count: number) => {
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.round(13 + ratio * 44);
  };

  // Export PDF
  const exportPDF = async () => {
    if (!cloudRef.current || wordFrequencies.length === 0) {
      toast({ title: "Pas encore assez de notes pour générer le nuage" }); return;
    }
    setIsExporting(true);
    try {
      const { toPng }  = await import("html-to-image");
      const { jsPDF }  = await import("jspdf");
      const imgData    = await toPng(cloudRef.current, { pixelRatio: 2 });
      const doc        = new (jsPDF as any)("landscape", "mm", "a4");
      doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text("Mon Nuage des Mots", 20, 18);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Lectoria — ${new Date().toLocaleDateString("fr-FR")} — ${wordFrequencies.length} mots`, 20, 27);
      doc.addImage(imgData, "PNG", 15, 33, 265, 164);
      doc.save("nuage-des-mots-lectoria.pdf");
      toast({ title: "PDF téléchargé ✓" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur export PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Journal
        </Link>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <header>
          <h1 className={cn("text-3xl sm:text-4xl font-headline italic", isAmbientDark && "text-[#F5F1E8]")}>
            Nuage des mots
          </h1>
          <p className={cn("italic font-medium text-sm mt-1", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>
            {wordFrequencies.length > 0
              ? `${wordFrequencies.length} mots distincts — construit depuis vos notes, citations et avis`
              : "Commencez à prendre des notes pour voir votre nuage apparaître"}
          </p>
        </header>
        <button onClick={exportPDF} disabled={isExporting || wordFrequencies.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary/20 bg-white/40 text-primary/60 hover:bg-primary/5 transition-all disabled:opacity-40">
          <FileDown className="h-4 w-4" /> {isExporting ? "Export…" : "Télécharger PDF"}
        </button>
      </div>

      {/* Nuage */}
      {wordFrequencies.length > 0 ? (
        <div ref={cloudRef}
          className="p-8 rounded-[2rem] bg-white/70 glass-card border-none shadow-sm min-h-[400px] flex flex-wrap gap-x-6 gap-y-4 items-center justify-center">
          {wordFrequencies.map(({ word, count, color }, i) => (
            <span key={word}
              style={{
                fontSize: getSize(count),
                color,
                opacity: 0.55 + (count / maxCount) * 0.45,
                fontStyle: i % 3 === 0 ? "italic" : "normal",
                fontWeight: count > maxCount * 0.6 ? 700 : count > maxCount * 0.3 ? 500 : 400,
                lineHeight: 1.2,
              }}
              className="font-headline cursor-default select-none transition-opacity hover:opacity-100"
              title={`${count} occurrence${count > 1 ? "s" : ""}`}
            >
              {word}
            </span>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center glass-card rounded-[2rem] border-dashed border-primary/20 bg-white/20">
          <Cloud className="h-14 w-14 mx-auto text-primary/20 mb-6" />
          <p className="italic text-muted-foreground">
            Prenez des notes depuis la page{" "}
            <Link href="/journal/notes" className="text-primary underline underline-offset-2">Mes notes de lecture</Link>
            {" "}pour voir votre nuage de mots se construire ici.
          </p>
        </div>
      )}
    </div>
  );
}
