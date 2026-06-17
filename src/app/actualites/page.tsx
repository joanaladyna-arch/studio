
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { Newspaper, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAdminMode } from "@/components/admin-mode";
import { ActualitesManager } from "@/components/actualites-manager";

export default function ActualitesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { adminMode } = useAdminMode();
  const [items, setItems] = useState<any[] | null>(null);

  const profileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "actualites"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        list.sort((a, b) => (b.publishedAt?.toMillis?.() || 0) - (a.publishedAt?.toMillis?.() || 0));
        setItems(list);
      })
      .catch((err) => {
        console.error("Load Actualites Error:", err);
        setItems([]);
      });
  }, [db]);

  // En visitant la page, on marque les actualités comme vues — ça éteint
  // le point d'alerte sur la navigation pour les auteurs suivis.
  useEffect(() => {
    if (!db || !profileRef) return;
    setDoc(profileRef, { lastSeenActualityAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [db, profileRef]);

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-3xl mx-auto px-4">
      <header className="text-center space-y-4 pt-8">
        <Newspaper className="h-10 w-10 mx-auto text-primary/40" />
        <h1 className="text-6xl font-headline tracking-tight italic">Actualités</h1>
        <p className="text-primary/60 italic font-medium">Les dernières nouvelles de vos auteurs, et du monde littéraire.</p>
      </header>

      {adminMode && (
        <div className="rounded-[2rem] border-2 border-primary/20 bg-primary/5 p-6">
          <ActualitesManager />
        </div>
      )}

      {items === null ? (
        <div className="py-24 text-center flex flex-col items-center gap-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <p className="text-muted-foreground italic text-lg">Aucune actualité publiée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {items.map((item) => (
            <article key={item.id} className="glass-card rounded-[2rem] overflow-hidden border-none shadow-sm bg-white/60">
              {item.cover && (
                <div className="w-full aspect-[16/9] bg-secondary/5 relative overflow-hidden">
                  <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-8 space-y-3">
                {item.authorName ? (
                  <Link href={`/author/${encodeURIComponent(item.authorName)}`} className="text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors">
                    {item.authorName}
                  </Link>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Actualité littéraire</span>
                )}
                <h2 className="text-2xl font-headline italic leading-tight">{item.title}</h2>
                <p className="text-muted-foreground italic leading-relaxed whitespace-pre-line">{item.content}</p>
                {item.publishedAt?.toDate && (
                  <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest pt-2">
                    {item.publishedAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
