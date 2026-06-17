
"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { GENRES_LIST, TROPES_LIST, THEMES_LIST } from "@/app/library/page";

/**
 * Listes de genres / tropes / thèmes, fusionnées entre :
 *  - les listes de BASE définies dans le code (jamais supprimées : elles
 *    garantissent que les badges/médailles du profil, qui s'appuient
 *    dessus, ne cassent jamais) ;
 *  - les personnalisations de l'admin stockées dans Firestore
 *    (config/taxonomy) : des entrées AJOUTÉES, et des entrées MASQUÉES.
 *
 * Principe de sûreté : masquer une entrée de base ne fait que la retirer
 * des choix proposés à l'ajout — les livres déjà tagués avec gardent leur
 * tag (le tag est stocké en texte libre sur la fiche, pas en référence).
 * Aucune donnée existante n'est donc jamais perdue.
 *
 * On lit en temps réel (onSnapshot) pour que tout changement fait dans
 * l'éditeur soit immédiatement répercuté partout dans l'app.
 */

type Taxonomy = {
  genres: string[];
  tropes: string[];
  themes: string[];
};

type TaxonomyConfig = {
  addedGenres?: string[];
  addedTropes?: string[];
  addedThemes?: string[];
  hiddenGenres?: string[];
  hiddenTropes?: string[];
  hiddenThemes?: string[];
};

function merge(base: string[], added: string[] = [], hidden: string[] = []): string[] {
  const hiddenSet = new Set(hidden);
  const seen = new Set<string>();
  const out: string[] = [];
  [...base, ...added].forEach((item) => {
    const key = item.trim();
    if (!key || hiddenSet.has(key) || seen.has(key.toLowerCase())) return;
    seen.add(key.toLowerCase());
    out.push(key);
  });
  return out;
}

export function useTaxonomy(): Taxonomy & { loaded: boolean } {
  const db = useFirestore();
  const [config, setConfig] = useState<TaxonomyConfig>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, "config", "taxonomy"),
      (snap) => {
        setConfig(snap.exists() ? (snap.data() as TaxonomyConfig) : {});
        setLoaded(true);
      },
      () => setLoaded(true) // échec silencieux : on garde les listes de base
    );
    return () => unsub();
  }, [db]);

  return {
    genres: merge(GENRES_LIST, config.addedGenres, config.hiddenGenres),
    tropes: merge(TROPES_LIST, config.addedTropes, config.hiddenTropes),
    themes: merge(THEMES_LIST, config.addedThemes, config.hiddenThemes),
    loaded,
  };
}
