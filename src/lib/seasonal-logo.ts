"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";

/**
 * Logo Lisoria saisonnier : même calendrier que l'écran Bienvenue
 * (seasonal-theme.ts), donc il change aux mêmes dates. Hors saison
 * (21 avril → 20 juin, 22 → 31 août), c'est le logo bleu "Plume".
 *
 * Aperçu sans attendre la date : ajouter ?saison=valentin | printemps | ete |
 * rentree | automne | noel | hiver | aucune à l'adresse de n'importe quelle page.
 */
const LOGO_BY_THEME: Record<string, string> = {
  valentin: "valentin",
  printemps: "printemps",
  ete: "ete",
  rentree: "rentree",
  automne: "automne",
  noel: "noel",
  hiver: "hiver",
};

export const DEFAULT_LOGO = "/brand/saison/plume.png";

export function seasonalLogoSrc(themeId?: string | null): string {
  const key = themeId ? LOGO_BY_THEME[themeId] : undefined;
  return key ? `/brand/saison/${key}.png` : DEFAULT_LOGO;
}

export function useSeasonalLogo(): string {
  const fromDate = useMemo(() => seasonalLogoSrc(getCurrentSeasonalTheme()?.id), []);
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("saison");
    if (!p) return;
    setOverride(p === "aucune" ? DEFAULT_LOGO : LOGO_BY_THEME[p] ? seasonalLogoSrc(p) : null);
  }, []);

  return override ?? fromDate;
}
