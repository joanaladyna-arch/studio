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
