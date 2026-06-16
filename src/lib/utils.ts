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
