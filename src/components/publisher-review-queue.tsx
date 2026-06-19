
"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Clock, CheckCircle2, XCircle, BookOpen, Newspaper, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * File d'attente des propositions envoyées par les maisons d'édition
 * (bouton "Vous êtes une maison d'édition ?" sur la page Profil).
 * Volontairement SANS création automatique de fiche ou d'actualité —
 * "Approuver" marque seulement la proposition comme validée ; c'est
 * toujours l'administratrice qui crée la fiche elle-même avec les
 * outils déjà existants (Nouvelle fiche, Actualités), en s'appuyant sur
 * le contenu affiché ici. Garde un contrôle total sur ce qui devient
 * réellement public, conformément au principe de validation manuelle.
 */

type SubmissionStatus = "pending" | "approved" | "rejected";

const TABS: { id: SubmissionStatus; label: string; icon: any }[] = [
  { id: "pending", label: "En attente", icon: Clock },
  { id: "approved", label: "Approuvé", icon: CheckCircle2 },
  { id: "rejected", label: "Refusé", icon: XCircle },
];

export function PublisherReviewQueue() {
  const db = useFirestore();
  const [submissions, setSubmissions] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<SubmissionStatus>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "publisherSubmissions"), orderBy("createdAt", "desc")))
      .then((snap) => setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))))
      .catch((err) => {
        console.error("Load Publisher Submissions Error:", err);
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
      await updateDoc(doc(db, "publisherSubmissions", id), { status, updatedAt: new Date() });
      setSubmissions((prev) => (prev || []).map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (err) {
      console.error("Update Submission Status Error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="glass-card border-none bg-white/60 shadow-xl">
      <CardHeader className="p-10 border-b border-primary/5">
        <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" /> Propositions éditeurs
          {counts.pending > 0 && (
            <span className="h-7 min-w-7 px-2 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
              {counts.pending}
            </span>
          )}
        </CardTitle>
        <CardDescription className="italic">Livres et actualités proposés par des maisons d'édition — rien ne devient public automatiquement.</CardDescription>
      </CardHeader>
      <CardContent className="p-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
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
          <p className="text-sm italic opacity-50 text-center py-10">Aucune proposition dans cette catégorie.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white/40 p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 flex items-center gap-2">
                    {s.type === "actualite" ? <Newspaper className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                    {s.type === "actualite" ? "Actualité" : "Livre"} · {s.publisherName}
                  </span>
                  <span className="text-[10px] opacity-40">
                    {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('fr-FR') : ""}
                  </span>
                </div>
                <div className="flex gap-4">
                  {s.imageUrl && (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0 bg-secondary/5 shadow-sm">
                      <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-headline italic text-lg">{s.title}</p>
                    <p className="text-sm italic opacity-70 line-clamp-3 whitespace-pre-line">{s.content}</p>
                    {s.contactEmail && <p className="text-[10px] opacity-40">Contact : {s.contactEmail}</p>}
                    {s.referenceLink && (
                      <a href={s.referenceLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/60 hover:text-primary inline-flex items-center gap-1 underline">
                        <ExternalLink className="h-3 w-3" /> Lien de référence
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  {activeTab !== "approved" && (
                    <Button size="sm" variant="outline" disabled={updatingId === s.id} onClick={() => setStatus(s.id, "approved")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                      <CheckCircle2 className="h-3 w-3 mr-1.5" /> Approuver
                    </Button>
                  )}
                  {activeTab !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={updatingId === s.id} onClick={() => setStatus(s.id, "rejected")} className="h-8 rounded-lg text-[10px] px-3 border-destructive/20 text-destructive">
                      <XCircle className="h-3 w-3 mr-1.5" /> Refuser
                    </Button>
                  )}
                  {activeTab !== "pending" && (
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
