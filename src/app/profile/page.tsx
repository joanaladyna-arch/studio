"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Settings, FileText, ChevronRight, TrendingUp, BookOpenCheck, Loader2 } from "lucide-react";
import { generateMonthlyReadingReport } from "@/ai/flows/ai-monthly-reading-report-flow";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await generateMonthlyReadingReport({
        month: "Octobre 2024",
        readingData: [
          { bookTitle: "L'élégance du hérisson", author: "Muriel Barbery", genre: "Roman", status: "completed", pagesOrDuration: "320 pages" },
          { bookTitle: "Le Petit Prince", author: "Saint-Exupéry", genre: "Classique", status: "completed", pagesOrDuration: "120 pages" }
        ],
        favoriteQuotes: ["Le bonheur est ce qui se trouve au fond d'un tiroir.", "On ne voit bien qu'avec le coeur."]
      });
      setReport(res);
      toast({ title: "Bilan généré !", description: "Votre rapport narratif est prêt." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la génération." });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarImage src="https://picsum.photos/seed/user/100/100" />
            <AvatarFallback>PL</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-headline">Léa Plume</h1>
            <p className="text-muted-foreground">Lectrice passionnée depuis 2018</p>
          </div>
        </div>
        <Button variant="outline" size="icon"><Settings className="h-5 w-5" /></Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-secondary/10 border-none">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-secondary" />
            <p className="text-2xl font-bold">142</p>
            <p className="text-xs text-muted-foreground">Livres au total</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-none">
          <CardContent className="pt-6 text-center">
            <BookOpenCheck className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">12</p>
            <p className="text-xs text-muted-foreground">Lus ce mois</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-none hidden md:block">
          <CardContent className="pt-6 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold">286</p>
            <p className="text-xs text-muted-foreground">Jours consécutifs</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-headline">Bilans Mensuels IA</h2>
          <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Nouveau bilan
          </Button>
        </div>

        {report ? (
          <Card className="border-none shadow-xl bg-gradient-to-br from-background to-primary/5">
            <CardHeader>
              <CardTitle className="font-headline italic text-primary">{report.reportTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{report.narrativeSummary}</p>
              <div className="grid gap-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Insights</h4>
                <div className="flex flex-wrap gap-2">
                  {report.keyInsights.map((insight: string, i: number) => (
                    <span key={i} className="text-xs bg-white/50 px-2 py-1 rounded border">{insight}</span>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t flex justify-between items-center">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Genre favori</p>
                    <p className="font-bold text-sm">{report.monthlyStats.mostReadGenre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pages lues</p>
                    <p className="font-bold text-sm">{report.monthlyStats.totalReadingUnits}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-primary">
                  Partager <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">Générez votre premier bilan narratif personnalisé.</p>
          </div>
        )}
      </section>
    </div>
  );
}