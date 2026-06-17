"use client";

import { useState } from "react";
import Image from "next/image";
import { Feather } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Affiche la couverture d'un livre, ou — quand aucune couverture n'a été
 * trouvée par la recherche (base Plume, Google Books, Open Library, BnF,
 * toutes interrogées avant d'arriver ici) ou que le lien fourni est mort
 * ou invalide — un repli sur le logo Plume (icône Feather sur fond doux)
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
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/15 to-primary/5",
        className
      )}
    >
      <Feather className="h-10 w-10 text-primary/30" />
    </div>
  );
}
