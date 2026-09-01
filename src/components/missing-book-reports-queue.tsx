"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Flag, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * File d'attente des signalements "livre introuvable" (bouton sur la
 * page de recherche vide, /add). Même esprit que PublisherReviewQueue :
 * un signalement ne crée jamais rien automatiquement, c'est toujours
 * l'administratrice qui ajoute la fiche elle-même avec les outils
 * existants — "Marquer comme traité" ne fait que retirer l'entrée de
 * la liste "en attente", rien de plus.
 */

type ReportStatus = "pending" | "resolved";

export function MissingBookReportsQueue() {
  const db = useFirestore();
  const [reports, setReports] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<ReportStatus>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "missingBookReports"), orderBy("createdAt", "desc")))
      .then((snap) => setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))))
      .catch((err) => {
        console.error("Load Missing Book Reports Error:", err);
        setReports([]);
      });
  }, [db]);

  const counts = useMemo(() => {
    const c: Record<ReportStatus, number> = { pending: 0, resolved: 0 };
    (reports || []).forEach((r) => {
      const st = (r.status || "pending") as ReportStatus;
      if (c[st] !== undefined) c[st]++;
    });
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    return (reports || []).filter((r) => (r.status || "pending") === activeTab);
  }, [reports, activeTab]);

  const setStatus = async (id: string, status: ReportStatus) => {
    if (!db) return;
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, "missingBookReports", id), { status, updatedAt: new Date() });
      setReports((prev) => (prev || []).map((r) => (r.id === id ? { ...r, status } : r)));

      // Prévient la lectrice qui avait signalé le livre — une seule fois
      // (notifiedAt), même si le statut est ensuite remis "en attente"
      // puis "traité" à nouveau par erreur.
      const report = (reports || []).find((r) => r.id === id);
      if (status === "resolved" && report?.createdBy && !report?.notifiedAt) {
        await addDoc(collection(db, "notifications"), {
          type: "book_added",
          title: "Livre ajouté !",
          body: `"${report.title}" que tu avais signalé est maintenant disponible sur Lectoria.`,
          link: "/add",
          targetUid: report.createdBy,
          read: false,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "missingBookReports", id), { notifiedAt: serverTimestamp() });
        setReports((prev) => (prev || []).map((r) => (r.id === id ? { ...r, notifiedAt: true } : r)));
      }
    } catch (err) {
      console.error("Update Report Status Error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="glass-card border-none bg-white/60 shadow-xl">
      <CardHeader className="p-10 border-b border-primary/5">
        <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
          <Flag className="h-8 w-8 text-rose" /> Livres signalés manquants
          {counts.pending > 0 && (
            <span className="h-7 min-w-7 px-2 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
              {counts.pending}
            </span>
          )}
        </CardTitle>
        <CardDescription className="italic">
          Signalés depuis la page de recherche vide — rien n'est créé automatiquement, à toi d'ajouter la fiche.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          {([
            { id: "pending" as const, label: "En attente", icon: Clock },
            { id: "resolved" as const, label: "Traités", icon: CheckCircle2 },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-10 px-4 rounded-2xl italic font-headline text-sm transition-all flex items-center gap-2",
                activeTab === tab.id ? "bg-primary text-white shadow-lg" : "bg-white/60 text-primary/60 hover:bg-white"
              )}
            >
              <tab.icon className="h-4 w-4" /> {tab.label} ({counts[tab.id]})
            </button>
          ))}
        </div>

        {reports === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm italic opacity-50 text-center py-10">Aucun signalement dans cette catégorie.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white/40 p-5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-headline italic text-lg">{r.title}</p>
                  <span className="text-[10px] opacity-40">
                    {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('fr-FR') : ""}
                  </span>
                </div>
                {r.author && <p className="text-xs italic opacity-60">Auteur : {r.author}</p>}
                {r.searchQuery && r.searchQuery !== r.title && (
                  <p className="text-[10px] opacity-40">Recherché comme : "{r.searchQuery}"</p>
                )}
                {r.comment && <p className="text-sm italic opacity-70 whitespace-pre-line">{r.comment}</p>}
                <div className="flex gap-2 pt-1">
                  {activeTab === "pending" ? (
                    <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => setStatus(r.id, "resolved")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                      <CheckCircle2 className="h-3 w-3 mr-1.5" /> Marquer comme traité
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => setStatus(r.id, "pending")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                      <Clock className="h-3 w-3 mr-1.5" /> Remettre en attente
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
