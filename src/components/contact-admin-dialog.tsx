
"use client";

import { useState } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Send } from "lucide-react";

/**
 * Bouton enveloppe (page Profil, toutes les utilisatrices) qui ouvre une
 * fenêtre de message à destination de l'administratrice — pour signaler
 * une actualité ou un livre manquant, ou toute autre demande.
 */
export function ContactAdminDialog() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("autre");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    if (!db || !user || !content.trim()) return;
    setIsSending(true);
    try {
      await addDoc(collection(db, "adminMessages"), {
        userId: user.uid,
        userName: user.displayName || "",
        userEmail: user.email || "",
        type,
        content: content.trim(),
        status: "unread",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Message envoyé", description: "L'administratrice recevra votre message." });
      setContent("");
      setType("autre");
      setOpen(false);
    } catch (err) {
      console.error("Send Admin Message Error:", err);
      toast({ variant: "destructive", title: "Erreur d'envoi", description: "Le message n'a pas pu être envoyé." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-14 w-14 rounded-full bg-white/60 hover:bg-white shadow-sm border border-primary/10 flex items-center justify-center text-primary transition-colors"
        title="Envoyer un message à l'administrateur"
      >
        <Mail className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card border-none max-w-lg p-10 bg-white/95 backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" /> Envoyer à l'administrateur
            </DialogTitle>
            <DialogDescription className="italic">Une actualité ou un livre manquant, ou toute autre remarque.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sujet</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12 italic bg-white/60 rounded-xl border-none shadow-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actualite">Actualité manquante</SelectItem>
                  <SelectItem value="livre">Livre manquant</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Message</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Décrivez votre demande..."
                className="min-h-32 italic bg-white/60 rounded-2xl border-none shadow-inner"
              />
            </div>
            <Button onClick={send} disabled={isSending || !content.trim()} className="w-full h-14 rounded-2xl bg-primary italic font-headline text-lg shadow-xl shadow-primary/10">
              {isSending ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Send className="mr-3 h-5 w-5" />} Envoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
