"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rangée de 5 étoiles, avec support des demi-étoiles (3.5, 4.5...).
 *
 * Mode lecture seule (interactive=false, par défaut) : affiche
 * simplement le remplissage exact (0/50/100% par étoile) selon la
 * valeur de `rating`.
 *
 * Mode interactif (interactive=true) : chaque étoile est divisée en
 * deux zones cliquables invisibles (moitié gauche = demi-étoile,
 * moitié droite = étoile pleine) — cliquer sur la moitié gauche de la
 * 4e étoile donne 3.5, sur sa moitié droite donne 4.
 */
export function StarRating({
  rating = 0,
  size = 20,
  interactive = false,
  onChange,
  colorClass = "text-amber-400 fill-amber-400",
  emptyClass = "text-muted-foreground/20",
  gap = "gap-1",
}: {
  rating?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
  colorClass?: string;
  emptyClass?: string;
  gap?: string;
}) {
  return (
    <div className={cn("flex items-center", gap)}>
      {[1, 2, 3, 4, 5].map((s) => {
        const fillPct = rating >= s ? 100 : rating >= s - 0.5 ? 50 : 0;
        return (
          <div
            key={s}
            className="relative shrink-0"
            style={{ height: size, width: size }}
          >
            <Star className={cn("absolute inset-0", emptyClass)} style={{ height: size, width: size }} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <Star className={colorClass} style={{ height: size, width: size }} />
            </div>
            {interactive && onChange && (
              <>
                <button
                  type="button"
                  aria-label={`${s - 0.5} étoile${s - 0.5 > 1 ? "s" : ""}`}
                  className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer"
                  onClick={() => onChange(s - 0.5)}
                />
                <button
                  type="button"
                  aria-label={`${s} étoile${s > 1 ? "s" : ""}`}
                  className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer"
                  onClick={() => onChange(s)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
