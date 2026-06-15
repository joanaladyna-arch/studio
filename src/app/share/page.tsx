
"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Instagram, Music } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RANKS, EMOTIONS, Book, BookCard } from "@/app/library/page";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

export default function SharePage() {
  const { user } = useUser();
  const db = useFirestore();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "books"),
      where("status", "in", ["read", "progress"])
    );
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const selectedBook = useMemo(() => {
    if (selectedBookId) return books.find(b => b.id === selectedBookId);
    return books[0];
  }, [books, selectedBookId]);

  const rank = selectedBook?.rank ? RANKS[selectedBook.rank] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header>
        <h1 className="text-4xl font-headline italic">Partage BookTok</h1>
        <p className="text-muted-foreground italic">Générez une fiche élégante pour vos réseaux sociaux.</p>
      </header>

      {loading ? (
        <div className="py-20 text-center italic text-muted-foreground">Préparation de vos lectures...</div>
      ) : books.length > 0 ? (
        <div className="grid md:grid-cols-[1fr_350px] gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-headline italic">Choisir un livre</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {books.map((book) => (
                <button 
                  key={book.id} 
                  onClick={() => setSelectedBookId(book.id)}
                  className={cn(
                    "relative aspect-[2/3] rounded-2xl overflow-hidden border-4 transition-all duration-500 shadow-sm",
                    selectedBook?.id === book.id ? "border-primary scale-95 shadow-xl" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <Image src={book.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={book.title} fill className="object-cover" sizes="200px" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div id="share-card" className="relative w-full aspect-[9/16] bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-[3rem] overflow-hidden shadow-2xl border border-white/40 flex flex-col items-center p-8 text-center animate-paper">
              <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/60 to-transparent" />
              
              <div className="relative z-10 space-y-6 w-full flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary/60">Mon Carnet Plume</div>
                
                {selectedBook && (
                  <>
                    <div className="relative w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white rotate-1">
                      <Image src={selectedBook.cover || "https://picsum.photos/seed/placeholder/200/300"} alt={selectedBook.title} fill className="object-cover" sizes="200px" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-2xl font-headline italic leading-tight">{selectedBook.title}</h3>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{selectedBook.author}</p>
                    </div>

                    {rank && (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <rank.icon className={cn("h-8 w-8", rank.color)} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">{rank.label}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-1.5">
                      {selectedBook.emotions?.map(e => (
                        <span key={e} className="text-[9px] px-2 py-1 rounded-full bg-white/90 border border-white shadow-sm font-bold flex items-center gap-1">
                          {EMOTIONS[e]?.icon} {EMOTIONS[e]?.label}
                        </span>
                      ))}
                    </div>

                    {selectedBook.favoriteQuote && (
                      <div className="pt-4 border-t border-primary/10 w-full">
                        <p className="text-xs italic leading-relaxed text-muted-foreground px-4">
                          "{selectedBook.favoriteQuote}"
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="absolute bottom-4 text-primary/30 font-headline italic text-sm tracking-widest">@Plume</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button className="w-full rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-lg shadow-pink-200 border-none h-12">
                <Instagram className="mr-2 h-4 w-4" /> Insta
              </Button>
              <Button className="w-full rounded-2xl bg-slate-900 shadow-lg shadow-slate-200 border-none h-12">
                <Music className="mr-2 h-4 w-4" /> TikTok
              </Button>
              <Button variant="outline" className="w-full col-span-2 rounded-2xl border-primary/20 text-primary h-12">
                <Download className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-32 text-center space-y-4 glass-card p-12">
          <p className="text-muted-foreground italic text-lg">Vous n'avez pas encore de livres lus ou en cours pour créer une fiche.</p>
          <Button asChild variant="link" className="text-primary">
            <Link href="/library">Accéder à ma bibliothèque</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
