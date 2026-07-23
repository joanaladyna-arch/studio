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

export function usePublishers(): string[] {
  const db = useFirestore();
  const [publishers, setPublishers] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;

    const unsubscribe = onSnapshot(
      collection(db, "masterBooks"),
      (snap) => {
        const set = new Set<string>();
        snap.forEach((doc) => {
          const pub = (doc.data()?.publisher || "").trim();
          // Nettoyer les localisations entre parenthèses ex: "Éditions Addictives (Paris)"
          const cleaned = pub.replace(/\s*\([^)]*\)\s*/g, "").trim();
          if (cleaned.length > 1) set.add(cleaned);
        });
        setPublishers(Array.from(set).sort((a, b) => a.localeCompare(b, "fr")));
      },
      (err) => {
        console.error("usePublishers error:", err);
      }
    );

    return () => unsubscribe();
  }, [db]);

  return publishers;
}
