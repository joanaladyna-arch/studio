
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { Newspaper, Loader2, Archive, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useAdminMode } from "@/components/admin-mode";
import { ActualitesManager } from "@/components/actualites-manager";

// Au-delà de ce nombre de jours, une actualité quitte la liste principale
// et ne reste consultable que dans la section "Archives" — pour que la
// page reste centrée sur les nouvelles récentes plutôt que de s'allonger
// indéfiniment au fil des mois.
const ARCHIVE_AFTER_DAYS = 60;

export default function ActualitesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { adminMode } = useAdminMode();
  const [items, setItems] = useState<any[] | null>(null);
  const [showArchives, setShowArchives] = useState(false);

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

  // Une actualité sans date de publication connue (cas très rare) est
  // traitée comme récente par défaut, plutôt que de disparaître
  // silencieusement dans les archives.
  const { recentItems, archivedItems } = useMemo(() => {
    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const recent: any[] = [];
    const archived: any[] = [];
    (items || []).forEach((item) => {
      const publishedMillis = item.publishedAt?.toMillis?.();
      if (publishedMillis !== undefined && publishedMillis < cutoff) archived.push(item);
      else recent.push(item);
    });
    return { recentItems: recent, archivedItems: archived };
  }, [items]);

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
        <>
          {recentItems.length > 0 ? (
            <div className="space-y-8">
              {recentItems.map((item) => (
                <ActualiteCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <p className="text-muted-foreground italic">Pas de nouvelle actualité dans les {ARCHIVE_AFTER_DAYS} derniers jours.</p>
            </div>
          )}

          {archivedItems.length > 0 && (
            <div className="pt-4">
              <button
                onClick={() => setShowArchives((v) => !v)}
                className="flex items-center gap-3 mx-auto text-primary/60 hover:text-primary transition-colors text-sm font-bold uppercase tracking-widest"
              >
                <Archive className="h-4 w-4" />
                Archives ({archivedItems.length})
                {showArchives ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showArchives && (
                <div className="space-y-8 pt-8 opacity-80">
                  {archivedItems.map((item) => (
                    <ActualiteCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActualiteCard({ item }: { item: any }) {
  return (
    <article className="glass-card rounded-[2rem] overflow-hidden border-none shadow-sm bg-white/60 flex flex-col sm:flex-row gap-6 p-8">
      <div className="flex-1 min-w-0 space-y-3 order-2 sm:order-1">
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
      {item.cover && (
        <div className="w-full sm:w-40 h-48 sm:h-auto flex-shrink-0 order-1 sm:order-2 flex items-center justify-center bg-secondary/5 rounded-2xl">
          <img src={item.cover} alt={item.title} className="max-h-full max-w-full object-contain rounded-xl shadow-md" />
        </div>
      )}
    </article>
  );
}
