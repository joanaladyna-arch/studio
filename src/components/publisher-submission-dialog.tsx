"use client";

import { useState } from "react";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, Send, Upload, Check } from "lucide-react";

/**
 * Permet à une maison d'édition de proposer un livre ou une actualité,
 * avec image (upload ou lien), sans accès direct au catalogue ou au
 * flux d'actualités public — tout passe par une file d'attente que
 * seule l'administratrice valide avant publication (collection
 * publisherSubmissions, écriture autorisée à toute personne connectée,
 * lecture/modification réservée à l'admin — même schéma que les
 * messages de contact). Évite le risque de modération d'un accès
 * autonome tout en validant concrètement l'intérêt des éditeurs.
 */
export function PublisherSubmissionDialog() {
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [type, setType] = useState<"livre" | "actualite">("livre");
  const [publisherName, setPublisherName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const resetForm = () => {
    setType("livre");
    setPublisherName("");
    setContactEmail("");
    setTitle("");
    setContent("");
    setReferenceLink("");
    setImageUrl("");
    setSubmitted(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/publisher-submissions/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
    } catch (err) {
      console.error("Publisher Image Upload Error:", err);
      toast({ variant: "destructive", title: "Erreur d'envoi de l'image" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!db || !user || !publisherName.trim() || !title.trim() || !content.trim()) {
      toast({ variant: "destructive", title: "Champs incomplets", description: "Maison d'édition, titre et description sont nécessaires." });
      return;
    }
    setIsSending(true);
    try {
      await addDoc(collection(db, "publisherSubmissions"), {
        userId: user.uid,
        userEmail: user.email || "",
        publisherName: publisherName.trim(),
        contactEmail: contactEmail.trim(),
        type,
        title: title.trim(),
        content: content.trim(),
        referenceLink: referenceLink.trim(),
        imageUrl: imageUrl.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Publisher Submission Error:", err);
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
        <Building2 className="h-3.5 w-3.5" /> Vous êtes une maison d'édition ?
      </button>
      <DialogContent className="glass-card border-none max-w-lg p-10 bg-white/95 backdrop-blur-3xl max-h-[85vh] overflow-y-auto">
        {submitted ? (
          <div className="text-center space-y-6 py-8">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-headline italic text-2xl">Proposition envoyée</p>
              <p className="text-sm italic opacity-60">Elle sera examinée avant toute publication. Merci pour votre intérêt pour Lectoria !</p>
            </div>
            <Button onClick={() => setOpen(false)} className="rounded-2xl h-12 px-8 italic">Fermer</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" /> Proposer un contenu
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs italic opacity-50 -mt-2">
              Votre proposition sera examinée par l'équipe Lectoria avant toute publication — aucun contenu n'apparaît automatiquement.
            </p>
            <div className="space-y-4 pt-2">
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="h-12 rounded-xl bg-white/60 italic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Proposer un livre</SelectItem>
                  <SelectItem value="actualite">Proposer une actualité</SelectItem>
                </SelectContent>
              </Select>

              <Input placeholder="Nom de la maison d'édition *" value={publisherName} onChange={(e) => setPublisherName(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />
              <Input placeholder="Email de contact (facultatif)" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />
              <Input placeholder={type === "livre" ? "Titre du livre *" : "Titre de l'actualité *"} value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />
              <Textarea
                placeholder={type === "livre" ? "Résumé du livre *" : "Texte de l'actualité *"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] rounded-xl bg-white/60 italic resize-none"
              />
              <Input placeholder="Lien de référence (Amazon, site...)" value={referenceLink} onChange={(e) => setReferenceLink(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Image</Label>
                <div className="flex gap-2">
                  <Input placeholder="URL d'une image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-12 rounded-xl bg-white/60 italic" />
                  <label className="h-12 px-4 rounded-xl bg-white/60 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-colors shrink-0">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                </div>
                {imageUrl && (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-secondary/5 shadow-sm">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
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
