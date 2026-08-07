"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Sparkles, Pencil, Save } from "lucide-react";

/**
 * File d'attente des actualités proposées automatiquement (détection de
 * nouveautés chez les auteurs suivis — brancher la source plus tard),
 * en attente de validation par l'administratrice avant publication
 * réelle sur /actualites. Les actualités publiées à la main via
 * ActualitesManager ne passent jamais par ici — seules les candidatures
 * automatiques nécessitent une validation.
 *
 * Approuver : copie la candidature dans `actualites` (publiée pour de
 * vrai) puis retire l'entrée de `actualitesPending`.
 * Rejeter : retire simplement l'entrée, rien n'est publié.
 *
 * Titre et date sont éditables avant validation — utile quand une source
 * automatique remonte un titre anglais alors que la VF a un titre
 * différent, ou une date approximative à corriger.
 */
export function PendingActualitesManager({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [pending, setPending] = useState<any[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; releaseDate: string; content: string }>({ title: "", releaseDate: "", content: "" });

  const load = () => {
    if (!db) return;
    getDocs(collection(db, "actualitesPending"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        list.sort((a, b) => (b.detectedAt?.toMillis?.() || 0) - (a.detectedAt?.toMillis?.() || 0));
        setPending(list);
        onCountChange?.(list.length);
      })
      .catch((err) => { console.error("Load Pending Actualites Error:", err); setPending([]); });
  };

  useEffect(load, [db]);

  const approve = async (item: any) => {
    if (!db) return;
    setBusyId(item.id);
    try {
      await setDoc(doc(db, "actualites", item.id), {
        title: item.title,
        content: item.content,
        authorName: item.authorName || "",
        authorSlug: item.authorSlug || "",
        cover: item.cover || "",
        isRelease: Boolean(item.isRelease),
        releaseDate: item.releaseDate || "",
        isTrending: Boolean(item.isTrending),
        genres: Array.isArray(item.genres) ? item.genres : [],
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "actualitesPending", item.id));
      setPending((prev) => (prev || []).filter((p) => p.id !== item.id));
      onCountChange?.((pending || []).filter((p) => p.id !== item.id).length);
      toast({ title: "Actualité publiée" });
    } catch (err) {
      console.error("Approve Actuality Error:", err);
      toast({ variant: "destructive", title: "Erreur de publication" });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (item: any) => {
    if (!db) return;
    setBusyId(item.id);
    try {
      await deleteDoc(doc(db, "actualitesPending", item.id));
      setPending((prev) => {
        const next = (prev || []).filter((p) => p.id !== item.id);
        onCountChange?.(next.length);
        return next;
      });
      toast({ title: "Proposition écartée" });
    } catch (err) {
      console.error("Reject Actuality Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditDraft({ title: item.title || "", releaseDate: item.releaseDate || "", content: item.content || "" });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    if (!db) return;
    const title = editDraft.title.trim();
    if (!title) {
      toast({ variant: "destructive", title: "Le titre ne peut pas être vide" });
      return;
    }
    setBusyId(id);
    try {
      const releaseDate = editDraft.releaseDate.trim();
      const content = editDraft.content.trim();
      await setDoc(
        doc(db, "actualitesPending", id),
        { title, releaseDate, content, isRelease: Boolean(releaseDate) },
        { merge: true }
      );
      setPending((prev) =>
        (prev || []).map((p) => (p.id === id ? { ...p, title, releaseDate, content, isRelease: Boolean(releaseDate) } : p))
      );
      toast({ title: "Modifications enregistrées" });
      setEditingId(null);
    } catch (err) {
      console.error("Edit Actuality Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setBusyId(null);
    }
  };

  if (pending === null || pending.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[2rem] border-2 border-rose/20 bg-rose/5 p-6 space-y-4">
      <h3 className="text-lg font-headline italic flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-rose" /> À valider ({pending.length})
      </h3>
      <div className="max-h-[520px] overflow-y-auto pr-2 space-y-3">
        {pending.map((item) => {
          const isEditing = editingId === item.id;
          return (
            <div key={item.id} className="flex items-start gap-4 p-4 rounded-2xl bg-rose/5 border border-rose/10">
              {item.cover && (
                <img src={item.cover} alt="" className="h-16 w-12 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0 space-y-2">
                {isEditing ? (
                  <>
                    <Input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Titre"
                      className="h-9 text-sm bg-white/60 rounded-lg border-none shadow-inner"
                    />
                    <Input
                      type="date"
                      value={editDraft.releaseDate}
                      onChange={(e) => setEditDraft((p) => ({ ...p, releaseDate: e.target.value }))}
                      className="h-9 text-sm bg-white/60 rounded-lg border-none shadow-inner"
                    />
                    <Textarea
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((p) => ({ ...p, content: e.target.value }))}
                      placeholder="Contenu"
                      className="min-h-20 text-sm italic bg-white/60 rounded-lg border-none shadow-inner"
                    />
                  </>
                ) : (
                  <>
                    <p className="font-headline italic truncate">{item.title}</p>
                    <p className="text-xs opacity-50 truncate">{item.authorName || "Actualité littéraire générale"}</p>
                    {item.releaseDate && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-rose/70">
                        Sortie : {new Date(`${item.releaseDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                    {item.content && <p className="text-xs italic opacity-70 mt-1 line-clamp-2">{item.content}</p>}
                  </>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={busyId === item.id}
                      className="h-9 w-9 rounded-full bg-primary text-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40"
                      title="Enregistrer"
                    >
                      {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={busyId === item.id}
                      className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground hover:scale-110 transition-transform disabled:opacity-40"
                      title="Annuler"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      disabled={busyId === item.id}
                      className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-primary/60 hover:scale-110 transition-transform disabled:opacity-40"
                      title="Modifier titre / date"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => approve(item)}
                      disabled={busyId === item.id}
                      className="h-9 w-9 rounded-full bg-primary text-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-40"
                      title="Publier"
                    >
                      {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => reject(item)}
                      disabled={busyId === item.id}
                      className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-destructive hover:scale-110 transition-transform disabled:opacity-40"
                      title="Écarter"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
