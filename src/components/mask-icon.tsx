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
