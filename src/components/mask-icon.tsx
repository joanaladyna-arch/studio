import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Affiche un fichier SVG monochrome (public/icons/...) dans la couleur du
 * texte courant (currentColor) — même principe qu'une icône lucide, mais
 * avec les illustrations fournies par Joana.
 */
export function MaskIcon({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", className)}
      style={{
        backgroundColor: "currentColor",
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
        ...style,
      }}
    />
  );
}

/** Coupe (trophée) fournie par Joana : remplace l'icône Trophy de lucide partout, même signature (className). */
export function Coupe({ className, style }: { className?: string; style?: CSSProperties }) {
  return <MaskIcon src="/icons/accueil/coupe.svg" className={className} style={style} />;
}

/** Icône du Lounge (salon.svg fourni par Joana). */
export function LoungeIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return <MaskIcon src="/icons/nav/lounge.svg" className={className} style={style} />;
}
