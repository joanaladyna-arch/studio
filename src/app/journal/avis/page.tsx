"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Star } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn, cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import { BookCover } from "@/components/book-cover";

export default function AllReviewsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: books = [], loading } = useCollection(booksQuery);

  const reviewedBooks = useMemo(() => {
    return books
      .filter((b: any) => (b.review || "").toString().trim())
      .sort((a: any, b: any) => (b.dateAdded?.toMillis?.() || 0) - (a.dateAdded?.toMillis?.() || 0));
  }, [books]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Link href="/journal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Journal
      </Link>
      <header>
        <h1 className="text-4xl font-headline italic flex items-center gap-4">
          <Sparkles className="h-8 w-8 text-rose" /> Tous mes avis de lecture
        </h1>
        <p className="text-muted-foreground italic">{reviewedBooks.length} avis rédigé{reviewedBooks.length > 1 ? "s" : ""}.</p>
      </header>

      {loading ? (
        <p className="text-muted-foreground italic text-center py-20">Chargement...</p>
      ) : reviewedBooks.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {reviewedBooks.map((book: any) => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className="glass-card border-none shadow-sm hover:shadow-md transition-shadow group h-full">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="relative h-20 w-14 shrink-0 rounded-lg overflow-hidden shadow-sm">
                      <BookCover src={book.cover} alt={book.title} className="object-cover" />
                    </div>
                    <div className="space-y-1 overflow-hidden">
                      <h4 className="font-headline italic text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {cleanBookTitle(book.title)}{book.volume ? ` — ${book.volume}` : ""}
                      </h4>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 line-clamp-1">{cleanAuthorName(book.author)}</p>
                      <div className="flex gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={cn("h-3 w-3", s <= (book.rating || 0) ? "text-copper fill-copper" : "text-muted-foreground/20")} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm italic text-muted-foreground leading-relaxed">"{book.review}"</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="w-full py-20 text-center glass-card border-dashed border-primary/20 bg-white/20">
          <p className="italic text-muted-foreground">Aucun avis de lecture rédigé pour le moment.</p>
        </div>
      )}
    </div>
  );
}
