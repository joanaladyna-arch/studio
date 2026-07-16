
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { Newspaper, Loader2, Archive, ChevronDown, ChevronUp, Landmark } from "lucide-react";
import Link from "next/link";
import { useAdminMode } from "@/components/admin-mode";
import { ActualitesManager } from "@/components/actualites-manager";
import { PendingActualitesManager } from "@/components/pending-actualites-manager";

// Au-delà de ce nombre de jours, une actualité quitte la liste principale
// et ne reste consultable que dans la section "Archives" — pour que la
// page reste centrée sur les nouvelles récentes plutôt que de s'allonger
// indéfiniment au fil des mois.
const ARCHIVE_AFTER_DAYS = 60;

export default function ActualitesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { adminMode } = useAdminMode();
  const isAmbientDark = useAmbientDark();
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
  const { recentItems, archivedItems, weekReleases } = useMemo(() => {
    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const recent: any[] = [];
    const archived: any[] = [];
    const releases: any[] = [];

    // "Cette semaine" = fenêtre glissante de 3 jours avant à 7 jours
    // après aujourd'hui, pour couvrir aussi bien une sortie qui vient
    // de paraître qu'une sortie annoncée pour dans quelques jours.
    const now = new Date();
    const windowStart = new Date(now); windowStart.setDate(now.getDate() - 3); windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(now); windowEnd.setDate(now.getDate() + 7); windowEnd.setHours(23, 59, 59, 999);

    (items || []).forEach((item) => {
      if (item.isRelease && item.releaseDate) {
        const d = new Date(`${item.releaseDate}T12:00:00`);
        if (!isNaN(d.getTime()) && d >= windowStart && d <= windowEnd) {
          releases.push(item);
          return; // épinglée dans le bandeau, pas dupliquée dans le flux
        }
      }
      const publishedMillis = item.publishedAt?.toMillis?.();
      if (publishedMillis !== undefined && publishedMillis < cutoff) archived.push(item);
      else recent.push(item);
    });
    releases.sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
    return { recentItems: recent, archivedItems: archived, weekReleases: releases };
  }, [items]);

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-3xl mx-auto px-4">
      <header className="text-center space-y-4 pt-8">
        <Newspaper className="h-10 w-10 mx-auto text-primary/40" />
        <h1 className={cn("text-3xl sm:text-4xl md:text-6xl font-headline tracking-tight italic", isAmbientDark && "text-[#F5F1E8]")}>Actualités</h1>
        <p className={cn("italic font-medium", isAmbientDark ? "text-[#F5F1E8]/70" : "text-primary/60")}>Les dernières nouvelles de vos auteurs, et du monde littéraire.</p>
      </header>

      {adminMode && <PendingActualitesManager />}

      {adminMode && (
        <div className="rounded-[2rem] border-2 border-primary/20 bg-primary/5 p-6">
          <ActualitesManager />
        </div>
      )}

      {weekReleases.length > 0 && (
        <div className="-mx-4 sm:mx-0 rounded-none sm:rounded-[2rem] bg-primary px-4 sm:px-8 py-6 sm:py-8 overflow-hidden">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose">Sorties de la semaine</p>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {weekReleases.map((item) => {
              const d = new Date(`${item.releaseDate}T12:00:00`);
              const dateLabel = isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
              return (
                <Link key={item.id} href={item.authorSlug ? `/author/${encodeURIComponent(item.authorName)}` : "#"} className="shrink-0 w-28 group">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl bg-white/10">
                    {item.cover ? (
                      <img src={item.cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                        <Newspaper className="h-6 w-6 text-white/30" />
                      </div>
                    )}
                  </div>
                  <p className="font-headline italic text-xs text-primary-foreground mt-2 leading-tight line-clamp-2">{item.title}</p>
                  {item.authorName && <p className="text-[9px] text-primary-foreground/50 mt-0.5 truncate">{item.authorName}</p>}
                  {dateLabel && (
                    <span className="inline-block mt-1 text-[8px] font-bold uppercase tracking-wide text-copper bg-copper/15 rounded-full px-2 py-0.5">
                      {dateLabel}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
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
        ) : item.publisherName ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-copper/70 flex items-center gap-1.5">
            <Landmark className="h-3 w-3" /> {item.publisherName}
          </span>
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
