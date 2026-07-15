"use client";

import { useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

/**
 * Enregistre silencieusement la date du jour (YYYY-MM-DD) dans
 * users/{uid}.appOpenDays à chaque ouverture de l'app — sert
 * uniquement à alimenter les 7 pastilles L M M J V S D du Profil.
 * arrayUnion évite les doublons pour une même journée. Aucune UI,
 * aucun effet visible directement.
 */
export function TrackAppOpen() {
  const { user } = useUser();
  const db = useFirestore();

  useEffect(() => {
    if (!db || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    const ref = doc(db, "users", user.uid);
    updateDoc(ref, { appOpenDays: arrayUnion(today) }).catch(() => {
      // Le document peut ne pas encore exister pour une toute nouvelle
      // inscription — on le crée alors en fusion plutôt que d'échouer.
      setDoc(ref, { appOpenDays: [today] }, { merge: true }).catch(() => {});
    });
  }, [db, user]);

  return null;
}
