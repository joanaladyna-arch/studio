"use client";

import { useMemo } from "react";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { getThemeBackground } from "@/lib/theme-backgrounds";

/**
 * Calque de fond d'ambiance, positionné derrière tout le contenu de
 * l'app. Ne modifie jamais les cartes, boutons ou textes existants —
 * uniquement l'espace visible autour d'eux. Si aucun thème n'est choisi
 * (ou "default"), ne rend rien : le fond crème habituel (bg-background)
 * reste seul visible, comportement strictement identique à avant pour
 * toute lectrice n'ayant jamais ouvert "Personnaliser mon espace".
 */
export function ThemeBackgroundLayer() {
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const theme = getThemeBackground((profile as any)?.themeBackground);
  if (!theme.gradient) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ background: theme.gradient, zIndex: -1 }}
    />
  );
}
