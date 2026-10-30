"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { Heart, Loader2 } from "lucide-react";
import { useDoc, useFirestore, useUser } from "@/firebase";
import { BookCover } from "@/components/book-cover";
import { cn, toArray } from "@/lib/utils";
import { prefillLink } from "@/lib/salon";

/**
 * Prochaines sorties : lit les mêmes données que l'ancienne page
 * Actualités (collection `actualites`, entrées isRelease avec releaseDate,
 * alimentées par la détection automatique) — rien à saisir à la main.
 */
export function ReleasesTab() {
  const { user } = useUser();
  const db = useFirestore();
  const [items, setItems] = useState<any[] | null>(null);
  const [mine, setMine] = useState(true);

  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const followed = toArray<string>((profile as any)?.followedAuthors);

  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "actualites"))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))))
      .catch((err) => { console.error("Load releases:", err); setItems([]); });
  }, [db]);

  // Ouvrir cet onglet éteint le point d'alerte du Lounge dans la navigation.
  useEffect(() => {
    if (profileRef) setDoc(profileRef, { lastSeenActualityAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [profileRef]);

  const groups = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - 3); from.setHours(0, 0, 0, 0);
    const list = (items || [])
      .filter((i) => i.isRelease && i.releaseDate && !i.archived)
      .filter((i) => { const d = new Date(`${i.releaseDate}T12:00:00`); return !isNaN(d.getTime()) && d >= from; })
      .filter((i) => !mine || (i.authorSlug && followed.includes(i.authorSlug)))
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    const out: { label: string; items: any[] }[] = [];
    list.forEach((i) => {
      const d = new Date(`${i.releaseDate}T12:00:00`);
      const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(i); else out.push({ label, items: [i] });
    });
    return out;
  }, [items, mine, followed]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Filtre des sorties">
        {[{ k: true, l: "Mes auteurs suivis" }, { k: false, l: "Toutes les sorties" }].map((o) => (
          <button key={String(o.k)} type="button" role="radio" aria-checked={mine === o.k} onClick={() => setMine(o.k)}
            className={cn("rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors", mine === o.k ? "border-rose bg-rose/15" : "border-primary/10 bg-white/60 hover:border-rose/50")}>
            {o.l}
          </button>
        ))}
      </div>
      <p className="text-xs italic text-muted-foreground">Les sorties détectées automatiquement. Suis des auteurs depuis leur page pour les retrouver ici.</p>

      {items === null ? (
        <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40" /></div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-10 text-center bg-white/60 border-none">
          <p className="italic text-muted-foreground">{mine ? "Aucune sortie à venir pour les auteurs que tu suis." : "Aucune sortie à venir pour l'instant."}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="space-y-3">
            <h3 className="font-headline italic text-2xl capitalize">{g.label}</h3>
            {g.items.map((i) => {
              const d = new Date(`${i.releaseDate}T12:00:00`);
              return (
                <div key={i.id} className="glass-card bg-white/60 border-none p-3 flex items-center gap-4">
                  <div className="shrink-0 w-14 text-center rounded-2xl bg-rose/15 text-primary py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider">{d.toLocaleDateString("fr-FR", { month: "short" })}</p>
                    <p className="font-headline text-xl leading-none font-bold">{d.getDate()}</p>
                  </div>
                  <div className="relative h-16 w-11 shrink-0 rounded-md overflow-hidden bg-primary/5">
                    <BookCover src={i.cover} alt={i.title || ""} className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-headline italic text-lg leading-tight">{i.title}</p>
                    {i.authorName && (
                      <Link href={`/author/${encodeURIComponent(i.authorName)}`} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">{i.authorName}</Link>
                    )}
                  </div>
                  <Link href={prefillLink({ title: i.title, author: i.authorName, cover: i.cover })}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-primary/10 bg-white px-3 py-1.5 text-xs font-semibold hover:border-rose/50 transition-colors">
                    <Heart className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ajouter à ma wishlist</span><span className="sm:hidden">Ajouter</span>
                  </Link>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
