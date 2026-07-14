"use client";

import { useMemo } from "react";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";

/**
 * Indique si le fond d'ambiance choisi par la lectrice (voir
 * "Personnaliser mon espace") est une teinte sombre — les titres posés
 * directement sur le fond (pas le texte à l'intérieur des cartes
 * blanches, qui reste inchangé) doivent alors passer en clair pour
 * rester lisibles.
 *
 * Tous les fonds proposés sont désormais des pastels clairs (Vert
 * d'Eau, Saumon, Jaune Clair, Rose Pâle, Parme, Blanc Cassé) — plus
 * aucun ne nécessite de texte clair. La liste reste volontairement en
 * place (vide pour l'instant) pour ne pas avoir à retoucher tous les
 * titres déjà adaptés si un fond sombre était réintroduit plus tard.
 */
const DARK_THEME_IDS = new Set<string>([]);

export function useAmbientDark(): boolean {
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  return DARK_THEME_IDS.has((profile as any)?.themeBackground);
}
