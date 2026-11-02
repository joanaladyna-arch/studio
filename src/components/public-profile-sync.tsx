"use client";

import { useEffect, useMemo, useRef } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
import { buildShareDoc, mergeSettings } from "@/lib/public-profile";

/**
 * Garde la copie publique du "profil visible" à jour (profileShares/{jeton})
 * quand la lectrice a activé son lien : sa wishlist, sa PAL, son avis... sont
 * affichés en direct. Ne fait strictement rien tant que le lien n'est pas
 * actif. Une écriture au plus toutes les quelques secondes, et seulement si
 * le contenu a réellement changé.
 */
export function PublicProfileSync() {
  const { user } = useUser();
  const db = useFirestore();

  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const settings = useMemo(() => mergeSettings((profile as any)?.visibleProfile), [profile]);
  const active = settings.shareActive && !!settings.shareToken;

  const booksRef = useMemo(() => (active && db && user ? collection(db, "users", user.uid, "books") : null), [active, db, user]);
  const savedRef = useMemo(() => (active && settings.show.quotes && db && user ? collection(db, "users", user.uid, "savedQuotes") : null), [active, settings.show.quotes, db, user]);
  const { data: books = [] } = useCollection(booksRef);
  const { data: saved = [] } = useCollection(savedRef);

  const lastHash = useRef<string>("");

  useEffect(() => {
    if (!active || !db || !user || !profile) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await buildShareDoc({ uid: user.uid, profile, books: books as any[], saved: saved as any[], settings });
        const hash = JSON.stringify(data);
        const key = `lisoria-share-${settings.shareToken}`;
        let previous = lastHash.current;
        if (!previous) { try { previous = sessionStorage.getItem(key) || ""; } catch { /* ignoré */ } }
        if (cancelled || hash === previous) return;
        await setDoc(doc(db, "profileShares", settings.shareToken), { ...data, updatedAt: Date.now() });
        lastHash.current = hash;
        try { sessionStorage.setItem(key, hash); } catch { /* ignoré */ }
      } catch (err) {
        console.error("Public profile sync:", err);
      }
    }, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, db, user, profile, books, saved, settings]);

  return null;
}
