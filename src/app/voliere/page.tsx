"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { BookCard, Book } from "@/app/library/page";
import { Diamond, Crown, Sparkles, Heart } from "lucide-react";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

export default function VolierePage() {
  const { user } = useUser();
  const db = useFirestore();

  const prestigiousQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "books"),
      where("rank", "in", ["diamant", "royale"])
    );
  }, [db, user]);

  const { data: prestigiousBooks = [], loading } = useCollection(prestigiousQuery);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <Navigation />

      <header className="text-center space-y-4 py-12">
        <div className="flex justify-center gap-3 mb-2">
          <Heart className="h-8 w-8 text-primary/40 animate-pulse" />
        </div>
        <h1 className="text-6xl font-headline tracking-tight">Cœur de Plume</h1>
        <p className="text-primary/60 max-w-md mx-auto italic text-lg font-medium">
          L'écrin de vos lectures les plus précieuses. Vos coups de cœur absolus nichés dans un même espace.
        </p>
      </header>

      <div className="relative">
        <div className="absolute inset-0 bg-watercolor rounded-[4rem] -z-10" />
        
        {loading ? (
          <div className="py-24 text-center italic text-muted-foreground">Ouverture de l'écrin...</div>
        ) : prestigiousBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 p-8">
            {prestigiousBooks.map((book) => (
              <div key={book.id} className="relative group">
                <div className="absolute -top-4 -left-4 z-20 transition-transform duration-500 group-hover:scale-110">
                    {book.rank === 'diamant' ? (
                        <div className="bg-cyan-50 text-cyan-400 p-2.5 rounded-full shadow-lg border border-cyan-100">
                            <Diamond className="h-4 w-4" />
                        </div>
                    ) : (
                        <div className="bg-amber-50 text-amber-500 p-2.5 rounded-full shadow-lg border border-amber-100">
                            <Crown className="h-4 w-4" />
                        </div>
                    )}
                </div>
                <BookCard book={book as Book} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center space-y-6">
            <Sparkles className="h-16 w-16 mx-auto text-primary/10" />
            <p className="text-muted-foreground italic text-lg">Le Cœur de Plume attend vos premiers coups de cœur.<br/>Classez vos lectures en Diamant ou Royale pour les voir ici.</p>
          </div>
        )}
      </div>

      <section className="pt-20 border-t border-primary/10">
        <h2 className="text-3xl font-headline mb-10 text-center">Les Grades de Prestige</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-sm hover:bg-white/60 transition-colors">
            <h3 className="font-headline text-2xl flex items-center gap-3 text-cyan-500 mb-2">
                <Diamond className="h-5 w-5" /> Diamant de Plume
            </h3>
            <p className="text-sm text-muted-foreground italic leading-relaxed">Le coup de cœur absolu. Un livre qui a laissé une empreinte indélébile sur votre âme.</p>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-sm hover:bg-white/60 transition-colors">
            <h3 className="font-headline text-2xl flex items-center gap-3 text-amber-500 mb-2">
                <Crown className="h-5 w-5" /> Plume Royale
            </h3>
            <p className="text-sm text-muted-foreground italic leading-relaxed">Une lecture exceptionnelle, portée par une plume magistrale de bout en bout.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
