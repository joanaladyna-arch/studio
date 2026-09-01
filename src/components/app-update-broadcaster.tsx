"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Rocket } from "lucide-react";

/**
 * Diffuse une notification "mise à jour logicielle" à toutes les
 * utilisatrices via la cloche (voir notification-bell.tsx). Un seul
 * document `broadcast: true` dans `notifications`, jamais un envoi par
 * utilisatrice — chacune marque sa propre lecture via `readBy` (tableau
 * d'UID), sans réécrire le document original.
 */
export function AppUpdateBroadcaster() {
  const db = useFirestore();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    if (!db) return;
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Le titre est obligatoire" });
      return;
    }
    setIsSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        type: "app_update",
        title: title.trim(),
        body: body.trim(),
        broadcast: true,
        readBy: [],
        createdAt: serverTimestamp(),
      });
      toast({ title: "Notification diffusée à toutes les lectrices" });
      setTitle("");
      setBody("");
    } catch (err) {
      console.error("App Update Broadcast Error:", err);
      toast({ variant: "destructive", title: "Erreur d'envoi" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-headline italic flex items-center gap-3">
        <Rocket className="h-5 w-5 text-primary" /> Annoncer une mise à jour
      </h3>
      <p className="text-xs italic opacity-60">
        Envoyée à toutes les lectrices via la cloche de notifications — utilise-la pour annoncer une nouvelle
        fonctionnalité ou un correctif important.
      </p>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre (ex: Nouvelle fonctionnalité disponible !)"
        className="h-11 italic bg-white/60 rounded-xl border-none shadow-inner"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Détail (optionnel)"
        className="italic bg-white/60 rounded-xl border-none shadow-inner min-h-20"
      />
      <Button
        onClick={send}
        disabled={isSending || !title.trim()}
        className="h-11 rounded-xl italic font-headline bg-primary"
      >
        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
        Diffuser
      </Button>
    </div>
  );
}
