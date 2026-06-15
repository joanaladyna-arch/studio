"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Instagram, Music } from "lucide-react";
import Image from "next/image";
import { MOCK_BOOKS, RANKS, EMOTIONS } from "@/app/library/page";
import { cn } from "@/lib/utils";

export default function SharePage() {
  const [selectedBook, setSelectedBook] = useState(MOCK_BOOKS[0]);

  const rank = selectedBook.rank ? RANKS[selectedBook.rank] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline">Partage BookTok</h1>
        <p className="text-muted-foreground">Générez une fiche élégante pour vos réseaux sociaux.</p>
      </header>

      <div className="grid md:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-headline">Choisir un livre</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {MOCK_BOOKS.filter(b => b.status === 'read' || b.status === 'progress').map((book) => (
              <button 
                key={book.id} 
                onClick={() => setSelectedBook(book)}
                className={cn(
                  "relative aspect-[2/3] rounded-lg overflow-hidden border-4 transition-all",
                  selectedBook.id === book.id ? "border-primary scale-95" : "border-transparent opacity-60"
                )}
              >
                <Image src={book.cover} alt={book.title} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div id="share-card" className="relative w-full aspect-[9/16] bg-gradient-to-br from-primary/20 via-background to-accent/20 rounded-3xl overflow-hidden shadow-2xl border flex flex-col items-center p-8 text-center">
            {/* Overlay décoratif */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/40 to-transparent" />
            
            <div className="relative z-10 space-y-6 w-full flex flex-col items-center">
              <div className="text-xs uppercase tracking-widest font-bold text-primary/60">Ma Lecture Plume</div>
              
              <div className="relative w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-4 border-white">
                <Image src={selectedBook.cover} alt={selectedBook.title} fill className="object-cover" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-headline leading-tight">{selectedBook.title}</h3>
                <p className="text-muted-foreground italic">{selectedBook.author}</p>
              </div>

              {rank && (
                <div className="flex flex-col items-center gap-1">
                  <rank.icon className={cn("h-8 w-8", rank.color)} />
                  <span className="text-sm font-bold uppercase tracking-tighter">{rank.label}</span>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {selectedBook.badges?.map(b => (
                  <span key={b} className="text-[10px] px-2 py-1 rounded-full bg-white/80 border shadow-sm">
                    {EMOTIONS[b].icon} {EMOTIONS[b].label}
                  </span>
                ))}
              </div>

              {selectedBook.citation && (
                <div className="pt-4 border-t w-full">
                  <p className="text-sm italic leading-relaxed text-muted-foreground px-4">
                    "{selectedBook.citation}"
                  </p>
                </div>
              )}

              <div className="absolute bottom-8 text-primary font-headline italic opacity-40">@PlumeApp</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500">
              <Instagram className="mr-2 h-4 w-4" /> Instagram
            </Button>
            <Button className="w-full bg-black">
              <Music className="mr-2 h-4 w-4" /> TikTok
            </Button>
            <Button variant="outline" className="w-full col-span-2">
              <Download className="mr-2 h-4 w-4" /> Enregistrer l'image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}