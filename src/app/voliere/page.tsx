
"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Book, BookCard } from "@/app/library/page";
import { Diamond, Crown, Sparkles } from "lucide-react";

export default function VolierePage() {
  const topBooks: Book[] = useMemo(() => [
    { 
      title: "L'élégance du hérisson", 
      author: "Muriel Barbery", 
      status: "progress", 
      favorite: true, 
      cover: "https://picsum.photos/seed/10/200/300", 
      rank: 'diamant', 
      badges: ['obsession', 'inoubliable'] 
    },
    { 
      title: "La vérité sur l'affaire Harry Quebert", 
      author: "Joël Dicker", 
      status: "read", 
      favorite: true, 
      cover: "https://picsum.photos/seed/11/200/300", 
      rank: 'royale', 
      badges: ['plot-twist', 'addictif'] 
    },
    { 
      title: "Les Fleurs du Mal", 
      author: "Charles Baudelaire", 
      status: "read", 
      favorite: true, 
      cover: "https://picsum.photos/seed/14/200/300", 
      rank: 'doree', 
      badges: ['larmes'] 
    },
  ], []);

  const voliereBooks = useMemo(() => 
    topBooks.filter(b => b.rank === 'diamant' || b.rank === 'royale'), 
  [topBooks]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="text-center space-y-4 py-8">
        <div className="flex justify-center gap-2 mb-2">
          <Diamond className="h-6 w-6 text-cyan-400 animate-bounce" />
          <Crown className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="text-5xl font-headline italic">La Volière</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          L'écrin de vos lectures les plus précieuses. Seules les plumes de Diamant et Royales peuvent y nicher.
        </p>
      </header>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl -z-10" />
        
        {voliereBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 p-6">
            {voliereBooks.map((book, i) => (
              <div key={i} className="relative">
                <div className="absolute -top-4 -left-4 z-20">
                    {book.rank === 'diamant' ? (
                        <div className="bg-cyan-400 text-white p-2 rounded-full shadow-lg">
                            <Diamond className="h-4 w-4" />
                        </div>
                    ) : (
                        <div className="bg-amber-500 text-white p-2 rounded-full shadow-lg">
                            <Crown className="h-4 w-4" />
                        </div>
                    )}
                </div>
                <BookCard book={book} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-muted/30" />
            <p className="text-muted-foreground">La Volière est encore vide. <br/> Classez vos coups de cœur en Diamant pour les voir ici.</p>
          </div>
        )}
      </div>

      <section className="pt-12 border-t">
        <h2 className="text-2xl font-headline mb-6 text-center">Pourquoi ce classement ?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/40 border">
            <h3 className="font-bold flex items-center gap-2 text-cyan-500">
                <Diamond className="h-4 w-4" /> Diamant de Plume
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Le summum. Un livre qui a changé votre vision du monde ou vous a marqué à jamais.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/40 border">
            <h3 className="font-bold flex items-center gap-2 text-amber-500">
                <Crown className="h-4 w-4" /> Plume Royale
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Une lecture magistrale, parfaite de bout en bout, que vous pourriez relire sans cesse.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
