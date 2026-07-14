/**
 * Fonds d'ambiance personnalisables — simples dégradés dans la palette
 * Lectoria (pas de motif illustré). Le fond ne change que l'espace
 * "ambiant" derrière les cartes ; toutes les cartes, boutons et textes
 * de l'app restent inchangés quel que soit le thème choisi.
 */
export type ThemeBackgroundId =
  | "default"
  | "nuit"
  | "cuivre"
  | "rose"
  | "sauge"
  | "creme"
  | "cuivre-clair"
  | "rose-clair"
  | "sauge-clair";

export const THEME_BACKGROUNDS: { id: ThemeBackgroundId; label: string; sub: string; gradient: string }[] = [
  { id: "default", label: "Lectoria", sub: "Par défaut", gradient: "" },
  { id: "nuit", label: "Nuit", sub: "Signature", gradient: "linear-gradient(155deg, #1B2430 0%, #2A3644 55%, #1B2430 100%)" },
  { id: "cuivre", label: "Cuivre", sub: "Chaleureux", gradient: "linear-gradient(155deg, #2A2016 0%, #4A3520 55%, #2A2016 100%)" },
  { id: "rose", label: "Rose Nuit", sub: "Doux", gradient: "linear-gradient(155deg, #2B1620 0%, #4A2534 55%, #2B1620 100%)" },
  { id: "sauge", label: "Sauge", sub: "Apaisé", gradient: "linear-gradient(155deg, #1A221D 0%, #303F33 55%, #1A221D 100%)" },
  { id: "creme", label: "Crème", sub: "Lumineux", gradient: "linear-gradient(155deg, #F5F1E8 0%, #EDE4D3 55%, #F5F1E8 100%)" },
  { id: "cuivre-clair", label: "Cuivre Clair", sub: "Doux", gradient: "linear-gradient(155deg, #F5EDE1 0%, #E8D2B4 55%, #F5EDE1 100%)" },
  { id: "rose-clair", label: "Rose Clair", sub: "Léger", gradient: "linear-gradient(155deg, #F9EDF0 0%, #F0D2DC 55%, #F9EDF0 100%)" },
  { id: "sauge-clair", label: "Sauge Claire", sub: "Frais", gradient: "linear-gradient(155deg, #EEF2ED 0%, #D6E2D8 55%, #EEF2ED 100%)" },
];

export function getThemeBackground(id?: string) {
  return THEME_BACKGROUNDS.find((t) => t.id === id) || THEME_BACKGROUNDS[0];
}
