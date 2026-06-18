import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sécurise l'accès à un champ qui devrait être un tableau (genres, tropes, etc.)
 * Protège contre les anciens documents Firestore où le champ pourrait être
 * absent, null, ou stocké sous une mauvaise forme (ex: une simple chaîne).
 * Sans ce garde-fou, `(value || []).forEach(...)` plante si `value` est une
 * chaîne non vide, car `||` ne remplace que les valeurs "falsy".
 */
export function toArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Wrapper autour de fetch() qui abandonne l'appel après `timeoutMs`.
 * `fetch()` n'a aucun timeout par défaut : si un service externe (Google
 * Books, Open Library...) ne répond jamais sans lever d'erreur réseau,
 * l'appel reste en attente indéfiniment et bloque toute la suite (spinner
 * qui tourne pour toujours). Ce wrapper garantit qu'on échoue proprement
 * après un délai raisonnable pour pouvoir basculer sur la source suivante.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Interroge notre propre route API /api/bnf-search (voir
 * src/app/api/bnf-search/route.ts), qui relaie une recherche vers le
 * Catalogue général de la BnF côté serveur. Le dépôt légal rend ce
 * catalogue exhaustif pour les éditeurs français, contrairement à
 * Google Books / Open Library qui manquent beaucoup de petites maisons
 * (BMR, Nox, Chatterley...). Échoue toujours silencieusement (tableau
 * vide) : cette source est un bonus, jamais un blocage pour les autres.
 */
