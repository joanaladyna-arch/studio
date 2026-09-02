"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Quote, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * File de modération des citations proposées par les lectrices (voir
 * quote-submission-dialog.tsx) — même esprit que PublisherReviewQueue et
 * MissingBookReportsQueue. "Approuver" ajoute la citation au pool
 * partagé de "Un jour, une citation" (getDailyQuote lit directement
 * `quoteSubmissions` où status == "approved", pas de collection
 * séparée) — à faire uniquement après avoir vérifié que l'auteur cité
 * est bien dans le domaine public, la validation ne fait aucune
 * vérification automatique des droits.
 */
export function QuoteSubmissionsQueue() {
  const db = useFirestore();
  const [submissions, setSubmissions] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<SubmissionStatus>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "quoteSubmissions"), orderBy("createdAt", "desc")))
      .then((snap) => setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))))
      .catch((err) => {
        console.error("Load Quote Submissions Error:", err);
        setSubmissions([]);
      });
  }, [db]);

  const counts = useMemo(() => {
    const c: Record<SubmissionStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    (submissions || []).forEach((s) => {
      const st = (s.status || "pending") as SubmissionStatus;
      if (c[st] !== undefined) c[st]++;
    });
    return c;
  }, [submissions]);

  const filtered = useMemo(() => {
    return (submissions || []).filter((s) => (s.status || "pending") === activeTab);
  }, [submissions, activeTab]);

  const setStatus = async (id: string, status: SubmissionStatus) => {
    if (!db) return;
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, "quoteSubmissions", id), { status });
      setSubmissions((prev) => (prev || []).map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (err) {
      console.error("Update Quote Submission Error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="glass-card border-none bg-white/60 shadow-xl">
      <CardHeader className="p-10 border-b border-primary/5">
        <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
          <Quote className="h-8 w-8 text-rose" /> Citations proposées
          {counts.pending > 0 && (
            <span className="h-7 min-w-7 px-2 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
              {counts.pending}
            </span>
          )}
        </CardTitle>
        <CardDescription className="italic">
          Approuver ajoute la citation au pool partagé de "Un jour, une citation" — vérifie que l'auteur cité est
          bien dans le domaine public avant de valider.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          {([
            { id: "pending" as const, label: "En attente", icon: Clock },
            { id: "approved" as const, label: "Approuvées", icon: Check },
            { id: "rejected" as const, label: "Rejetées", icon: X },
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

        {submissions === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm italic opacity-50 text-center py-10">Aucune citation dans cette catégorie.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white/40 p-5 space-y-2">
                <p className="italic text-sm leading-relaxed">"{s.text}"</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">— {s.author}</span>
                  <span className="text-[10px] opacity-40">
                    {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('fr-FR') : ""}
                  </span>
                </div>
                {s.submittedByEmail && <p className="text-[10px] opacity-40">Proposée par : {s.submittedByEmail}</p>}
                <div className="flex gap-2 pt-1">
                  {activeTab !== "approved" && (
                    <Button size="sm" variant="outline" disabled={updatingId === s.id} onClick={() => setStatus(s.id, "approved")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                      <Check className="h-3 w-3 mr-1.5" /> Approuver
                    </Button>
                  )}
                  {activeTab !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={updatingId === s.id} onClick={() => setStatus(s.id, "rejected")} className="h-8 rounded-lg text-[10px] px-3 border-destructive/20 text-destructive">
                      <X className="h-3 w-3 mr-1.5" /> Rejeter
                    </Button>
                  )}
                  {activeTab === "approved" && (
                    <Button size="sm" variant="outline" disabled={updatingId === s.id} onClick={() => setStatus(s.id, "pending")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
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
