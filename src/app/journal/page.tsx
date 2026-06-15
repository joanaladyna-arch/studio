"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Quote, Send, Loader2, Sparkles, Wand2 } from "lucide-react";
import { aiNoteSummarization } from "@/ai/flows/ai-note-summarization-flow";
import { aiLiteraryAdvisor } from "@/ai/flows/ai-literary-advisor-flow";
import { useToast } from "@/hooks/use-toast";

export default function JournalPage() {
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ summary?: string, quotes?: string[], questions?: string[] } | null>(null);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!notes) return;
    setIsLoading(true);
    try {
      const result = await aiNoteSummarization({ notes });
      setAiResult({ summary: result.summary, quotes: result.thematicQuotes });
      toast({ title: "Synthèse terminée !", description: "L'IA a transformé vos notes." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer la synthèse." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAdvice = async () => {
    setIsLoading(true);
    try {
      const result = await aiLiteraryAdvisor({
        bookTitle: "L'élégance du hérisson",
        bookAuthor: "Muriel Barbery",
        bookGenre: "Roman Contemporain"
      });
      setAiResult(prev => ({ ...prev, questions: result.reflectionQuestions }));
    } catch (error) {
       toast({ variant: "destructive", title: "Erreur", description: "Impossible de contacter votre conseiller." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-headline">Journal Intime</h1>
          <p className="text-muted-foreground">Capturez vos émotions et laissez l'IA les sublimer.</p>
        </div>
        <Brain className="h-10 w-10 text-primary opacity-50" />
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Card className="glass-card shadow-lg border-none">
            <CardHeader>
              <CardTitle className="text-lg">Mes notes brutes</CardTitle>
              <CardDescription>Écrivez vos pensées, citations favorites ou questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Renee est une concierge cultivée qui se cache... J'aime l'idée que la beauté se trouve dans les détails." 
                className="min-h-[300px] bg-white/50 resize-none border-none focus-visible:ring-primary shadow-inner"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleSummarize} 
                  disabled={isLoading || !notes} 
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Synthétiser avec l'IA
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleGetAdvice}
                  className="border-primary text-primary hover:bg-primary/5"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {aiResult ? (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              {aiResult.summary && (
                <Card className="bg-chart-4 shadow-sm border-none rotate-1">
                  <CardHeader>
                    <CardTitle className="text-base font-headline">Synthèse Personnelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed italic">{aiResult.summary}</p>
                  </CardContent>
                </Card>
              )}

              {aiResult.quotes && aiResult.quotes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-headline text-lg flex items-center gap-2">
                    <Quote className="h-4 w-4 text-accent" /> Citations clés
                  </h3>
                  {aiResult.quotes.map((q, i) => (
                    <div key={i} className="bg-white/60 p-3 rounded-lg border-l-4 border-accent text-sm">
                      "{q}"
                    </div>
                  ))}
                </div>
              )}

              {aiResult.questions && (
                <div className="space-y-3">
                  <h3 className="font-headline text-lg">Pistes de réflexion</h3>
                  <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/30">
                    <ul className="space-y-4">
                      {aiResult.questions.map((q, i) => (
                        <li key={i} className="text-sm flex gap-3">
                          <span className="text-primary font-bold">{i+1}.</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30 gap-4 border-2 border-dashed rounded-3xl">
              <Sparkles className="h-12 w-12" />
              <p className="text-sm font-medium">Votre espace de réflexion IA apparaîtra ici après avoir rédigé vos notes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}