/**
 * Fonds d'ambiance personnalisables — simples dégradés pastel, tous
 * volontairement clairs pour que le texte foncé de l'app reste
 * toujours lisible sans aucune adaptation particulière. Le fond ne
 * change que l'espace "ambiant" derrière les cartes ; toutes les
 * cartes, boutons et textes de l'app restent inchangés quel que soit
 * le thème choisi.
 */
export type ThemeBackgroundId =
  | "default"
  | "vert-eau"
  | "saumon"
  | "jaune-clair"
  | "rose-pale"
  | "parme"
  | "blanc-casse";

export const THEME_BACKGROUNDS: { id: ThemeBackgroundId; label: string; sub: string; gradient: string }[] = [
  { id: "default", label: "Lectoria", sub: "Par défaut", gradient: "" },
  { id: "vert-eau", label: "Vert d'Eau", sub: "Frais", gradient: "linear-gradient(155deg, #EAF7F2 0%, #D3EEE4 55%, #EAF7F2 100%)" },
  { id: "saumon", label: "Saumon", sub: "Doux", gradient: "linear-gradient(155deg, #FDECE4 0%, #F9D6C4 55%, #FDECE4 100%)" },
  { id: "jaune-clair", label: "Jaune Clair", sub: "Lumineux", gradient: "linear-gradient(155deg, #FBF7E3 0%, #F4EBB8 55%, #FBF7E3 100%)" },
  { id: "rose-pale", label: "Rose Pâle", sub: "Léger", gradient: "linear-gradient(155deg, #FCEEF1 0%, #F6DBE2 55%, #FCEEF1 100%)" },
  { id: "parme", label: "Parme", sub: "Apaisé", gradient: "linear-gradient(155deg, #F2EDF8 0%, #E3D4F0 55%, #F2EDF8 100%)" },
  { id: "blanc-casse", label: "Blanc Cassé", sub: "Sobre", gradient: "linear-gradient(155deg, #FFFDF9 0%, #F1EAE0 55%, #FFFDF9 100%)" },
];

export function getThemeBackground(id?: string) {
  return THEME_BACKGROUNDS.find((t) => t.id === id) || THEME_BACKGROUNDS[0];
}
