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
  return (v || "").toString().replace(/[-\s]/g, "").trim();
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

export function cleanAuthorName(author?: string | null): string {
  if (!author) return author || "";
  return author
    .replace(/\.\s*(Auteur(?:e)?\s+du\s+texte|Traduct(?:eur|rice|ion)|Illustrateur(?:rice)?|Préfacier(?:e)?|Adaptateur(?:rice)?)\b\.?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
