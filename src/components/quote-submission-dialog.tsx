"use client";

import { useState } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Quote, Loader2, Send, Check } from "lucide-react";

/**
 * Soumission communautaire de citations pour la sélection "Un jour, une
 * citation" (voir daily-quotes.ts) — même esprit que
 * PublisherSubmissionDialog : jamais publié automatiquement, toujours
 * examiné par l'administratrice (QuoteSubmissionsQueue) avant d'entrer
 * dans le pool partagé.
 *
 * Volontairement pas de champ "source/livre" optionnel transformé en
 * citation d'auteur non-vérifiée : seule l'administratrice décide, à la
 * validation, si l'auteur cité est réellement dans le domaine public
 * (voir daily-quotes.ts) avant d'ajouter la citation au pool partagé —
 * une citation d'un auteur encore protégé par le droit d'auteur ne doit
 * jamais être diffusée à toutes les lectrices.
 */
export function QuoteSubmissionDialog() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");

  const resetForm = () => {
    setText("");
    setAuthor("");
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!db || !user || !text.trim() || !author.trim()) {
      toast({ variant: "destructive", title: "Champs incomplets", description: "La citation et son auteur sont nécessaires." });
      return;
    }
    setIsSending(true);
    try {
      await addDoc(collection(db, "quoteSubmissions"), {
        text: text.trim(),
        author: author.trim(),
        submittedBy: user.uid,
        submittedByEmail: user.email || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Quote Submission Error:", err);
      toast({ variant: "destructive", title: "Erreur d'envoi", description: "La proposition n'a pas pu être envoyée." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-xs italic text-primary/50 hover:text-primary transition-colors underline underline-offset-4"
      >
        <Quote className="h-3.5 w-3.5" /> Proposer une citation à la communauté
      </button>
      <DialogContent className="glass-card border-none max-w-lg p-10 bg-white/95 backdrop-blur-3xl">
        {submitted ? (
          <div className="text-center space-y-6 py-8">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-headline italic text-2xl">Proposition envoyée</p>
              <p className="text-sm italic opacity-60">Elle sera examinée avant d'apparaître dans "Un jour, une citation". Merci !</p>
            </div>
            <Button onClick={() => setOpen(false)} className="rounded-2xl h-12 px-8 italic">Fermer</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
                <Quote className="h-6 w-6 text-primary" /> Proposer une citation
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs italic opacity-50 -mt-2">
              Sera examinée par l'équipe Lectoria avant d'être diffusée à toutes les lectrices — privilégie les
              citations d'auteurs du domaine public (décédés depuis plus de 70 ans).
            </p>
            <div className="space-y-4 pt-2">
              <Textarea
                placeholder="Texte de la citation *"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[100px] rounded-xl bg-white/60 italic resize-none"
              />
              <Input placeholder="Auteur *" value={author} onChange={(e) => setAuthor(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isSending} className="w-full h-12 rounded-2xl bg-primary font-headline italic">
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Envoyer la proposition
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
