"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, Headset, Save, History, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JournalPage() {
  const [readingNotes, setReadingNotes] = useState("");
  const [listeningNotes, setListeningNotes] = useState("");
  const { toast } = useToast();

  const handleSaveNote = (type: 'lecture' | 'écoute') => {
    toast({
      title: "Note enregistrée",
      description: `Votre réflexion de ${type} a été ajoutée à votre journal historique.`,
    });
    if (type === 'lecture') setReadingNotes("");
    else setListeningNotes("");
  };

  const pastEntries = [
    { date: "15 Oct 2024", type: "lecture", title: "L'élégance du hérisson", content: "La métaphore du hérisson est vraiment touchante. J'ai aimé la double narration." },
    { date: "12 Oct 2024", type: "écoute", title: "Sapiens (Audiobook)", content: "La partie sur la révolution cognitive est fascinante. Très bien lu." },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline">Journal de bord</h1>
        <p className="text-muted-foreground">Capturez vos émotions de lecture et d'écoute au fil de l'eau.</p>
      </header>

      <Tabs defaultValue="reading" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="reading" className="flex gap-2">
            <BookOpen className="h-4 w-4" /> Journal de Lecture
          </TabsTrigger>
          <TabsTrigger value="listening" className="flex gap-2">
            <Headset className="h-4 w-4" /> Journal d'Écoute
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reading">
          <Card className="glass-card shadow-lg border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Nouvelle entrée de lecture
              </CardTitle>
              <CardDescription>Quel livre lisez-vous en ce moment ?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Renee est une concierge cultivée qui se cache... J'aime l'idée que la beauté se trouve dans les détails." 
                className="min-h-[200px] bg-white/50 resize-none border-none focus-visible:ring-primary shadow-inner"
                value={readingNotes}
                onChange={(e) => setReadingNotes(e.target.value)}
              />
              <Button 
                onClick={() => handleSaveNote('lecture')} 
                disabled={!readingNotes}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Enregistrer la note
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listening">
          <Card className="glass-card shadow-lg border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent" /> Nouvelle entrée d'écoute
              </CardTitle>
              <CardDescription>Podcast ou livre audio, notez vos impressions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Le narrateur a une voix très apaisante. Les arguments sur l'histoire humaine sont percutants..." 
                className="min-h-[200px] bg-white/50 resize-none border-none focus-visible:ring-accent shadow-inner"
                value={listeningNotes}
                onChange={(e) => setListeningNotes(e.target.value)}
              />
              <Button 
                onClick={() => handleSaveNote('écoute')} 
                disabled={!listeningNotes}
                className="w-full bg-accent hover:bg-accent/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Enregistrer l'écoute
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <section className="space-y-4 pt-4">
        <h2 className="text-2xl font-headline flex items-center gap-2">
          <History className="h-6 w-6 text-muted-foreground" /> Entrées récentes
        </h2>
        <div className="space-y-4">
          {pastEntries.map((entry, i) => (
            <Card key={i} className="bg-white/40 border-none shadow-sm">
              <CardContent className="p-4 flex gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  entry.type === 'lecture' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                )}>
                  {entry.type === 'lecture' ? <BookOpen className="h-5 w-5" /> : <Headset className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold">{entry.title}</h4>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{entry.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 italic">"{entry.content}"</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
