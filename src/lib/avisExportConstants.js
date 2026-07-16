/**
 * avisExportConstants.js
 * Constantes de palette et utilitaires pour l'export d'avis Lectoria
 *
 * Placer dans : src/lib/avisExportConstants.js
 */

// ─── Dérivation de couleurs ────────────────────────────────────────────────
/**
 * À partir d'une teinte HSL, génère un jeu complet de couleurs pour la carte.
 * @param {number} h  Teinte (0-360)
 * @param {number} s  Saturation (0-100)
 * @param {number} l  Luminosité (0-100)
 * @returns {{ h, s, l, bg, ac, tx, t1, isDark }}
 */
export function deriveColors(h, s, l) {
  const dk = l < 55;
  let acL;
  if (l > 70)      acL = Math.max(l - 52, 18);
  else if (l > 45) acL = Math.max(l - 35, 20);
  else if (l > 25) acL = Math.min(l + 40, 78);
  else             acL = Math.min(l + 55, 82);

  return {
    h, s, l,
    bg:  `hsl(${h},${s}%,${l}%)`,
    ac:  `hsl(${(h + 18) % 360},${Math.min(s + 18, 100)}%,${acL}%)`,
    tx:  dk
      ? `hsl(${h},12%,88%)`
      : `hsl(${h},${Math.min(Math.floor(s * 0.4), 42)}%,14%)`,
    t1:  dk
      ? `hsl(${h},${Math.max(Math.floor(s * 0.55), 25)}%,${Math.min(l + 16, 84)}%)`
      : `hsl(${h},${Math.max(s - 16, 28)}%,${Math.min(l + 6, 94)}%)`,
    isDark: dk,
  };
}

// ─── Palette 9 × 6 ─────────────────────────────────────────────────────────
/** Teintes représentées dans la grille (9 colonnes) */
export const PALETTE_HUES = [65, 30, 15, 0, 345, 315, 280, 225, 120];

/** Configurations de luminosité par ligne (6 lignes : pastel → sombre) */
export const PALETTE_ROWS = [
  { s: 40, l: 92 },
  { s: 56, l: 83 },
  { s: 82, l: 68 },
  { s: 100, l: 50 },
  { s: 100, l: 32 },
  { s: 80,  l: 18 },
];

/** Grille complète [ligne][colonne] → entrée de couleur */
export const PALETTE = PALETTE_ROWS.map(({ s, l }) =>
  PALETTE_HUES.map(h => deriveColors(h, s, l))
);

/** Palette initiale par défaut : rose pâle (ligne 0, col 3) */
export const DEFAULT_PALETTE_ENTRY = PALETTE[0][3];

// ─── Formats d'export ──────────────────────────────────────────────────────
/**
 * Dimensions d'affichage (dans l'UI) et de sortie (export PNG)
 * pixelRatio = outW / w  →  used in html-to-image
 */
export const FMTS = {
  sq: { w: 264, h: 264, label: '1080 × 1080', outW: 1080, outH: 1080 },
  po: { w: 248, h: 310, label: '1080 × 1350', outW: 1080, outH: 1350 },
  st: { w: 220, h: 392, label: '1080 × 1920', outW: 1080, outH: 1920 },
};

// ─── Templates ─────────────────────────────────────────────────────────────
export const TEMPLATES = ['polaroid', 'moodboard', 'journal', 'minimal', 'bold'];
export const TEMPLATE_LABELS = {
  polaroid:  'Polaroid',
  moodboard: 'Moodboard',
  journal:   'Journal',
  minimal:   'Minimal',
  bold:      'Bold',
};
export const NEEDS_PHOTO = ['polaroid', 'moodboard'];

// ─── Éléments éditables ────────────────────────────────────────────────────
export const ELEM_LIST = [
  { id: 'titre',  label: 'Titre & auteur' },
  { id: 'note',   label: 'Note étoiles' },
  { id: 'palme',  label: 'Coup de cœur' },
  { id: 'tags',   label: 'Tags & genres' },
  { id: 'avis',   label: 'Extrait avis' },
  { id: 'sig',    label: 'Signature' },
  { id: 'sp',     label: 'Triangle SP' },
];

export const DEFAULT_ELS = Object.fromEntries(ELEM_LIST.map(e => [e.id, true]));
