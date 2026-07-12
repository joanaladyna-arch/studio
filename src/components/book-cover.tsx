"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Affiche la couverture d'un livre, ou — quand aucune couverture n'a été
 * trouvée par la recherche (base Lectoria, Google Books, Open Library,
 * BnF, toutes interrogées avant d'arriver ici) ou que le lien fourni est
 * mort ou invalide — un repli sur une icône de livre sur fond doux
 * plutôt que sur une photo aléatoire sans rapport avec un livre.
 *
 * S'utilise comme un <Image fill /> classique : le parent direct doit
 * être positionné en relative.
 */
export function BookCover({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return <Image src={src} alt={alt} fill className={className} onError={() => setFailed(true)} unoptimized />;
  }
  // Repli visuel premium quand aucune couverture n'a pu être trouvée
  // (base Lectoria, fiche partagée, puis Google Books en direct, toutes
  // interrogées avant d'arriver ici) : silhouette de dos de livre sur
  // fond nuit, avec le titre, plutôt qu'une icône générique.
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary via-primary to-[#2A3644] p-3 text-center",
        className
      )}
    >
      <BookOpen className="h-6 w-6 text-rose/70 shrink-0" />
      <span className="font-headline italic text-[11px] leading-tight text-primary-foreground/80 line-clamp-3">
        {alt}
      </span>
    </div>
  );
}
