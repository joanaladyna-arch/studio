"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Petit bouton "(i)" assez visible pour être repéré par toutes les
 * lectrices, qui ouvre une explication au tap (pas seulement au survol
 * — le survol seul ne fonctionne pas sur mobile/tablette, l'essentiel
 * du terrain de jeu de Lectoria).
 */
export function InfoBadge({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors"
          aria-label="En savoir plus"
        >
          <Info className="h-3.5 w-3.5 text-primary/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 text-sm italic leading-relaxed bg-white/95 backdrop-blur-xl border-primary/10"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
