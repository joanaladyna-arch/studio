"use client";

/**
 * usePublishers — liste en temps réel de toutes les maisons d'édition
 * référencées dans la collection masterBooks de Lectoria.
 *
 * Utilise onSnapshot pour se mettre à jour automatiquement dès qu'un
 * nouveau livre est ajouté à la base. Retourne un tableau de noms
 * triés alphabétiquement, dédupliqués et nettoyés.
 */

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { publisherKey } from "@/lib/utils";

export function usePublishers(): string[] {
  const db = useFirestore();
  const [publishers, setPublishers] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;

    const unsubscribe = onSnapshot(
      collection(db, "masterBooks"),
      (snap) => {
        // Groupées par forme normalisée (publisherKey) plutôt que par
        // chaîne exacte : "Editions Addictives", "Edition Addictives" et
        // "Addictives" ne doivent proposer qu'UNE seule entrée à
        // l'autocomplete, pas trois. Le libellé affiché est celui qui
        // revient le plus souvent dans masterBooks (vote majoritaire),
        // pour retomber sur la graphie la plus courante plutôt qu'une
        // variante arbitraire.
        const counts = new Map<string, Map<string, number>>();
        snap.forEach((doc) => {
          const pub = (doc.data()?.publisher || "").trim();
          const cleaned = pub.replace(/\s*\([^)]*\)\s*/g, "").trim();
          if (cleaned.length <= 1) return;
          const key = publisherKey(cleaned);
          if (!key) return;
          const variants = counts.get(key) || new Map<string, number>();
          variants.set(cleaned, (variants.get(cleaned) || 0) + 1);
          counts.set(key, variants);
        });

        const result: string[] = [];
        counts.forEach((variants) => {
          let best = "";
          let bestCount = -1;
          variants.forEach((count, variant) => {
            if (count > bestCount) { best = variant; bestCount = count; }
          });
          result.push(best);
        });
        setPublishers(result.sort((a, b) => a.localeCompare(b, "fr")));
      },
      (err) => {
        console.error("usePublishers error:", err);
      }
    );

    return () => unsubscribe();
  }, [db]);

  return publishers;
}