export async function searchBnF(
  q: string,
  type: "author" | "isbn" | "publisher" | "general" = "general"
): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(
      `/api/bnf-search?q=${encodeURIComponent(q)}&type=${type}`,
      {},
      8000
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/**
 * Liste des emails autorisés à accéder à /admin. Centralisé ici pour que
 * la page admin et la navigation (qui doit savoir si elle affiche le lien
 * vers /admin) restent toujours synchronisées.
 */
export const ADMIN_EMAILS = ["joanaladyna@gmail.com"];

/**
 * Transforme un texte libre en identifiant de document Firestore sûr
 * (minuscules, sans accents/espaces/caractères spéciaux). Centralisé ici
 * pour que tous les outils qui créent des fiches MasterBook (import
 * Excel, import ISBN, éditeur de fiches...) génèrent le même identifiant
 * pour un même titre+auteur, et ne créent jamais de doublons entre eux.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

/**
 * Nettoie un ISBN de ses tirets/espaces. La recherche principale (page
 * Ajouter) compare toujours des chiffres purs : un ISBN stocké avec des
 * tirets ne serait jamais retrouvé par cette recherche, ce qui créerait
 * un doublon silencieux à la prochaine tentative d'ajout du même livre.
 */
export function cleanIsbnValue(v: string | null | undefined): string {
  const cleaned = (v || "").toString().replace(/[-\s]/g, "").trim();
  // Certaines sources (recherche BnF notamment) utilisent le texte "N/A"
  // comme valeur par défaut en l'absence d'ISBN. Cette chaîne contient un
  // caractère "/" qui, si elle est utilisée telle quelle comme identifiant
  // de document Firestore, casse la construction du chemin ("masterBooks
  // /N/A" est alors lu comme 3 segments séparés au lieu d'un identifiant
  // unique) — d'où le blocage "Invalid document reference" à l'ajout.
  // On la traite donc comme une absence d'ISBN, exactement comme une
  // chaîne vide.
  if (/^n\/?a$/i.test(cleaned)) return "";
  return cleaned;
}

/**
 * Identifiant d'auteur INSENSIBLE À L'ORDRE des mots du nom : les notices
 * bibliographiques inversent souvent nom et prénom ("Kent Rina" en
 * catalogue, "Rina Kent" en couverture). En triant les mots par ordre
 * alphabétique avant de slugifier, les deux donnent le même identifiant
 * (kent-rina), ce qui permet de relier une actualité saisie dans un sens
 * à des livres stockés dans l'autre. À n'utiliser QUE pour le rattachement
 * (suivi, actualités), pas comme identifiant de document MasterBook.
 */
export function authorKey(name: string | null | undefined): string {
  return slugify(
    (name || "")
      .toString()
      .split(/[\s,]+/)
      .filter(Boolean)
      .sort()
      .join(" ")
  );
}

/**
 * Identifiant de fiche STABLE pour un livre sans ISBN (utilisé en
 * dernier recours seulement, l'ISBN restant prioritaire) — pensé pour
 * que de légères variations de saisie ("Lakestone - tome 1", "Lakestone.
 * Tome 1", "Lakestone. Tome 1 / Sarah Rivens") génèrent le MÊME
 * identifiant au lieu de créer une fiche en double à chaque import.
 * Contrairement à un simple slugify(titre-auteur), celui-ci :
 *  - nettoie le nom d'auteur (retire les mentions "Auteur du texte" etc.
 *    insérées par les imports BnF) ;
 *  - retire un éventuel suffixe "/ {auteur}" ajouté en double dans le
 *    titre ;
 *  - ignore la ponctuation, mais CONSERVE les numéros de tome/volume,
 *    pour ne jamais confondre deux tomes différents d'une même série.
 */
export function stableBookKey(title: string | null | undefined, author?: string | null): string {
  let t = (title || "").toString();
  const cleanedAuthor = cleanAuthorName(author);
  if (cleanedAuthor) {
    const a = cleanedAuthor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    t = t.replace(/\s*\/\s*([^/]+)$/, (m, name) => {
      const cand = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return cand === a ? "" : m;
    });
  }
  const normalizedTitle = t
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(tome|volume|vol)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
  const normalizedAuthor = authorKey(cleanedAuthor);
  return `${normalizedTitle}-${normalizedAuthor}`;
}

/**
 * Extrait le numéro de tome/volume d'un titre, pour ordonner les tomes
 * d'une même saga (Tome 1, Tome 2, Tome 3...). Reconnaît "Tome", "T",
 * "Vol"/"Volume", avec ou sans point/espace/n°. Un bonus numéroté
 * ("Bonus 2") se classe juste après son tome ; un bonus sans numéro se
 * classe en toute fin de saga. Sans numéro détecté, renvoie 0 — utile
 * pour un tome 1 jamais explicitement numéroté, ou une œuvre seule.
 */
export function extractTomeRank(title: string | null | undefined): number {
  const text = (title || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bbonus\b/.test(text)) {
    const bonusMatch = text.match(/bonus\D{0,6}(\d+(?:[.,]\d+)?)/);
    if (bonusMatch) return parseFloat(bonusMatch[1].replace(",", ".")) + 0.5;
    return Infinity;
  }
  const match = text.match(/\b(?:tome|t\.?|vol(?:ume)?\.?)\s*n?°?\s*(\d+(?:[.,]\d+)?)\b/);
  if (match) return parseFloat(match[1].replace(",", "."));
  return 0;
}

/**
 * Identifiant de SAGA : titre de base (numéro de tome retiré, ainsi que
 * tout ce qui le suit — sous-titre propre à ce tome) + auteur. Sert à
 * regrouper les tomes d'une même série, contrairement à stableBookKey
 * qui CONSERVE le numéro pour distinguer des fiches individuelles.
 */
export function seriesKey(title: string | null | undefined, author?: string | null): string {
  const base = (title || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bbonus\b.*$/, "")
    .replace(/\b(?:tome|t\.?|vol(?:ume)?\.?)\s*n?°?\s*\d+(?:[.,]\d+)?\b.*$/, "")
    .replace(/[^a-z0-9]/g, "");
  return `${base}-${authorKey(author)}`;
}

/**
 * Réordonne une liste de livres pour regrouper les tomes d'une même
 * saga et les trier (Tome 1, Tome 2, Tome 3, Bonus...), tout en
 * conservant la position relative des différentes sagas / œuvres
 * indépendantes telle qu'elle était dans la liste d'origine — on
 * réorganise localement, sans tout rebattre.
 */
export function sortBySaga<T extends { title?: string; author?: string }>(books: T[]): T[] {
  const order: string[] = [];
  const groups: Record<string, T[]> = {};
  books.forEach((b) => {
    const key = seriesKey(b.title, b.author);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(b);
  });
  return order.flatMap((key) =>
    groups[key].slice().sort((a, b) => extractTomeRank(a.title) - extractTomeRank(b.title))
  );
}


/**
 * Nettoyage défensif, appliqué à l'AFFICHAGE, des artefacts catalographiques
 * qui ont pu être enregistrés dans Firestore avant la correction de
 * l'extraction BnF (mention de responsabilité dupliquée dans le titre,
 * rôle "Auteur du texte" / "Traducteur" mélangé au nom). Une correction
 * de la recherche ne change rien aux livres déjà ajoutés : ces fonctions
 * rattrapent ces anciennes fiches sans avoir à les ré-ajouter.
 */
export function cleanBookTitle(title?: string | null): string {
  if (!title) return title || "";
  return title.split(" / ")[0].split(" ; ")[0].trim();
}

/**
 * Nettoie une description provenant d'une API externe (Google Books
 * notamment) qui contient parfois du HTML basique au lieu de texte brut
 * — <br>, <b>, <i>, <p>... Sans ce nettoyage, ces balises s'affichent
 * littéralement dans les résumés (ex. "<br /><br />Texte...") au lieu de
 * créer de vrais retours à la ligne. Les <br> et <p> deviennent des
 * retours à la ligne réels ; les autres balises sont retirées.
 */
export function cleanDescriptionHtml(desc?: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanAuthorName(author?: string | null): string {
  if (!author) return author || "";
  return author
    .replace(/\.\s*(Auteur(?:e)?\s+du\s+texte|Traduct(?:eur|rice|ion)|Illustrateur(?:rice)?|Préfacier(?:e)?|Adaptateur(?:rice)?)\b\.?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vérifie qu'un livre appartient VRAIMENT à un auteur donné, avant de
 * l'afficher sur sa fiche. Les sources externes (Google Books surtout,
 * via son opérateur "inauthor:", mais aussi la recherche Apple Books qui
 * n'est même pas filtrée par auteur) renvoient parfois des livres qui ne
 * sont pas réellement de cet auteur — homonymes, mentions du nom dans
 * une description, erreurs de leur propre indexation. On ne fait donc
 * jamais confiance au filtrage d'une API externe : ce garde-fou compare,
 * après nettoyage des mentions BnF ("Auteur du texte"...) et
 * indépendamment de l'ordre des mots, chaque auteur du champ (qui peut
 * en contenir plusieurs pour un livre co-écrit) à l'auteur recherché, et
 * n'accepte le livre que s'il y a une correspondance EXACTE — jamais une
 * simple ressemblance.
 */
export function isAuthorMatch(resultAuthor: string | null | undefined, targetAuthor: string | null | undefined): boolean {
  if (!resultAuthor || !targetAuthor) return false;
  const targetKey = authorKey(cleanAuthorName(targetAuthor));
  if (!targetKey) return false;
  const candidates = resultAuthor.split(/,|&|;|\bet\b/i).map((s) => s.trim()).filter(Boolean);
  return candidates.some((c) => authorKey(cleanAuthorName(c)) === targetKey);
}
