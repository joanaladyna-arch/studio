/**
 * Calendrier des thèmes saisonniers de l'écran "Bienvenue" (splash-screen.tsx).
 * Bascule nette à date fixe, jamais de transition progressive — un simple
 * `if` sur la date du jour, comme demandé.
 *
 * Chaque thème suit la même formule de dégradé (haut clair → bas
 * désaturé) avec une teinte différente par saison, plus une illustration
 * de coin dédiée (public/seasonal/*.svg — fournies par Joana, déjà
 * transparentes et légères, pas besoin d'optimisation supplémentaire).
 */

export type SeasonalTheme = {
  id: string;
  label: string;
  top: string;
  bottom: string;
  accent: string;
  ink: string;
  illustration: string;
  emoji: string;
};

export const SEASONAL_THEMES: SeasonalTheme[] = [
  {
    id: "valentin", label: "Saint-Valentin",
    top: "#F8ECEC", bottom: "#C99A8A", accent: "#B0555E", ink: "#3A2420",
    illustration: "/seasonal/valentin.svg", emoji: "💌",
  },
  {
    id: "printemps", label: "Printemps",
    top: "#F1F4E7", bottom: "#A9BA8C", accent: "#5D7A3F", ink: "#28311C",
    illustration: "/seasonal/printemps.svg", emoji: "🌸",
  },
  {
    id: "ete", label: "Été",
    top: "#FCF4E1", bottom: "#CBA666", accent: "#9C6B2E", ink: "#3A2B10",
    illustration: "/seasonal/ete.svg", emoji: "🌞",
  },
  {
    id: "rentree", label: "Rentrée",
    top: "#F2EFE4", bottom: "#7C8B67", accent: "#A8442E", ink: "#2E2A20",
    illustration: "/seasonal/rentree.png", emoji: "🍂",
  },
  {
    id: "automne", label: "Automne",
    top: "#F6EEE2", bottom: "#AA7550", accent: "#7A431F", ink: "#33200F",
    illustration: "/seasonal/automne.svg", emoji: "🍁",
  },
  {
    id: "noel", label: "Noël",
    top: "#EEF1EA", bottom: "#77896B", accent: "#9C3F3B", ink: "#20281A",
    illustration: "/seasonal/noel.svg", emoji: "🎄",
  },
  {
    id: "hiver", label: "Hiver",
    top: "#EAEFF2", bottom: "#8C9AA2", accent: "#4E6470", ink: "#212B30",
    illustration: "/seasonal/hiver.svg", emoji: "❄️",
  },
];

function themeById(id: string): SeasonalTheme {
  return SEASONAL_THEMES.find((t) => t.id === id)!;
}

/**
 * Détermine la saison du jour à partir du mois/jour courant (indépendant
 * de l'année). Les bornes suivent exactement le calendrier du brief, plus
 * la Rentrée (1er → 21 septembre) ajoutée ensuite — qui comble
 * entièrement le trou 22 août → 21 septembre. Il reste une période sans
 * thème assigné (21 avril → 20 juin, entre Printemps et Été). Plutôt que
 * d'inventer des bornes non demandées pour la combler, `null` signale
 * "pas de saison active" et splash-screen.tsx retombe alors sur le
 * design d'origine (fond marine) pour ces semaines-là.
 */
export function getCurrentSeasonalTheme(date: Date = new Date()): SeasonalTheme | null {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();
  const md = m * 100 + d; // ex: 12 nov -> 1112, facilite les comparaisons

  if (md >= 207 && md <= 215) return themeById("valentin");
  if (md >= 320 && md <= 420) return themeById("printemps");
  if (md >= 621 && md <= 821) return themeById("ete");
  if (md >= 901 && md <= 921) return themeById("rentree");
  if (md >= 922 && md <= 1130) return themeById("automne");
  if (md >= 1201 && md <= 1226) return themeById("noel");
  // Hiver (hors Noël) : 27 déc → 19 mars, chevauche le nouvel an donc pas
  // une simple plage continue en "md".
  if (md >= 1227 || md <= 319) return themeById("hiver");

  return null;
}
