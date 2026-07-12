"use client";

import Link from "next/link";
import { BookCover } from "@/components/book-cover";

/**
 * Étagère de livres façon bibliothèque physique : plusieurs rangées
 * ("étages") de 15 livres chacune, légèrement inclinés et superposés en
 * éventail, plutôt qu'une seule rangée défilante coupée par une tuile
 * "+N". Une rangée plus longue que l'écran défile horizontalement —
 * comme on ferait glisser le doigt sur une vraie étagère.
 *
 * Le chevauchement (-ml-5) ne fonctionne proprement que DANS une même
 * rangée flex — appliqué tel quel sur un conteneur en flex-wrap, le
 * premier livre de chaque rangée suivante se retrouverait décalé hors
 * du cadre. On découpe donc les livres en groupes de `perRow`, chaque
 * groupe formant sa propre rangée flex indépendante (donc son propre
 * "étage").
 */
export function BookShelf({
  books,
  perRow = 15,
}: {
  books: any[];
  perRow?: number;
}) {
  const rows: any[][] = [];
  for (let i = 0; i < books.length; i += perRow) {
    rows.push(books.slice(i, i + perRow));
  }

  return (
    <div className="relative space-y-4 pt-2 -mx-4 px-4 py-4 rounded-[2rem] shelf-pattern">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-end overflow-x-auto no-scrollbar pb-1 px-2 -mx-2">
          {row.map((book, i) => (
            <Link
              key={book.id}
              href={`/book/${book.id}`}
              className="relative shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden border-2 border-white shadow-lg first:ml-0 -ml-5 hover:z-20 hover:-translate-y-3 transition-transform duration-300 bg-secondary/5"
              style={{
                transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`,
                zIndex: i,
              }}
            >
              <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
