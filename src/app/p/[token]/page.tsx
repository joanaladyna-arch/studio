"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, setDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useFirestore, useUser, useDoc } from "@/firebase";
import { PublicProfileView, themeVars } from "@/components/public-profile-view";
import { toArray } from "@/lib/utils";
import { notifyUser } from "@/lib/salon";
import type { ShareDoc } from "@/lib/public-profile";

/**
 * Page publique d'un "profil visible" : lecture seule, accessible sans
 * compte via le lien privé /p/{jeton}. Lit uniquement profileShares/{jeton}
 * (get par jeton exact) — jamais la bibliothèque ni users/{uid}.
 */
export default function SharedProfilePage() {
  const params = useParams();
  const token = params?.token as string;
  const db = useFirestore();
  const { user } = useUser();
  const [data, setData] = useState<ShareDoc | null | undefined>(undefined);

  useEffect(() => {
    if (!db || !token) return;
    let cancelled = false;
    getDoc(doc(db, "profileShares", token))
      .then((snap) => { if (!cancelled) setData(snap.exists() ? (snap.data() as ShareDoc) : null); })
      .catch((err) => { console.error("Shared profile read:", err); if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [db, token]);

  useEffect(() => {
    if (data?.name) document.title = `${data.name} sur Lectoria`;
  }, [data]);

  const myRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: me } = useDoc(myRef);
  const [followBusy, setFollowBusy] = useState(false);
  const following = !!data && toArray<string>((me as any)?.followedUsers).includes(data.uid);

  const toggleFollow = async () => {
    if (!db || !user || !data) return;
    setFollowBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), { followedUsers: following ? arrayRemove(data.uid) : arrayUnion(data.uid) }, { merge: true });
      const entry = doc(db, "followers", data.uid, "entries", user.uid);
      if (following) await deleteDoc(entry);
      else {
        await setDoc(entry, { followedAt: serverTimestamp() });
        notifyUser(db, user, data.uid, {
          type: "new_follower",
          id: `follow_${user.uid}_${data.uid}`,
          title: "Nouvelle abonnée",
          body: `${(me as any)?.name || "Une lectrice"} te suit désormais.`,
          link: `/profile/${user.uid}`,
        });
      }
    } catch (err) {
      console.error("Follow from shared profile:", err);
    } finally {
      setFollowBusy(false);
    }
  };

  if (data === undefined) {
    return (
      <div className="pv-theme pv-page" data-theme="creme" style={{ display: "grid", placeItems: "center" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ opacity: 0.4 }} />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="pv-theme pv-page" data-theme="creme" style={{ display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ fontFamily: "var(--pv-font-d)", fontStyle: "italic", fontSize: 24, margin: 0 }}>Ce lien n'est plus actif.</p>
          <p style={{ margin: "8px 0 20px", color: "var(--pv-muted)" }}>La lectrice a désactivé ou renouvelé le partage de son profil.</p>
          <Link href="/login" className="pv-gbtn pv-alt" style={{ display: "inline-flex" }}>Découvrir Lectoria</Link>
        </div>
      </div>
    );
  }

  const isOwner = !!user && user.uid === data.uid;
  const cta = isOwner ? (
    <Link href="/profile" className="pv-gbtn pv-alt">Retour à mon profil</Link>
  ) : user ? (
    <button type="button" className={`pv-gbtn${following ? "" : " pv-alt"}`} onClick={toggleFollow} disabled={followBusy}>
      {following ? "Suivie" : "Suivre"}
    </button>
  ) : (
    <>
      <Link href="/signup" className="pv-gbtn">Rejoindre Lectoria</Link>
      <Link href="/login" className="pv-gbtn pv-alt">Suivre</Link>
    </>
  );

  return (
    <div className="pv-theme pv-page" data-theme={data.theme} style={themeVars(data.theme)}>
      <PublicProfileView data={data} cta={cta} />
    </div>
  );
}
