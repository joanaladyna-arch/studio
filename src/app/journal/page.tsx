
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, Headset, Save, History, Plus, Star, Sparkles, MessageCircle, Quote, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, orderBy, query, limit, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from "next/link";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";

export default function JournalPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [readingNotes, setReadingNotes] = useState("");
  const [listeningNotes, setListeningNotes] = useState("");
  const [title, setTitle] = useState("");

  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "journal"),
      orderBy("date", "desc"),
      limit(10)
    );
  }, [db, user]);

  const { data: pastEntries = [] } = useCollection(entriesQuery);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [] } = useCollection(booksQuery);

  const handleSaveNote = (type: 'lecture' | 'écoute') => {
    if (!db || !user) return;

    const content = type === 'lecture' ? readingNotes : listeningNotes;
    const data = {
      type,
      title: title || "Sans titre",
      content,
      date: serverTimestamp()
    };

    const journalRef = collection(db, "users", user.uid, "journal");

    addDoc(journalRef, data)
      .then(() => {
        toast({
          title: "Note enregistrée",
          description: `Votre réflexion de ${type} a été ajoutée à votre journal.`,
        });
        if (type === 'lecture') setReadingNotes("");
        else setListeningNotes("");
        setTitle("");
      })
      .catch(async (e) => {
        const permissionError = new FirestorePermissionError({
          path: journalRef.path,
          operation: 'create',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="pt-8">
        <h1 className="text-5xl font-headline italic tracking-tight">Journal de bord</h1>
        <p className="text-primary/60 italic font-medium">Capturez l'essence de vos voyages littéraires.</p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-headline italic flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary/40" /> Avis de lecture récents
            </h2>
            <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic">
                <Link href="/library">Rédiger un avis <Plus className="ml-2 h-4 w-4" /></Link>
            </Button>
        </div>
        
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
            {books.filter(b => b.review).map((book) => (
                <Card key={book.id} className="glass-card min-w-[300px] border-none shadow-sm hover:shadow-md transition-shadow group shrink-0">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="relative h-20 w-14 shrink-0 rounded-lg overflow-hidden shadow-sm">
                                <BookCover src={book.cover} alt={book.title} className="object-cover" />
                            </div>
                            <div className="space-y-1 overflow-hidden">
                                <h4 className="font-headline italic text-lg line-clamp-1">{book.title}</h4>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 line-clamp-1">{book.author}</p>
                                <div className="flex gap-1 pt-1">
                                    {[1,2,3,4,5].map(s => (
                                        <Star key={s} className={cn("h-3 w-3", s <= (book.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <p className="text-sm italic text-muted-foreground line-clamp-3 leading-relaxed">"{book.review}"</p>
                    </CardContent>
                </Card>
            ))}
            {books.filter(b => b.review).length === 0 && (
                <div className="w-full py-12 text-center glass-card border-dashed border-primary/20 bg-white/20">
                    <p className="italic text-muted-foreground">Aucun avis de lecture rédigé pour le moment.</p>
                </div>
            )}
        </div>
      </section>

      <div className="space-y-8">
        <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-primary/40" />
            <h2 className="text-2xl font-headline italic">Notes au fil de l'eau</h2>
        </div>

        <Tabs defaultValue="reading" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-white/40 p-1.5 rounded-2xl">
              <TabsTrigger value="reading" className="rounded-xl flex gap-2 font-headline italic">
                <BookOpen className="h-4 w-4" /> Lecture
              </TabsTrigger>
              <TabsTrigger value="listening" className="rounded-xl flex gap-2 font-headline italic">
                <Headset className="h-4 w-4" /> Écoute
              </TabsTrigger>
            </TabsList>

            <div className="space-y-8">
                <Card className="glass-card shadow-lg border-none bg-white/60">
                    <CardHeader>
                        <Input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Titre de l'œuvre..."
                            className="text-2xl font-headline italic border-none bg-transparent h-auto px-0 focus-visible:ring-0 placeholder:opacity-30"
                        />
                        <CardDescription className="italic">Partagez votre réflexion du moment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <TabsContent value="reading" className="m-0">
                            <Textarea 
                                placeholder="Quelles émotions ce passage a-t-il éveillé en vous ?" 
                                className="min-h-[180px] bg-white/40 border-none rounded-3xl p-6 italic shadow-inner resize-none"
                                value={readingNotes}
                                onChange={(e) => setReadingNotes(e.target.value)}
                            />
                        </TabsContent>
                        <TabsContent value="listening" className="m-0">
                            <Textarea 
                                placeholder="Quelles notes, quels arguments retenez-vous ?" 
                                className="min-h-[180px] bg-white/40 border-none rounded-3xl p-6 italic shadow-inner resize-none"
                                value={listeningNotes}
                                onChange={(e) => setListeningNotes(e.target.value)}
                            />
                        </TabsContent>
                        <Button 
                            onClick={() => handleSaveNote(readingNotes ? 'lecture' : 'écoute')} 
                            disabled={(!readingNotes && !listeningNotes) || !user}
                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 font-headline italic text-xl"
                        >
                            <Save className="mr-3 h-5 w-5" /> Enregistrer la note
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <h3 className="text-xl font-headline italic flex items-center gap-2 text-muted-foreground/60">
                        <History className="h-5 w-5" /> Historique récent
                    </h3>
                    <div className="grid gap-4">
                        {pastEntries.map((entry, i) => (
                            <Card key={i} className="bg-white/40 border-none shadow-sm hover:bg-white/60 transition-colors">
                                <CardContent className="p-6 flex gap-6">
                                    <div className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                        entry.type === 'lecture' ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-400"
                                    )}>
                                        {entry.type === 'lecture' ? <BookOpen className="h-6 w-6" /> : <Headset className="h-6 w-6" />}
                                    </div>
                                    <div className="space-y-2 w-full">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-headline italic text-xl">{entry.title}</h4>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-40">
                                                {entry.date?.toDate ? entry.date.toDate().toLocaleDateString('fr-FR') : "Maintenant"}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground italic leading-relaxed">"{entry.content}"</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </Tabs>
      </div>
    </div>
  );
}
