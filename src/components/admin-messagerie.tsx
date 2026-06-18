
"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Mail, MailOpen, Archive, Trash2, RotateCcw, Newspaper, BookX, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Boîte de réception des messages envoyés par les lectrices à
 * l'administratrice (bouton enveloppe sur leur page Profil). "Supprimé"
 * est un statut, pas un effacement réel — le message reste consultable
 * dans cet onglet plutôt que perdu définitivement, comme une corbeille.
 */

type MessageStatus = "unread" | "read" | "archived" | "deleted";

const TABS: { id: MessageStatus; label: string; icon: any }[] = [
  { id: "unread", label: "Non lu", icon: Mail },
  { id: "read", label: "Lu", icon: MailOpen },
  { id: "archived", label: "Archivé", icon: Archive },
  { id: "deleted", label: "Supprimé", icon: Trash2 },
];

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  actualite: { label: "Actualité manquante", icon: Newspaper },
  livre: { label: "Livre manquant", icon: BookX },
  autre: { label: "Autre", icon: MessageSquare },
};

export function AdminMessagerie() {
  const db = useFirestore();
  const [messages, setMessages] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<MessageStatus>("unread");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    getDocs(query(collection(db, "adminMessages"), orderBy("createdAt", "desc")))
      .then((snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))))
      .catch((err) => {
        console.error("Load Admin Messages Error:", err);
        setMessages([]);
      });
  }, [db]);

  const counts = useMemo(() => {
    const c: Record<MessageStatus, number> = { unread: 0, read: 0, archived: 0, deleted: 0 };
    (messages || []).forEach((m) => {
      const s = (m.status || "unread") as MessageStatus;
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [messages]);

  const filtered = useMemo(() => {
    return (messages || []).filter((m) => (m.status || "unread") === activeTab);
  }, [messages, activeTab]);

  const setStatus = async (id: string, status: MessageStatus) => {
    if (!db) return;
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, "adminMessages", id), { status, updatedAt: new Date() });
      setMessages((prev) => (prev || []).map((m) => (m.id === id ? { ...m, status } : m)));
    } catch (err) {
      console.error("Update Message Status Error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="glass-card border-none bg-white/60 shadow-xl">
      <CardHeader className="p-10 border-b border-primary/5">
        <CardTitle className="font-headline text-3xl italic flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" /> Messagerie
          {counts.unread > 0 && (
            <span className="h-7 min-w-7 px-2 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
              {counts.unread}
            </span>
          )}
        </CardTitle>
        <CardDescription className="italic">Messages envoyés par les lectrices depuis leur page Profil (actualité ou livre manquant, ou autre demande).</CardDescription>
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

        {messages === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin opacity-40" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm italic opacity-50 text-center py-10">Aucun message dans cette catégorie.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const typeInfo = TYPE_LABELS[m.type] || TYPE_LABELS.autre;
              return (
                <div key={m.id} className="rounded-2xl bg-white/40 p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 flex items-center gap-2">
                      <typeInfo.icon className="h-3.5 w-3.5" /> {typeInfo.label}
                    </span>
                    <span className="text-[10px] opacity-40">
                      {m.userName || m.userEmail || "Lectrice"} · {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('fr-FR') : ""}
                    </span>
                  </div>
                  <p className="text-sm italic leading-relaxed whitespace-pre-line">{m.content}</p>
                  <div className="flex gap-2 flex-wrap pt-1">
                    {activeTab !== "read" && (
                      <Button size="sm" variant="outline" disabled={updatingId === m.id} onClick={() => setStatus(m.id, "read")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                        <MailOpen className="h-3 w-3 mr-1.5" /> Marquer lu
                      </Button>
                    )}
                    {activeTab !== "archived" && (
                      <Button size="sm" variant="outline" disabled={updatingId === m.id} onClick={() => setStatus(m.id, "archived")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                        <Archive className="h-3 w-3 mr-1.5" /> Archiver
                      </Button>
                    )}
                    {activeTab !== "deleted" ? (
                      <Button size="sm" variant="outline" disabled={updatingId === m.id} onClick={() => setStatus(m.id, "deleted")} className="h-8 rounded-lg text-[10px] px-3 border-destructive/20 text-destructive">
                        <Trash2 className="h-3 w-3 mr-1.5" /> Supprimer
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={updatingId === m.id} onClick={() => setStatus(m.id, "unread")} className="h-8 rounded-lg text-[10px] px-3 border-primary/20">
                        <RotateCcw className="h-3 w-3 mr-1.5" /> Restaurer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
