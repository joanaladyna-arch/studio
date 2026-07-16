
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Headphones, FileText, Target, BarChart3, Clock, Star, Landmark, Download, Loader2, Feather, UserRound, Gauge, DoorOpen } from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { FORMATS, RANKS } from "@/app/library/page";

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
    const totalPages = books.reduce((acc, b: any) => {
      const isAudio = ['audio', 'audible', 'audiolib'].includes(b.format || '');
      return acc + (isAudio ? 0 : (Number(b.pagesRead) || 0));
    }, 0);
    // Coups de cœur : même champ que la page Coups de Cœur (plumeRank),
    // pas "favorite"/"dePlume" qui n'existent nulle part dans l'app —
    // c'était la cause du 0 permanent malgré des livres réellement notés.
    const favorites = books.filter((b: any) => b.plumeRank && b.plumeRank !== "dnf").length;
    // Heures d'écoute : champ dédié audioHoursListened, saisi
    // directement en heures — avant ce correctif, division par 50 d'un
    // champ (pagesRead) jamais rempli pour les livres audio, d'où les
    // 0h systématiques remontés en retour bêta.
    const audioHours = Math.round(
      books.reduce((acc, b: any) => acc + (['audio', 'audible', 'audiolib'].includes(b.format || '') ? (Number(b.audioHoursListened) || 0) : 0), 0)
    );

    // Most read publisher
    const publisherCounts: Record<string, number> = {};
    read.forEach(b => {
      if (b.publisher) {
        publisherCounts[b.publisher] = (publisherCounts[b.publisher] || 0) + 1;
      }
    });
    const topPublisher = Object.entries(publisherCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucun";

    // Genre dominant — comptabilise chaque genre présent sur les livres
    // lus (un livre peut cumuler plusieurs genres, chacun compte pour lui).
    const genreCounts: Record<string, number> = {};
    read.forEach((b: any) => {
      (Array.isArray(b.genres) ? b.genres : []).forEach((g: string) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucun";

    // Auteur le plus lu
    const authorCounts: Record<string, number> = {};
    read.forEach((b: any) => {
      if (b.author) authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
    });
    const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucun";

    // Format préféré
    const formatCounts: Record<string, number> = {};
    read.forEach((b: any) => {
      if (b.format) formatCounts[b.format] = (formatCounts[b.format] || 0) + 1;
    });
    const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Aucun";

    // Rythme de lecture — moyenne mensuelle depuis le premier livre marqué
    // lu, pour donner un rythme réaliste plutôt qu'une simple division par
    // 12 qui pénaliserait une lectrice arrivée en cours d'année.
    //
    // Priorité de date : date de fin de lecture, puis date de début,
    // puis dateRead (champ historique). dateAdded (date d'AJOUT à la
    // bibliothèque, pas de lecture) ne sert de dernier repli que pour
    // les livres non exclus des objectifs — sinon un import groupé
    // (ex. tout un historique ajouté le même mois) gonflerait à tort
    // ce mois-là dans le graphique de régularité, alors qu'aucun de ces
    // livres n'a forcément été lu à ce moment précis.
    const readDates = read
      .map((b: any) => {
        const excluded = b.countTowardGoals === false;
        const genuineDate = b.readEndDate || b.readStartDate || b.dateRead;
        const raw = genuineDate || (excluded ? null : b.dateAdded);
        if (!raw) return null;
        const d = raw?.toDate ? raw.toDate() : new Date(raw);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter(Boolean) as Date[];
    let monthlyPace = 0;
    if (readDates.length > 0) {
      const earliest = new Date(Math.min(...readDates.map(d => d.getTime())));
      const now = new Date();
      const monthsElapsed = Math.max(1, (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1);
      monthlyPace = Math.round((read.length / monthsElapsed) * 10) / 10;
    }

    // Répartition des 6 derniers mois — alimente le petit graphique du
    // bilan, pour visualiser la régularité plutôt qu'un seul total.
    const now = new Date();
    const monthlyBreakdown = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      const count = readDates.filter(rd => rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()).length;
      return { month: label, livres: count };
    });

    // Compteur dédié à l'Objectif Annuel : exclut les livres marqués
    // "Retirer des objectifs" depuis la Bibliothèque, ET ne compte que
    // les livres lus PENDANT L'ANNÉE EN COURS (pas tout l'historique) —
    // c'était le bug précis remonté : le compteur incluait à tort des
    // livres lus les années précédentes. Priorité de date identique au
    // reste de l'app : fin > début > dateRead > dateAdded (ce dernier
    // uniquement pour les livres non exclus).
    const currentYear = new Date().getFullYear();
    const goalEligibleReadCount = read.filter((b: any) => {
      if (b.countTowardGoals === false) return false;
      const raw = b.readEndDate || b.readStartDate || b.dateRead || b.dateAdded;
      if (!raw) return false;
      const d = raw?.toDate ? raw.toDate() : new Date(raw);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    }).length;

    return {
      readCount: read.length,
      goalEligibleReadCount,
      progressCount: progress.length,
      dnfCount: dnf.length,
      totalPages,
      favorites,
      topPublisher,
      topGenre,
      topAuthor,
      topFormat,
      monthlyPace,
      audioHours,
      monthlyBreakdown,
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
      const progressPct = Math.round((stats.goalEligibleReadCount / (annualGoal || 1)) * 100);

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
        ["Objectif annuel", `${stats.goalEligibleReadCount} / ${annualGoal} (${progressPct}%)`],
        ["Rythme de lecture", `${stats.monthlyPace} livre(s)/mois`],
        ["Pages parcourues", stats.totalPages.toLocaleString("fr-FR")],
        ["Genre dominant", stats.topGenre],
        ["Auteur le plus lu", stats.topAuthor],
        ["Format préféré", stats.topFormat],
        ["Maison d'édition favorite", stats.topPublisher],
        ["Coups de cœur", String(stats.favorites)],
        ["Lectures en cours", String(stats.progressCount)],
        ["Abandons (DNF)", String(stats.dnfCount)],
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
    { label: "Pages parcourues", value: stats.totalPages.toLocaleString(), icon: FileText, color: "text-copper", bg: "bg-copper/5" },
    { label: "Rythme de lecture", value: `${stats.monthlyPace}/mois`, icon: Gauge, color: "text-rose", bg: "bg-rose/5" },
    { label: "Genre dominant", value: stats.topGenre, icon: Feather, color: "text-primary", bg: "bg-primary/5" },
    { label: "Auteur le plus lu", value: stats.topAuthor, icon: UserRound, color: "text-copper", bg: "bg-copper/5" },
    { label: "Format préféré", value: FORMATS[stats.topFormat as keyof typeof FORMATS]?.label || stats.topFormat, icon: Headphones, color: "text-rose", bg: "bg-rose/5" },
    { label: "Maison d'édition favorite", value: stats.topPublisher, icon: Landmark, color: "text-primary", bg: "bg-primary/5" },
    { label: "DNF", value: stats.dnfCount, icon: DoorOpen, color: "text-copper", bg: "bg-copper/5" },
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
          <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                    <p className="text-4xl font-headline italic">{stats.goalEligibleReadCount} / {annualGoal}</p>
                    <p className="text-xs text-muted-foreground italic">Livres terminés en {new Date().getFullYear()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-headline text-primary italic">{Math.round((stats.goalEligibleReadCount / annualGoal) * 100)}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40">Complété</p>
                  </div>
                </div>
                <Progress value={(stats.goalEligibleReadCount / annualGoal) * 100} className="h-3 bg-primary/5" indicatorClassName="bg-copper" />
                <p className="text-center text-xs text-muted-foreground italic pt-4">
                  {stats.goalEligibleReadCount >= annualGoal 
                    ? "Félicitations ! Votre objectif est atteint." 
                    : `Encore ${annualGoal - stats.goalEligibleReadCount} pépites à découvrir pour atteindre votre but.`}
                </p>
              </div>
            </Card>

            <Card className="glass-card p-8 border-none shadow-sm flex flex-col justify-center text-center space-y-6">
               <div className="space-y-2">
                  <Star className="h-10 w-10 mx-auto text-copper" />
                  <h3 className="text-xl font-headline italic">Coups de cœur</h3>
                  <p className="text-4xl font-headline italic text-primary/80">{stats.favorites}</p>
                  <p className="text-xs text-muted-foreground italic">Lectures gravées dans votre cœur de lectrice.</p>
               </div>
               <div className="pt-6 border-t border-primary/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Statistiques basées sur vos pépites personnelles</p>
               </div>
            </Card>
          </section>

          <section>
            <Card className="glass-card p-8 border-none shadow-sm space-y-6">
              <h2 className="text-2xl font-headline flex items-center gap-3 italic">
                <BarChart3 className="h-6 w-6 text-primary/40" /> Régularité — 6 derniers mois
              </h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyBreakdown}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(213 12% 42%)" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(36 22% 90%)" }}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <Bar dataKey="livres" fill="hsl(28 33% 47%)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
