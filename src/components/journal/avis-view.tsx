"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc } from "firebase/firestore";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { MaskIcon } from "@/components/mask-icon";
import { ReviewCaptureDialog } from "@/components/review-capture-dialog";
import { RANKS } from "@/app/library/page";
import { cn, cleanAuthorName, cleanBookTitle, toArray } from "@/lib/utils";

/**
 * Mes avis & réflexions : la lectrice coche l'avis qu'elle souhaite, puis
 * "Capturer un avis" ouvre la fenêtre de capture (PDF / JPG / PNG).
 */
export function AvisView() {
  const { user } = useUser();
  const db = useFirestore();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const booksRef = useMemo(() => (db && user ? collection(db, "users", user.uid, "books") : null), [db, user]);
  const { data: books = [], loading } = useCollection(booksRef);
  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);

  const reviewed = useMemo(
    () =>
      (books as any[])
        .filter((b) => (b.review || "").toString().trim())
        .sort((a, b) => (b.dateAdded?.toMillis?.() || 0) - (a.dateAdded?.toMillis?.() || 0)),
    [books]
  );
  const book = reviewed.find((b) => b.id === selected) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="italic text-muted-foreground text-sm">
          {reviewed.length} avis rédigé{reviewed.length > 1 ? "s" : ""}.
          {" "}{book ? <>Avis coché : <b className="font-semibold not-italic">{cleanBookTitle(book.title)}</b>.</> : reviewed.length > 0 ? "Coche l'avis que tu souhaites capturer." : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-xl text-primary font-headline italic">
            <Link href="/library">Rédiger un avis <Plus className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button
            type="button"
            onClick={() => book && setOpen(true)}
            disabled={!book}
            title={book ? "Capturer cet avis en image ou en PDF" : "Coche l'avis que tu souhaites capturer"}
            className="rounded-full h-11 px-5 bg-primary text-white font-headline italic text-base shadow-md"
          >
            <MaskIcon src="/icons/profil/avis-positif.svg" className="h-6 w-6 mr-2.5" />
            Capturer un avis
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground italic text-center py-20">Chargement...</p>
      ) : reviewed.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {reviewed.map((b) => {
            const on = b.id === selected;
            return (
              <Card key={b.id} className={cn("glass-card border-2 shadow-sm hover:shadow-md transition-all group h-full", on ? "border-rose bg-rose/10" : "border-transparent")}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4 items-start">
                    <label className="shrink-0 mt-1 cursor-pointer" title="Cocher pour capturer cet avis">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSelected(on ? null : b.id)}
                        aria-label={`Capturer l'avis de ${cleanBookTitle(b.title)}`}
                        className="sr-only peer"
                      />
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-primary/40 bg-white peer-checked:bg-rose peer-checked:border-rose peer-focus-visible:ring-2 peer-focus-visible:ring-rose/50 text-white text-sm leading-none">
                        {on ? "✓" : ""}
                      </span>
                    </label>
                    <Link href={`/book/${b.id}`} className="flex gap-4 items-start min-w-0 flex-1">
                      <div className="relative h-20 w-14 shrink-0 rounded-lg overflow-hidden shadow-sm">
                        <BookCover src={b.cover} alt={b.title} className="object-cover" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <h4 className="font-headline italic text-lg line-clamp-1 group-hover:text-primary transition-colors">
                          {cleanBookTitle(b.title)}{b.volume ? ` — ${b.volume}` : ""}
                        </h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 line-clamp-1">{cleanAuthorName(b.author)}</p>
                        <div className="pt-1">
                          <StarRating rating={b.rating || 0} size={12} gap="gap-1" colorClass="text-copper fill-copper" emptyClass="text-muted-foreground/20" />
                        </div>
                      </div>
                    </Link>
                  </div>
                  <p className="text-sm italic text-muted-foreground leading-relaxed">"{b.review}"</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="w-full py-20 text-center glass-card border-dashed border-primary/20 bg-white/20">
          <p className="italic text-muted-foreground">Aucun avis de lecture rédigé pour le moment.</p>
        </div>
      )}

      {book && (
        <ReviewCaptureDialog
          open={open}
          onOpenChange={setOpen}
          defaultName={((profile as any)?.name || "").split(" ")[0]}
          book={{
            title: cleanBookTitle(book.title || ""),
            author: cleanAuthorName(book.author || ""),
            cover: (book.cover || null) as string | null,
            rating: Math.round(Number(book.rating) || 0),
            spicy: Math.round(Number(book.spicyLevel) || 0),
            rankLabel: book.plumeRank ? (RANKS as any)[book.plumeRank]?.label || null : null,
            isPepite: Boolean(book.isRecommended),
            genres: toArray<string>(book.genres).slice(0, 3),
            review: (book.review || "").toString(),
            quotes: [book.favoriteQuote, ...toArray<string>(book.favoriteQuotes)].map((q: any) => (q || "").toString().trim()).filter(Boolean),
          }}
        />
      )}
    </div>
  );
}
