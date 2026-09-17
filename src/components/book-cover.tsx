"use client";

import { useEffect, useState } from "react";
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
  const [directFailed, setDirectFailed] = useState(false);
  const [proxiedSrc, setProxiedSrc] = useState<string | null>(null);
  const [proxyFailed, setProxyFailed] = useState(false);

  useEffect(() => {
    setDirectFailed(false);
    setProxiedSrc(null);
    setProxyFailed(false);
  }, [src]);

  // Beaucoup de couvertures viennent d'un lien direct Google Books
  // (books.google.com/books/content...), qui refuse le hotlinking sans
  // en-tête Referer adéquat — le navigateur envoie le nôtre, pas le
  // sien, donc l'image échoue silencieusement (même souci documenté
  // dans /api/proxy-image, jusqu'ici réservé à l'export de partage).
  // Si le chargement direct échoue, on retente une fois via ce relais
  // serveur avant d'abandonner sur le repli visuel.
  useEffect(() => {
    if (!directFailed || !src || proxiedSrc || proxyFailed) return;
    let cancelled = false;
    fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.dataUri) setProxiedSrc(data.dataUri);
        else setProxyFailed(true);
      })
      .catch(() => {
        if (!cancelled) setProxyFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [directFailed, src, proxiedSrc, proxyFailed]);

  const effectiveSrc = proxyFailed ? null : proxiedSrc || (!directFailed ? src : null);

  if (effectiveSrc) {
    return (
      // <img> brut plutôt que next/image : ce composant sert aussi bien
      // le lien direct que le data URI renvoyé par /api/proxy-image, et
      // next/image a des comportements internes peu fiables avec les
      // URLs data: — un échec silencieux là ferait perdre le bénéfice du
      // relais de secours juste au-dessus. On n'optimise déjà pas ces
      // images (unoptimized), donc rien à perdre à s'en passer.
      <img
        src={effectiveSrc}
        alt={alt}
        className={cn("absolute inset-0 h-full w-full", className)}
        onError={() => (proxiedSrc ? setProxyFailed(true) : setDirectFailed(true))}
      />
    );
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
