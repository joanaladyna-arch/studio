"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Quote, Heart } from "lucide-react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, query, where, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDailyQuote } from "@/lib/daily-quotes";
import { slugify } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * "Un jour, une citation" — s'affiche automatiquement à l'ouverture de
 * l'app (Accueil), une seule fois par jour civil (suivi via
 * localStorage, comparé à la date du jour). Ne réapparaît pas si on
 * revient sur l'Accueil plus tard dans la même journée, ni si on
 * navigue ailleurs puis qu'on revient — seulement à la toute première
 * ouverture du jour.
 */
export function DailyQuoteModal() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "books"));
  }, [db, user]);
  const { data: booksRaw = [] } = useCollection(booksQuery);

  const communityQuotesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "quoteSubmissions"), where("status", "==", "approved"));
  }, [db]);
  const { data: communityQuotesRaw = [] } = useCollection(communityQuotesQuery);

  const dailyQuote = useMemo(
    () => getDailyQuote(booksRaw || [], (communityQuotesRaw || []).map((q: any) => ({ text: q.text, author: q.author }))),
    [booksRaw, communityQuotesRaw]
  );

  useEffect(() => { setSaved(false); }, [dailyQuote?.text]);

  const saveToCarnet = async () => {
    if (!db || !user || !dailyQuote) return;
    try {
      const id = slugify(`${dailyQuote.text}-${dailyQuote.author}`).slice(0, 140) || `citation-${Date.now()}`;
      await setDoc(doc(db, "users", user.uid, "savedQuotes", id), {
        text: dailyQuote.text,
        author: dailyQuote.author,
        savedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      toast({ title: "Citation épinglée", description: "Retrouve-la dans ton Carnet de Citations." });
    } catch (err) {
      console.error("Save Daily Quote Error:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !dailyQuote) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const lastSeen = localStorage.getItem("lectoria_daily_quote_seen");
    if (lastSeen !== todayKey) {
      const t = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [dailyQuote]);

  const dismiss = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("lectoria_daily_quote_seen", new Date().toISOString().slice(0, 10));
    }
  };

  if (!dailyQuote) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="glass-card border-none max-w-sm bg-white/95 backdrop-blur-3xl p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-copper flex items-center justify-center gap-2 mb-4">
          <Quote className="h-4 w-4" /> Un jour, une citation
        </p>
        <p className="font-headline italic text-xl leading-relaxed">"{dailyQuote.text}"</p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-4">
          {dailyQuote.isOwn ? `📖 Depuis ton Carnet — ${dailyQuote.author}` : `✦ ${dailyQuote.author} — Petite sélection Lectoria`}
        </p>
        {!dailyQuote.isOwn && (
          <button
            onClick={saveToCarnet}
            disabled={saved}
            className="mt-4 inline-flex items-center gap-1.5 text-xs italic text-rose/70 hover:text-rose transition-colors disabled:text-rose"
          >
            <Heart className={saved ? "h-4 w-4 fill-rose" : "h-4 w-4"} />
            {saved ? "Épinglée dans ton Carnet" : "Épingler dans mon Carnet"}
          </button>
        )}
        <button
          onClick={dismiss}
          className="mt-6 h-11 px-8 rounded-full bg-primary text-primary-foreground font-headline italic text-sm transition-transform active:scale-95"
        >
          Bonne lecture
        </button>
      </DialogContent>
    </Dialog>
  );
}
