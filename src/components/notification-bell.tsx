"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, updateDoc, writeBatch, arrayUnion,
} from "firebase/firestore";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BookHeart, Sparkles, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * Centre de notifications (cloche) — trois types possibles :
 * - "book_added" : un livre que la lectrice avait signalé comme
 *   introuvable vient d'être ajouté à la base (voir missing-book-reports-queue.tsx).
 * - "upcoming_release" : nouvelle actualité publiée d'un auteur/éditeur suivi
 *   (voir /api/admin/notify-actuality-followers).
 * - "app_update" : annonce de mise à jour de l'application, diffusée à
 *   tout le monde par l'administratrice (voir AppUpdateBroadcaster).
 *
 * Deux formes de document dans la collection `notifications` :
 * - Personnel (book_added, upcoming_release) : targetUid + read (booléen).
 * - Diffusion (app_update) : broadcast=true + readBy (tableau d'UID).
 * On écoute les deux requêtes séparément plutôt qu'un OR Firestore, pour
 * éviter tout souci d'index composite.
 */

type NotifDoc = {
  id: string;
  type: "book_added" | "upcoming_release" | "app_update";
  title: string;
  body: string;
  link?: string;
  createdAt?: any;
  targetUid?: string;
  broadcast?: boolean;
  read?: boolean;
  readBy?: string[];
};

const TYPE_META: Record<NotifDoc["type"], { icon: any; className: string }> = {
  book_added: { icon: BookHeart, className: "bg-emerald-500/10 text-emerald-600" },
  upcoming_release: { icon: Sparkles, className: "bg-purple-500/10 text-purple-600" },
  app_update: { icon: Rocket, className: "bg-amber-500/10 text-amber-600" },
};

export function NotificationBell() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [personal, setPersonal] = useState<NotifDoc[]>([]);
  const [broadcast, setBroadcast] = useState<NotifDoc[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!db || !user) return;
    const unsubPersonal = onSnapshot(
      query(collection(db, "notifications"), where("targetUid", "==", user.uid), orderBy("createdAt", "desc"), limit(30)),
      (snap) => setPersonal(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotifDoc))),
      (err) => console.error("Notifications Personal Error:", err)
    );
    const unsubBroadcast = onSnapshot(
      query(collection(db, "notifications"), where("broadcast", "==", true), orderBy("createdAt", "desc"), limit(30)),
      (snap) => setBroadcast(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotifDoc))),
      (err) => console.error("Notifications Broadcast Error:", err)
    );
    return () => { unsubPersonal(); unsubBroadcast(); };
  }, [db, user]);

  const all = useMemo(() => {
    return [...personal, ...broadcast].sort(
      (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    );
  }, [personal, broadcast]);

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    const unreadPersonal = personal.filter((n) => !n.read).length;
    const unreadBroadcast = broadcast.filter((n) => !(n.readBy || []).includes(user.uid)).length;
    return unreadPersonal + unreadBroadcast;
  }, [personal, broadcast, user]);

  const markRead = async (n: NotifDoc) => {
    if (!db || !user) return;
    try {
      if (n.broadcast) {
        if ((n.readBy || []).includes(user.uid)) return;
        await updateDoc(doc(db, "notifications", n.id), { readBy: arrayUnion(user.uid) });
      } else if (!n.read) {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      }
    } catch (err) {
      console.error("Mark Notification Read Error:", err);
    }
  };

  const markAllRead = async () => {
    if (!db || !user) return;
    try {
      const batch = writeBatch(db);
      personal.filter((n) => !n.read).forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
      broadcast.filter((n) => !(n.readBy || []).includes(user.uid)).forEach((n) =>
        batch.update(doc(db, "notifications", n.id), { readBy: arrayUnion(user.uid) })
      );
      await batch.commit();
    } catch (err) {
      console.error("Mark All Notifications Read Error:", err);
    }
  };

  const handleClick = (n: NotifDoc) => {
    markRead(n);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full hover:bg-white/60 transition-colors text-muted-foreground hover:text-primary"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">News</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 bg-white/95 backdrop-blur-xl border-none shadow-xl rounded-2xl overflow-hidden" align="end">
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/5">
          <p className="font-headline italic text-lg">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[10px] font-bold uppercase tracking-wide text-primary/50 hover:text-primary">
              Tout marquer lu
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {all.length === 0 ? (
            <p className="text-sm italic opacity-50 text-center py-10 px-5">Rien pour l'instant.</p>
          ) : (
            <div className="p-2 space-y-1">
              {all.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.app_update;
                const Icon = meta.icon;
                const isUnread = n.broadcast ? !(n.readBy || []).includes(user.uid) : !n.read;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors hover:bg-primary/5",
                      isUnread && "bg-primary/[0.03]"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", meta.className)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className={cn("text-sm italic leading-snug", isUnread ? "font-semibold text-primary" : "text-primary/70")}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs opacity-60 leading-snug line-clamp-2">{n.body}</p>}
                      {n.createdAt?.toDate && (
                        <p className="text-[9px] opacity-40 uppercase tracking-wide">
                          {n.createdAt.toDate().toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
