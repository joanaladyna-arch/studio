"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Headset, MessageCircle } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, orderBy, query } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function AllNotesPage() {
  const { user } = useUser();
  const db = useFirestore();

  // Pas de limite ici (contrairement à l'aperçu sur /journal, plafonné à
  // 10) — c'est justement le but de cette page : voir l'historique complet.
  const entriesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "journal"), orderBy("date", "desc"));
  }, [db, user]);
  const { data: entries = [], loading } = useCollection(entriesQuery);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Journal
      </Link>
      <header>
        <h1 className="text-4xl font-headline italic flex items-center gap-4">
          <MessageCircle className="h-8 w-8 text-rose" /> Toutes mes notes au fil de l'eau
        </h1>
        <p className="text-muted-foreground italic">{entries.length} note{entries.length > 1 ? "s" : ""} enregistrée{entries.length > 1 ? "s" : ""}.</p>
      </header>

      {loading ? (
        <p className="text-muted-foreground italic text-center py-20">Chargement...</p>
      ) : entries.length > 0 ? (
        <div className="grid gap-4">
          {entries.map((entry: any, i: number) => (
            <Card key={i} className="bg-white/40 border-none shadow-sm hover:bg-white/60 transition-colors">
              <CardContent className="p-6 flex gap-6">
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                  entry.type === 'lecture' ? "bg-primary/10 text-primary" : "bg-copper/10 text-copper"
                )}>
                  {entry.type === 'lecture' ? <BookOpen className="h-6 w-6" /> : <Headset className="h-6 w-6" />}
                </div>
                <div className="space-y-2 w-full min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-headline italic text-xl">{entry.title}</h4>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-40 shrink-0">
                      {entry.date?.toDate ? entry.date.toDate().toLocaleDateString('fr-FR') : "Maintenant"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">"{entry.content}"</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="w-full py-20 text-center glass-card border-dashed border-primary/20 bg-white/20">
          <p className="italic text-muted-foreground">Aucune note enregistrée pour le moment.</p>
        </div>
      )}
    </div>
  );
}
