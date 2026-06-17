
"use client";

import { useMemo } from "react";
import { RANKS, RankType } from "@/app/library/page";
import { Diamond, Crown, Sparkles, Heart } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function CoeurDePlumePage() {
  const { user } = useUser();
  const db = useFirestore();

  // On récupère désormais les livres de TOUS les rangs Plume attribués
  // (pas seulement Diamant/Royale), pour les afficher façon pile en
  // éventail — comme "Mon étagère PAL" — avec un écrin spécial réservé
  // aux deux rangs les plus prestigieux.
  const rankedQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "books"),
      where("plumeRank", "in", Object.keys(RANKS))
    );
  }, [db, user]);

  const { data: rankedBooks = [], loading } = useCollection(rankedQuery);

  const booksByRank = useMemo(() => {
    const map: Record<string, any[]> = {};
    (rankedBooks || []).forEach((b: any) => {
      if (!b.plumeRank) return;
      if (!map[b.plumeRank]) map[b.plumeRank] = [];
      map[b.plumeRank].push(b);
    });
    return map;
  }, [rankedBooks]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <header className="text-center space-y-4 py-12">
        <div className="flex justify-center gap-3 mb-2">
          <Heart className="h-8 w-8 text-primary/40 animate-pulse" />
        </div>
        <h1 className="text-6xl font-headline tracking-tight">Cœur de Plume</h1>
        <p className="text-primary/60 max-w-md mx-auto italic text-lg font-medium">
          L'écrin de vos lectures, classées selon le Rang Plume que vous leur avez attribué.
        </p>
      </header>

      {loading ? (
        <div className="py-24 text-center italic text-muted-foreground">Ouverture de l'écrin...</div>
      ) : Object.keys(booksByRank).length > 0 ? (
        <div className="space-y-12 max-w-5xl mx-auto px-4">
          {(Object.keys(RANKS) as RankType[]).map((rankKey) => {
            const books = booksByRank[rankKey];
            if (!books || books.length === 0) return null;
            const rank = RANKS[rankKey];
            const RankIcon = rank.icon;
            const isPrestige = rankKey === "diamant" || rankKey === "royale";

            const header = (
              <div className="flex items-center gap-3 px-2">
                <RankIcon className={cn("h-6 w-6", rank.color)} />
                <h2 className="text-2xl font-headline italic">{rank.label}</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                  {books.length} livre{books.length > 1 ? "s" : ""}
                </span>
              </div>
            );

            const pile = (
              <div className="flex items-end overflow-x-auto pb-6 pt-6 px-4 -mx-2">
                {books.slice(0, 14).map((book: any, i: number) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}`}
                    className="relative shrink-0 w-20 aspect-[2/3] rounded-xl overflow-hidden border-2 border-white shadow-lg first:ml-0 -ml-7 hover:z-20 hover:-translate-y-3 transition-transform duration-300 bg-secondary/5"
                    style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`, zIndex: i }}
                  >
                    <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                  </Link>
                ))}
                {books.length > 14 && (
                  <div className="relative shrink-0 w-20 aspect-[2/3] rounded-xl border-2 border-dashed border-primary/20 bg-white/40 flex items-center justify-center -ml-7 text-primary/60 font-bold text-sm italic">
                    +{books.length - 14}
                  </div>
                )}
              </div>
            );

            if (isPrestige) {
              return (
                <div
                  key={rankKey}
                  className={cn(
                    "p-8 rounded-[2.5rem] border-2 shadow-lg relative overflow-hidden",
                    rankKey === "diamant"
                      ? "bg-gradient-to-br from-cyan-50 via-white to-white border-cyan-200/60"
                      : "bg-gradient-to-br from-amber-50 via-white to-white border-amber-200/60"
                  )}
                >
                  <Sparkles className={cn("absolute top-6 right-6 h-6 w-6 opacity-30", rank.color)} />
                  <div className="space-y-2">
                    {header}
                    {pile}
                  </div>
                </div>
              );
            }

            return (
              <div key={rankKey} className="space-y-2">
                {header}
                {pile}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center space-y-6">
          <Sparkles className="h-16 w-16 mx-auto text-primary/10" />
          <p className="text-muted-foreground italic text-lg">
            Le Cœur de Plume attend vos premières lectures.<br />
            Attribuez un Rang Plume à vos livres pour les voir apparaître ici.
          </p>
        </div>
      )}

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
