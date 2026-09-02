"use client";

import { useMemo } from "react";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";

/**
 * Filigrane saisonnier discret, affiché en fond sur toutes les pages
 * (contrairement à splash-screen.tsx qui ne s'affiche qu'à l'ouverture).
 * Réutilise les mêmes illustrations que l'écran Bienvenue (public/seasonal/)
 * pour rester cohérent visuellement. Ne rend rien si aucune saison n'est
 * active (cf. seasonal-theme.ts) : l'app reste alors neutre comme à l'origine.
 */
export function SeasonalPageDecoration() {
  const theme = useMemo(() => getCurrentSeasonalTheme(), []);

  if (!theme) return null;

  return (
    <img
      src={theme.illustration}
      alt=""
      aria-hidden
      className="fixed bottom-0 right-0 pointer-events-none select-none w-36 md:w-48"
      style={{ height: "auto", opacity: 0.35, zIndex: 0 }}
    />
  );
}
