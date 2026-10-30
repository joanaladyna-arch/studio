"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useDoc, useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { BookCover } from "@/components/book-cover";
import { ADMIN_EMAILS, cn, toArray } from "@/lib/utils";
import { relativeTime, RULES_HINT, type ActivityItem } from "@/lib/salon";

/**
 * Fil d'activité : se remplit tout seul (livres terminés, avis écrits) pour
 * les lectrices qui ont activé "Partager mon activité" — chacune choisit,
 * rien n'est publié sans son accord.
 */
export function FeedTab() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [mine, setMine] = useState(true);

  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const followed = toArray<string>((profile as any)?.followedUsers);
  const sharing = !!(profile as any)?.shareActivity;
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  const load = () => {
    if (!db) return;
    getDocs(query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(60)))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityItem))))
      .catch((err) => {
        console.error("Load activity:", err);
        setItems([]);
        if (err?.code === "permission-denied") toast({ variant: "destructive", title: "Fil indisponible", description: RULES_HINT });
      });
  };
  useEffect(load, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSharing = async (v: boolean) => {
    if (!profileRef) return;
    try {
      await setDoc(profileRef, { shareActivity: v }, { merge: true });
      toast({ title: v ? "Activité partagée" : "Activité non partagée", description: v ? "Tes prochains livres terminés et avis apparaîtront dans le fil." : "Plus rien de nouveau n'apparaîtra dans le fil." });
    } catch {
      toast({ variant: "destructive", title: "Enregistrement impossible" });
    }
  };

  const remove = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "activity", id));
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
    } catch {
      toast({ variant: "destructive", title: "Suppression impossible" });
    }
  };

  const shown = (items || []).filter((i) => !mine || i.uid === user?.uid || followed.includes(i.uid));

  return (
    <div className="space-y-6">
      <label className="glass-card bg-white/60 border-none p-4 flex items-center justify-between gap-4 cursor-pointer">
        <span>
          <span className="block font-headline italic text-lg">Partager mon activité</span>
          <span className="block text-xs text-muted-foreground">Quand tu termines un livre ou écris un avis (depuis sa fiche), une ligne apparaît dans le fil. Tu peux la supprimer à tout moment.</span>
        </span>
        <Switch checked={sharing} onCheckedChange={toggleSharing} />
      </label>

      <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Filtre du fil">
        {[{ k: true, l: "Lectrices que je suis" }, { k: false, l: "Toutes les lectrices" }].map((o) => (
          <button key={String(o.k)} type="button" role="radio" aria-checked={mine === o.k} onClick={() => setMine(o.k)}
            className={cn("rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors", mine === o.k ? "border-rose bg-rose/15" : "border-primary/10 bg-white/60 hover:border-rose/50")}>
            {o.l}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40" /></div>
      ) : shown.length === 0 ? (
        <div className="glass-card p-10 text-center bg-white/60 border-none">
          <p className="italic text-muted-foreground">{mine ? "Rien pour l'instant : suis des lectrices depuis la Communauté pour voir leur activité ici." : "Aucune activité partagée pour l'instant."}</p>
        </div>
      ) : (
        <div className="glass-card bg-white/60 border-none divide-y divide-primary/10">
          {shown.map((i) => (
            <div key={i.id} className="flex items-center gap-4 p-4">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={i.avatarUrl} className="object-cover" />
                <AvatarFallback className="font-headline italic">{(i.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <b className="font-semibold">{i.name}</b> {i.type === "finished" ? "a terminé" : "a écrit un avis sur"} <b className="font-semibold">{i.title}</b>
                  {!!i.rating && <span className="ml-2 text-copper tracking-widest">{"★".repeat(i.rating)}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{relativeTime(i.createdAt)}</p>
              </div>
              {i.cover && (
                <div className="relative h-14 w-10 shrink-0 rounded-md overflow-hidden bg-primary/5">
                  <BookCover src={i.cover} alt={i.title} className="object-cover" />
                </div>
              )}
              {(i.uid === user?.uid || isAdmin) && (
                <button type="button" aria-label="Supprimer cette ligne" onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
