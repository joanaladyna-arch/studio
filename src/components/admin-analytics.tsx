"use client";

import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, orderBy, query, limit, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, Search, TrendingUp, BookX, Clock } from "lucide-react";

/**
 * Tableau de bord analytics admin — deux sections :
 *
 * 1. QUI UTILISE L'APP
 *    Chargé depuis la collection `users` (documents profil) : nom,
 *    email, date de création, nb de livres en bibliothèque. Ne lit que
 *    les données déjà stockées, sans aucune écriture supplémentaire.
 *
 * 2. QUELLES RECHERCHES SONT FAITES
 *    Chargé depuis la collection `searchLogs` (créée par le patch 36
 *    dans add/page.tsx) : terme, date, si des résultats ont été trouvés.
 *    Les recherches sans résultat sont les plus précieuses — elles
 *    indiquent les livres à enrichir en priorité dans la base.
 *
 * Tout est en lecture seule ici — aucune écriture, aucune modification.
 */

export function AdminAnalytics() {
  const db = useFirestore();

  const [users, setUsers] = useState<any[] | null>(null);
  const [searchLogs, setSearchLogs] = useState<any[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "searches">("users");

  useEffect(() => {
    if (!db) return;

    // Charge les utilisateurs
    setLoadingUsers(true);
    getDocs(collection(db, "users"))
      .then(async (snap) => {
        const list = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            // Compte les livres de chaque lectrice
            let bookCount = 0;
            try {
              const booksSnap = await getDocs(collection(db, "users", d.id, "books"));
              bookCount = booksSnap.size;
            } catch { /* silencieux */ }
            return {
              id: d.id,
              name: data.name || data.displayName || "—",
              email: data.email || "—",
              createdAt: data.createdAt,
              lastUpdated: data.lastUpdated,
              bookCount,
            };
          })
        );
        // Tri par date de création décroissante
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setUsers(list);
      })
      .catch((err) => {
        console.error("Load Users Error:", err);
        setUsers([]);
      })
      .finally(() => setLoadingUsers(false));

    // Charge les logs de recherche (200 derniers)
    setLoadingLogs(true);
    getDocs(query(collection(db, "searchLogs"), orderBy("createdAt", "desc"), limit(200)))
      .then((snap) => {
        setSearchLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((err) => {
        console.error("Load Search Logs Error:", err);
        setSearchLogs([]);
      })
      .finally(() => setLoadingLogs(false));
  }, [db]);

  // Agrège les logs : top recherches + recherches sans résultat
  const topSearches = (() => {
    if (!searchLogs) return [];
    const counts: Record<string, { count: number; hasResults: boolean }> = {};
    for (const log of searchLogs) {
      const q = (log.query || "").toLowerCase().trim();
      if (!q) continue;
      if (!counts[q]) counts[q] = { count: 0, hasResults: log.hasResults };
      counts[q].count++;
      if (log.hasResults) counts[q].hasResults = true;
    }
    return Object.entries(counts)
      .map(([q, { count, hasResults }]) => ({ query: q, count, hasResults }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  })();

  const noResultSearches = topSearches.filter((s) => !s.hasResults);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Card className="glass-card border-none bg-white/60 shadow-xl">
      <CardHeader className="p-10 border-b border-primary/5">
        <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" /> Tableau de bord
        </CardTitle>
        <CardDescription className="italic">
          Qui utilise Lectoria · Quelles recherches sont faites · Quels livres enrichir en priorité
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 space-y-6">

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`h-10 px-5 rounded-2xl italic font-headline text-sm transition-all flex items-center gap-2 ${activeTab === "users" ? "bg-primary text-white shadow-lg" : "bg-white/60 text-primary/60 hover:bg-white"}`}
          >
            <Users className="h-4 w-4" />
            Lectrices ({users?.length ?? "…"})
          </button>
          <button
            onClick={() => setActiveTab("searches")}
            className={`h-10 px-5 rounded-2xl italic font-headline text-sm transition-all flex items-center gap-2 ${activeTab === "searches" ? "bg-primary text-white shadow-lg" : "bg-white/60 text-primary/60 hover:bg-white"}`}
          >
            <Search className="h-4 w-4" />
            Recherches ({searchLogs?.length ?? "…"})
          </button>
        </div>

        {/* === ONGLET LECTRICES === */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {loadingUsers ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>
            ) : !users || users.length === 0 ? (
              <p className="text-sm italic opacity-50 text-center py-10">Aucune lectrice inscrite pour l'instant.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="rounded-2xl bg-primary/5 p-4 text-center">
                    <p className="text-3xl font-headline italic">{users.length}</p>
                    <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Inscrites</p>
                  </div>
                  <div className="rounded-2xl bg-primary/5 p-4 text-center">
                    <p className="text-3xl font-headline italic">{users.filter(u => u.bookCount > 0).length}</p>
                    <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Actives</p>
                  </div>
                  <div className="rounded-2xl bg-primary/5 p-4 text-center">
                    <p className="text-3xl font-headline italic">{Math.round(users.reduce((s, u) => s + u.bookCount, 0) / Math.max(users.filter(u => u.bookCount > 0).length, 1))}</p>
                    <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Livres moy.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/5 bg-white/40 overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_80px_100px] gap-0 px-5 py-3 bg-primary/5 text-[10px] uppercase font-bold tracking-widest opacity-60">
                    <span>Nom</span><span>Email</span><span className="text-center">Livres</span><span className="text-right">Inscrite le</span>
                  </div>
                  <div className="divide-y divide-primary/5 max-h-96 overflow-y-auto">
                    {users.map((u) => (
                      <div key={u.id} className="grid grid-cols-[1fr_1fr_80px_100px] gap-0 px-5 py-3 items-center hover:bg-primary/3 transition-colors">
                        <span className="font-headline italic truncate pr-2">{u.name}</span>
                        <span className="text-xs opacity-60 truncate pr-2">{u.email}</span>
                        <span className="text-center text-sm font-bold">{u.bookCount}</span>
                        <span className="text-right text-xs opacity-40">{formatDate(u.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* === ONGLET RECHERCHES === */}
        {activeTab === "searches" && (
          <div className="space-y-6">
            {loadingLogs ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>
            ) : !searchLogs || searchLogs.length === 0 ? (
              <p className="text-sm italic opacity-50 text-center py-10">
                Aucune recherche enregistrée pour l'instant — les logs se rempliront au fur et à mesure des recherches.
              </p>
            ) : (
              <>
                {/* Recherches sans résultat = livres à ajouter en priorité */}
                {noResultSearches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BookX className="h-5 w-5 text-rose-400" />
                      <h4 className="font-headline italic text-lg">À enrichir en priorité</h4>
                      <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                        {noResultSearches.length} sans résultat
                      </span>
                    </div>
                    <p className="text-xs italic opacity-50">Ces livres ont été cherchés mais pas trouvés — enrichis la base avec ces titres.</p>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 overflow-hidden">
                      <div className="divide-y divide-rose-100 max-h-60 overflow-y-auto">
                        {noResultSearches.map((s) => (
                          <div key={s.query} className="flex items-center justify-between px-5 py-3">
                            <span className="font-headline italic">{s.query}</span>
                            <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                              {s.count}× cherché
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top recherches globales */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h4 className="font-headline italic text-lg">Top recherches</h4>
                  </div>
                  <div className="rounded-2xl border border-primary/5 bg-white/40 overflow-hidden">
                    <div className="divide-y divide-primary/5 max-h-72 overflow-y-auto">
                      {topSearches.map((s, i) => (
                        <div key={s.query} className="flex items-center gap-3 px-5 py-3">
                          <span className="text-xs font-bold opacity-30 w-5">{i + 1}</span>
                          <span className="flex-1 font-headline italic">{s.query}</span>
                          {!s.hasResults && (
                            <span className="text-[9px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">sans résultat</span>
                          )}
                          <span className="text-xs font-bold text-primary/60 shrink-0">{s.count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
