"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Quote, Share2 } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

async function shareText(title: string, text: string, onFallback: () => void) {
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share({ title, text });
      return;
    } catch {
      return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    onFallback();
  } catch {
    // silencieux
  }
}

export default function AllCitationsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [], loading } = useCollection(booksQuery);

  const quotedBooks = useMemo(() => {
    return books
      .filter((b: any) => (b.favoriteQuote || "").toString().trim())
      .sort((a: any, b: any) => (b.dateAdded?.toMillis?.() || 0) - (a.dateAdded?.toMillis?.() || 0));
  }, [books]);

  const shareQuote = (book: any) => {
    const text = `"${book.favoriteQuote}"\n— ${cleanBookTitle(book.title)}, ${cleanAuthorName(book.author)}`;
    shareText(book.title, text, () => toast({ title: "Copié", description: "La citation a été copiée dans le presse-papier." }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Journal
      </Link>
      <header>
        <h1 className="text-4xl font-headline italic flex items-center gap-4">
          <Quote className="h-8 w-8 text-rose" /> Carnet de Citations
        </h1>
        <p className="text-muted-foreground italic">{quotedBooks.length} citation{quotedBooks.length > 1 ? "s" : ""} épinglée{quotedBooks.length > 1 ? "s" : ""}.</p>
      </header>

      {loading ? (
        <p className="text-muted-foreground italic text-center py-20">Chargement...</p>
      ) : quotedBooks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {quotedBooks.map((book: any) => (
            <Card key={book.id} className="glass-card border-none shadow-sm bg-white/60">
              <CardContent className="p-6 space-y-3">
                <Link href={`/book/${book.id}`}>
                  <p className="text-sm italic leading-relaxed hover:text-primary transition-colors">"{book.favoriteQuote}"</p>
                </Link>
                <div className="flex items-center justify-between">
                  <Link href={`/book/${book.id}`} className="text-[10px] font-bold uppercase tracking-widest opacity-50 line-clamp-1 hover:opacity-100 transition-opacity">
                    {cleanBookTitle(book.title)} — {cleanAuthorName(book.author)}
                  </Link>
                  <button onClick={() => shareQuote(book)} className="shrink-0 h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary hover:scale-110 transition-transform" title="Partager la citation">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="w-full py-20 text-center glass-card border-dashed border-primary/20 bg-white/20">
          <p className="italic text-muted-foreground text-sm">Ajoutez une citation favorite depuis la fiche d'un livre pour l'épingler ici.</p>
        </div>
      )}
    </div>
  );
}
