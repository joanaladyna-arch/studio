
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Headphones, FileText, Target, BarChart3, Clock, Star, Landmark, Download, Loader2 } from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";

export default function StatsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const stats = useMemo(() => {
    const read = books.filter(b => b.status === 'read' || b.status === 'reread');
    const progress = books.filter(b => b.status === 'progress');
    const dnf = books.filter(b => b.status === 'dnf');
    const totalPages = books.reduce((acc, b) => acc + (b.pagesRead || 0), 0);
    const favorites = books.filter(b => b.favorite || b.dePlume).length;
    
    // Most read publisher
    const publisherCounts: Record<string, number> = {};
    read.forEach(b => {
      if (b.publisher) {
        publisherCounts[b.publisher] = (publisherCounts[b.publisher] || 0) + 1;
      }
    });
    const topPublisher = Object.entries(publisherCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucun";

    return {
      readCount: read.length,
      progressCount: progress.length,
      dnfCount: dnf.length,
      totalPages,
      favorites,
      topPublisher
    };
  }, [books]);

  const annualGoal = profile?.annualGoal || 24;
  const userName = profile?.name || user?.displayName || "Lectrice Lectoria";
  const [isExporting, setIsExporting] = useState(false);

  // jsPDF est chargé dynamiquement (import() plutôt qu'en haut de
  // fichier) : c'est une librairie assez lourde, inutile de l'inclure
  // dans le bundle de la page tant que l'utilisatrice n'a pas
  // explicitement demandé son bilan en PDF.
  const exportPdf = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const docPdf = new jsPDF();
      const year = new Date().getFullYear();
      const progressPct = Math.round((stats.readCount / (annualGoal || 1)) * 100);

      docPdf.setFont("helvetica", "italic");
      docPdf.setFontSize(11);
      docPdf.setTextColor(150, 120, 140);
      docPdf.text("LECTORIA", 105, 20, { align: "center" });

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(24);
      docPdf.setTextColor(40, 30, 40);
      docPdf.text(`Mon année de lecture ${year}`, 105, 35, { align: "center" });

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(13);
      docPdf.setTextColor(90, 80, 90);
      docPdf.text(userName, 105, 45, { align: "center" });

      const lines: [string, string][] = [
        ["Livres lus", String(stats.readCount)],
        ["Objectif annuel", `${stats.readCount} / ${annualGoal} (${progressPct}%)`],
        ["Pages parcourues", stats.totalPages.toLocaleString("fr-FR")],
        ["Maison d'édition favorite", stats.topPublisher],
        ["Coups de cœur", String(stats.favorites)],
        ["Lectures en cours", String(stats.progressCount)],
      ];

      let y = 70;
      lines.forEach(([label, value]) => {
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(11);
        docPdf.setTextColor(120, 110, 120);
        docPdf.text(label, 30, y);
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(14);
        docPdf.setTextColor(40, 30, 40);
        docPdf.text(value, 180, y, { align: "right" });
        docPdf.setDrawColor(230, 220, 225);
        docPdf.line(30, y + 4, 180, y + 4);
        y += 16;
      });

      docPdf.setFont("helvetica", "italic");
      docPdf.setFontSize(9);
      docPdf.setTextColor(180, 170, 180);
      docPdf.text("Généré depuis Lectoria, votre journal de lecture.", 105, 280, { align: "center" });

      docPdf.save(`bilan-lecture-${year}.pdf`);
    } catch (err) {
      console.error("Export PDF Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const cards = [
    { label: "Livres lus", value: stats.readCount, icon: BookOpen, color: "text-primary", bg: "bg-primary/5" },
    { label: "Pages parcourues", value: stats.totalPages.toLocaleString(), icon: FileText, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Maison d'édition favorite", value: stats.topPublisher, icon: Landmark, color: "text-indigo-500", bg: "bg-indigo-50" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-24">
      <header className="text-center space-y-4 pt-8">
        <h1 className="text-5xl font-headline italic">Bilan de lecture</h1>
        <p className="text-primary/60 italic font-medium">L'analyse douce de votre voyage littéraire.</p>
        <Button onClick={exportPdf} disabled={isExporting || loading} variant="outline" className="rounded-2xl border-primary/20 text-primary italic font-headline h-12 px-6">
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exporter en PDF
        </Button>
      </header>

      {loading ? (
        <div className="py-20 text-center italic text-muted-foreground">Analyse de votre bibliothèque en cours...</div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((card, i) => (
              <Card key={i} className="glass-card border-none shadow-sm group hover:shadow-md transition-all">
                <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
                  <div className={`p-4 rounded-[1.5rem] ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-headline italic line-clamp-1 px-4">{card.value}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">{card.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid md:grid-cols-2 gap-8">
            <Card className="glass-card p-8 border-none shadow-sm space-y-6">
              <h2 className="text-2xl font-headline flex items-center gap-3 italic">
                <Target className="h-6 w-6 text-primary/40" /> Objectif Annuel
              </h2>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-4xl font-headline italic">{stats.readCount} / {annualGoal}</p>
                    <p className="text-xs text-muted-foreground italic">Livres terminés en {new Date().getFullYear()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-headline text-primary italic">{Math.round((stats.readCount / annualGoal) * 100)}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40">Complété</p>
                  </div>
                </div>
                <Progress value={(stats.readCount / annualGoal) * 100} className="h-3 bg-primary/5" />
                <p className="text-center text-xs text-muted-foreground italic pt-4">
                  {stats.readCount >= annualGoal 
                    ? "Félicitations ! Votre objectif est atteint." 
                    : `Encore ${annualGoal - stats.readCount} pépites à découvrir pour atteindre votre but.`}
                </p>
              </div>
            </Card>

            <Card className="glass-card p-8 border-none shadow-sm flex flex-col justify-center text-center space-y-6">
               <div className="space-y-2">
                  <Star className="h-10 w-10 mx-auto text-amber-300" />
                  <h3 className="text-xl font-headline italic">Coups de cœur</h3>
                  <p className="text-4xl font-headline italic text-primary/80">{stats.favorites}</p>
                  <p className="text-xs text-muted-foreground italic">Lectures gravées dans votre cœur de lectrice.</p>
               </div>
               <div className="pt-6 border-t border-primary/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Statistiques basées sur vos pépites personnelles</p>
               </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
