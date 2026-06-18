"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { 
  ArrowLeft, 
  Sparkles, 
  BookOpen, 
  Trash2, 
  Save, 
  Star, 
  Globe,
  Hash,
  Loader2,
  Camera,
  Link as LinkIcon,
  Magnet,
  Upload,
  Share2,
  Flame,
  ClipboardList,
  ShieldCheck,
  Pencil,
  Library,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import Image from "next/image";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn, toArray, cleanBookTitle, cleanAuthorName, cleanDescriptionHtml, authorKey, stableBookKey } from "@/lib/utils";
import { UserBook, MasterBook, STATUSES, RANKS, RankType, GENRES_LIST, TROPES_LIST, THEMES_LIST } from "@/app/library/page";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useStorage } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { MasterBookEditor } from "@/components/master-book-editor";
import { ScrollArea } from "@/components/ui/scroll-area";

// Grille d'évaluation détaillée, distincte de "Ma Note" — combine des
// critères sur le livre en lui-même (intrigue, personnages, écriture,
// rythme) et sur la romance qu'il raconte (chimie, tension, développement
// de la relation), à la demande explicite de l'utilisatrice.
const EVALUATION_CRITERIA: { key: keyof NonNullable<UserBook["detailedRatings"]>; label: string }[] = [
  { key: "intrigue", label: "Intrigue / Histoire" },
  { key: "personnages", label: "Personnages" },
  { key: "ecriture", label: "Écriture / Style" },
  { key: "rythme", label: "Rythme" },
  { key: "chimie", label: "Chimie entre les personnages" },
  { key: "tension", label: "Tension" },
  { key: "developpement", label: "Développement de la relation" },
];

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const { adminMode } = useAdminMode();
  const taxonomy = useTaxonomy();
  const [showMasterEditor, setShowMasterEditor] = useState(false);

  const userBookRef = useMemo(() => {
    if (!db || !user || !bookId) return null;
    return doc(db, "users", user.uid, "books", bookId);
  }, [db, user, bookId]);

  const { data: userBook, loading: userLoading } = useDoc<UserBook>(userBookRef);
  const [masterBook, setMasterBook] = useState<MasterBook | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [editedData, setEditedData] = useState<Partial<UserBook>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [ratingGridOpen, setRatingGridOpen] = useState(false);
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);
  const [otherEditions, setOtherEditions] = useState<any[] | null>(null);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [editionsOpen, setEditionsOpen] = useState(false);

  // Petite photo de l'auteur près de son nom, si elle a été renseignée à
  // la main via la fiche auteur (mode admin). Échoue toujours
  // silencieusement : l'absence de photo ne doit jamais bloquer
  // l'affichage de la fiche livre elle-même.
  useEffect(() => {
    const authorName = masterBook?.author || userBook?.author;
    if (!db || !authorName) { setAuthorPhoto(null); return; }
    getDoc(doc(db, "authors", authorKey(authorName)))
      .then((snap) => {
        const photo = snap.exists() ? (snap.data() as any)?.photo : null;
        setAuthorPhoto(photo || null);
      })
      .catch(() => setAuthorPhoto(null));
  }, [db, masterBook?.author, userBook?.author]);

  // Récupération des données Master
  const fetchMasterData = useCallback(async (mid: string) => {
    if (!db || !mid) return;
    setMasterLoading(true);
    try {
      let resolvedId = mid;
      let mSnap = await getDoc(doc(db, "masterBooks", resolvedId));
      // Si cette fiche a été fusionnée dans une autre (admin → doublons),
      // on suit la redirection enregistrée pour afficher la fiche
      // conservée — sans jamais avoir à modifier la bibliothèque
      // personnelle de qui que ce soit pour cela.
      if (!mSnap.exists()) {
        try {
          const mergesSnap = await getDoc(doc(db, "config", "bookMerges"));
          const map: Record<string, string> = mergesSnap.exists() ? (mergesSnap.data() as any)?.map || {} : {};
          let hops = 0;
          while (map[resolvedId] && hops < 5) {
            resolvedId = map[resolvedId];
            hops++;
          }
          if (resolvedId !== mid) {
            mSnap = await getDoc(doc(db, "masterBooks", resolvedId));
          }
        } catch (redirectErr) {
          console.error("Book Merge Redirect Error:", redirectErr);
        }
      }
      if (mSnap.exists()) {
        setMasterBook({ id: mSnap.id, ...mSnap.data() } as MasterBook);
      } else {
        console.warn("Master Book not found for ID:", mid);
        // Fallback: on utilise les infos du userBook s'il y en a, pour ne
        // jamais afficher une fiche vide alors que des données existent.
        setMasterBook({
          id: mid,
          title: userBook?.title || "Titre inconnu",
          author: userBook?.author || "Auteur inconnu",
          cover: userBook?.cover || "",
          genres: userBook?.genres || [],
        } as MasterBook);
      }
    } catch (err) {
      console.error("Fetch Master Error:", err);
    } finally {
      setMasterLoading(false);
    }
  }, [db, userBook]);

  useEffect(() => {
    if (userBook) {
      setEditedData(userBook);
      if (userBook.masterBookId) {
        fetchMasterData(userBook.masterBookId);
      }
    }
  }, [userBook, fetchMasterData]);

  // "Éditions" : recherche, dans la base partagée Lectoria, d'autres
  // fiches correspondant à la même œuvre (même titre+auteur normalisés,
  // tome inclus pour ne jamais confondre deux tomes d'une série) mais
  // avec un ISBN différent — c'est-à-dire une autre édition ou maison
  // d'édition. Basé uniquement sur ce que la communauté Lectoria a déjà
  // référencé, pas un registre mondial exhaustif. Chargé seulement à
  // l'ouverture du panneau, pas à chaque visite de la fiche.
  const findOtherEditions = useCallback(async () => {
    if (!db || !masterBook?.title || otherEditions !== null) return;
    setEditionsLoading(true);
    try {
      const targetKey = stableBookKey(masterBook.title, masterBook.author);
      const candidatesSnap = await getDocs(
        query(collection(db, "masterBooks"), where("author", "==", masterBook.author || ""))
      );
      const matches = candidatesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((b) => b.id !== masterBook.id && stableBookKey(b.title, b.author) === targetKey);
      setOtherEditions(matches);
    } catch (err) {
      console.error("Find Other Editions Error:", err);
      setOtherEditions([]);
    } finally {
      setEditionsLoading(false);
    }
  }, [db, masterBook, otherEditions]);

  // Pré-remplit les genres depuis la fiche maître si le livre personnel
  // n'en a pas encore (cas des livres ajoutés avant qu'on enrichisse les
  // données à l'ajout) — ne s'exécute qu'une fois, dès que masterBook
  // est disponible, sans jamais écraser un choix déjà fait.
  useEffect(() => {
    if (masterBook && toArray<string>(userBook?.genres).length === 0 && toArray<string>(masterBook.genres).length > 0) {
      setEditedData(prev => ({ ...prev, genres: toArray<string>(masterBook.genres) }));
    }
  }, [masterBook]);

  // Ajoute/retire un genre ou un trope de la liste personnelle de
  // l'utilisatrice pour ce livre — ces champs alimentent directement le
  // calcul des badges/médailles sur la page profil.
  // Va chercher un résumé et une image sur la page pointée par le lien
  // de référence (balises Open Graph) — uniquement si l'utilisatrice a
  // explicitement coché la case, et sans jamais écraser un résumé ou une
  // couverture déjà renseignés.
  const handleFetchLinkInfo = async () => {
    const link = (editedData as any).referenceLink;
    if (!link) return;
    setIsFetchingLink(true);
    try {
      const res = await fetch(`/api/fetch-link-preview?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (data.error) {
        toast({ variant: "destructive", title: "Récupération impossible", description: data.error });
        return;
      }
      const updates: any = {};
      if (data.description && !(editedData as any).description) updates.description = data.description;
      if (data.image && !editedData.cover) updates.cover = data.image;

      if (Object.keys(updates).length === 0) {
        toast({ title: "Rien à compléter", description: "Le résumé et la couverture sont déjà renseignés, ou cette page ne fournit pas ces informations." });
      } else {
        setEditedData({ ...editedData, ...updates });
        toast({ title: "Informations récupérées", description: `${Object.keys(updates).map(k => k === "description" ? "Résumé" : "Couverture").join(" et ")} complété(e). N'oubliez pas d'enregistrer.` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de contacter cette page." });
    } finally {
      setIsFetchingLink(false);
    }
  };

  const toggleTag = (field: "genres" | "tropes" | "themes", value: string) => {
    const current = toArray<string>((editedData as any)[field]);
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setEditedData({ ...editedData, [field]: updated } as any);
  };

  // Quand une lectrice complète un résumé ou une couverture pour son
  // propre livre, et que la fiche partagée n'a pas encore cette info,
  // on la lui propose en retour — utile pour les romans indés/auto-
  // publiés, peu couverts par les sources externes (Google Books, BnF).
  // Ne touche JAMAIS un champ déjà rempli par quelqu'un d'autre, et
  // échoue toujours silencieusement : une fiche commune mieux remplie
  // est un bonus, jamais un blocage pour sauvegarder son propre journal.
  const proposeMasterCompletion = async (fields: { description?: string; cover?: string }) => {
    if (!db || !masterBook?.id) return;
    try {
      const updates: Record<string, string> = {};
      if (fields.description?.trim() && !(masterBook.description || "").toString().trim()) {
        updates.description = fields.description.trim();
      }
      if (fields.cover?.trim() && !(masterBook.cover || "").toString().trim()) {
        updates.cover = fields.cover.trim();
      }
      if (Object.keys(updates).length === 0) return;
      await updateDoc(doc(db, "masterBooks", masterBook.id), { ...updates, updatedAt: serverTimestamp() });
      setMasterBook((prev) => (prev ? { ...prev, ...updates } : prev));
    } catch (err) {
      console.error("Propose Master Completion Error:", err);
    }
  };

  const handleSave = async () => {
    if (!userBookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userBookRef, {
        ...editedData,
        updatedAt: serverTimestamp()
      });
      proposeMasterCompletion({ description: (editedData as any).description });
      toast({ title: "Journal gravé", description: "Vos réflexions ont été enregistrées." });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder vos modifications." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverUpdate = async (url: string) => {
    if (!userBookRef || !url) return;
    try {
      await updateDoc(userBookRef, { cover: url });
      setEditedData(prev => ({ ...prev, cover: url }));
      proposeMasterCompletion({ cover: url });
      toast({ title: "Couverture mise à jour" });
      setNewCoverUrl("");
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur de mise à jour" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user || !bookId) return;

    setIsUploading(true);
    const storageRef = ref(storage, `users/${user.uid}/covers/${bookId}-${Date.now()}`);

    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await handleCoverUpdate(url);
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur d'importation", description: "Le fichier n'a pas pu être envoyé." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!userBookRef || !confirm("Retirer ce livre de votre réserve ?")) return;
    try {
      await deleteDoc(userBookRef);
      toast({ title: "Livre retiré" });
      router.push("/library");
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  if (userLoading || masterLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
        <p className="font-headline italic text-primary/60 text-2xl">Ouverture du livre...</p>
      </div>
    );
  }

  if (!userBook) {
    return (
      <div className="p-20 text-center space-y-6">
        <h2 className="text-3xl font-headline italic">Livre introuvable</h2>
        <p className="text-muted-foreground italic">Cette pépite semble avoir disparu de votre réserve.</p>
        <Button asChild variant="outline" className="rounded-2xl italic font-headline">
          <Link href="/library">Retour à la bibliothèque</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-7xl mx-auto px-4">
      <header className="flex justify-between items-center pt-4">
        <Button asChild variant="ghost" className="font-headline italic text-lg hover:bg-white/40 rounded-xl">
          <Link href="/library"><ArrowLeft className="mr-3 h-5 w-5" /> Bibliothèque</Link>
        </Button>
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-primary h-14 px-10 shadow-xl font-headline italic text-xl">
            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="mr-3 h-6 w-6" />} Graver
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-10 items-start">
        <div className="space-y-6 w-full sm:w-[260px] shrink-0 mx-auto sm:mx-0">
          <div className="relative aspect-[2/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5 group">
            <BookCover
              src={editedData.cover || masterBook?.cover}
              alt={masterBook?.title || "Livre"} 
              className="object-contain" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <Label className="cursor-pointer bg-white text-primary px-4 py-2 rounded-full flex items-center gap-2 font-headline italic">
                 <Camera className="h-4 w-4" /> Changer
                 <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
               </Label>
            </div>
          </div>

          <Button variant="ghost" onClick={handleDelete} className="w-full text-destructive hover:text-destructive hover:bg-rose-50 rounded-2xl h-14 italic font-headline text-lg">
            <Trash2 className="mr-3 h-5 w-5" /> Retirer de la réserve
          </Button>
        </div>

        <Card className="glass-card p-8 border-none bg-white/60 space-y-8 shadow-sm flex-1 w-full">
           <div className="space-y-4">
             <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Statut de lecture</Label>
             <div className="flex flex-wrap gap-2">
               {Object.entries(STATUSES).map(([k, v]) => (
                 <Button 
                  key={k} 
                  variant="outline" 
                  onClick={() => setEditedData({ ...editedData, status: k as any })} 
                  className={cn(
                    "rounded-full h-9 px-4 text-[10px] uppercase font-bold transition-all", 
                    editedData.status === k ? "bg-primary text-white border-primary shadow-md" : "bg-white/40"
                  )}
                 >
                   {v.label}
                 </Button>
               ))}
             </div>
             {editedData.status === "progress" && (
               <div className="space-y-3 pt-2">
                 <div className="flex items-center justify-between">
                   <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Progression</Label>
                   <span className="text-primary font-headline italic text-lg">{(editedData as any).progress ?? 0}%</span>
                 </div>
                 <Slider
                   value={[(editedData as any).progress ?? 0]}
                   min={0}
                   max={100}
                   step={5}
                   onValueChange={(v) => setEditedData({ ...editedData, progress: v[0] } as any)}
                 />
               </div>
             )}
           </div>

           <div className="space-y-4 pt-4 border-t border-primary/5">
             <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Mon Rang</Label>
             <div className="flex flex-wrap gap-2">
               {Object.entries(RANKS).map(([k, v]) => {
                 const isActive = editedData.plumeRank === k;
                 const RankIcon = v.icon;
                 return (
                   <Button
                    key={k}
                    variant="outline"
                    onClick={() => setEditedData({ ...editedData, plumeRank: isActive ? null : (k as RankType) } as any)}
                    className={cn(
                      "rounded-full h-9 px-4 text-[10px] uppercase font-bold transition-all gap-1.5",
                      isActive ? "bg-primary text-white border-primary shadow-md" : "bg-white/40"
                    )}
                   >
                     <RankIcon className={cn("h-3.5 w-3.5", isActive ? "text-white" : v.color)} />
                     {v.label}
                   </Button>
                 );
               })}
             </div>
             <p className="text-[10px] text-muted-foreground italic">Cliquez à nouveau sur un rang pour le retirer.</p>
           </div>

           <div className="space-y-4 pt-4 border-t border-primary/5">
              <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60 flex items-center gap-2">
                <LinkIcon className="h-3 w-3" /> URL Couverture
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={newCoverUrl} 
                  onChange={(e) => setNewCoverUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="h-10 text-xs italic bg-white/40 border-none rounded-xl"
                />
                <Button onClick={() => handleCoverUpdate(newCoverUrl)} variant="secondary" className="h-10 px-4 rounded-xl italic">OK</Button>
              </div>
           </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h1 className="text-6xl font-headline italic leading-tight">
          {cleanBookTitle(masterBook?.title || userBook.title)}
          {((editedData as any).volume || masterBook?.volume) && (
            <span className="text-3xl text-primary/50 ml-3">— {(editedData as any).volume || masterBook?.volume}</span>
          )}
        </h1>
        <Link
          href={`/author/${encodeURIComponent(masterBook?.author || userBook.author || "")}`}
          className="text-3xl font-headline text-primary italic hover:underline inline-flex items-center gap-3"
        >
          {authorPhoto && (
            <span className="relative h-9 w-9 rounded-full overflow-hidden shadow-sm flex-shrink-0 inline-block">
              <Image src={authorPhoto} alt="" fill className="object-cover" />
            </span>
          )}
          {cleanAuthorName(masterBook?.author || userBook.author)}
        </Link>
        {masterBook?.translator && (
          <p className="text-sm text-muted-foreground italic">Traduit par {cleanAuthorName(masterBook.translator)}</p>
        )}
      </div>

      {adminMode && masterBook && (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="font-headline italic text-lg leading-tight">Mode administrateur</p>
              <p className="text-xs opacity-60 italic">Modifie la fiche partagée (visible par toutes les lectrices), distincte de ta fiche perso ci-dessous.</p>
            </div>
          </div>
          <Button onClick={() => setShowMasterEditor(true)} className="rounded-2xl bg-primary h-12 px-6 font-headline italic shrink-0">
            <Pencil className="h-4 w-4 mr-2" /> Éditer la fiche partagée
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview">
            <TabsList className="bg-transparent border-b h-14 justify-start p-0 gap-12 mb-10 rounded-none w-full">
              <TabsTrigger value="overview" className="rounded-none border-b-4 border-transparent font-headline italic text-2xl data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-0">L'Œuvre</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none border-b-4 border-transparent font-headline italic text-2xl data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-0">Mon Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">
                 <div className="space-y-1"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Pages</div><span className="text-foreground">{masterBook?.pageCount || masterBook?.pages || "N/A"}</span></div>
                 <div className="space-y-1"><div className="flex items-center gap-2"><Hash className="h-4 w-4" /> ISBN</div><span className="text-foreground">{masterBook?.isbn13 || masterBook?.isbn || "N/A"}</span></div>
                 <div className="space-y-1"><div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Éditeur</div><span className="text-foreground">{masterBook?.publisher || "N/A"}</span></div>
                 <div className="space-y-1"><div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Langue</div><span className="text-foreground">{masterBook?.language || "N/A"}</span></div>
               </div>
               <button
                 onClick={() => { setEditionsOpen(true); findOtherEditions(); }}
                 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60 hover:text-primary transition-colors"
               >
                 <Library className="h-4 w-4" /> Voir les éditions
               </button>

               <Dialog open={editionsOpen} onOpenChange={setEditionsOpen}>
                 <DialogContent className="glass-card border-none max-w-lg p-10 bg-white/95 backdrop-blur-3xl max-h-[80vh] overflow-y-auto">
                   <DialogHeader>
                     <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
                       <Library className="h-6 w-6 text-primary" /> Éditions référencées
                     </DialogTitle>
                   </DialogHeader>
                   <p className="text-xs italic opacity-50 -mt-2">D'après ce que la communauté Lectoria a déjà ajouté — pas forcément exhaustif.</p>
                   <div className="space-y-3 pt-2">
                     <div className="rounded-2xl bg-primary/5 p-4 flex items-center justify-between gap-3">
                       <div className="min-w-0">
                         <p className="text-xs font-bold uppercase opacity-50">Cette édition</p>
                         <p className="text-sm italic truncate">{masterBook?.publisher || "Éditeur inconnu"} {masterBook?.language ? `· ${masterBook.language}` : ""}</p>
                       </div>
                       {(masterBook?.isbn13 || masterBook?.isbn) && <span className="text-[10px] opacity-40 shrink-0">{masterBook?.isbn13 || masterBook?.isbn}</span>}
                     </div>
                     {editionsLoading ? (
                       <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin opacity-40" /></div>
                     ) : otherEditions && otherEditions.length > 0 ? (
                       otherEditions.map((ed) => (
                         <div key={ed.id} className="rounded-2xl bg-white/60 p-4 flex items-center justify-between gap-3">
                           <div className="min-w-0">
                             <p className="text-sm italic truncate">{ed.publisher || "Éditeur inconnu"} {ed.language ? `· ${ed.language}` : ""}</p>
                             {ed.translator && <p className="text-[10px] opacity-50 italic">Traduit par {cleanAuthorName(ed.translator)}</p>}
                           </div>
                           {(ed.isbn13 || ed.isbn) && <span className="text-[10px] opacity-40 shrink-0">{ed.isbn13 || ed.isbn}</span>}
                         </div>
                       ))
                     ) : (
                       <p className="text-sm italic opacity-50 text-center py-6">Aucune autre édition référencée pour le moment.</p>
                     )}
                   </div>
                 </DialogContent>
               </Dialog>
               <div className="grid sm:grid-cols-2 gap-6 max-w-xl">
                 <div className="space-y-3">
                   <Label className="italic text-xl font-headline">Tome / Volume</Label>
                   <Input
                     value={(editedData as any).volume || ""}
                     onChange={(e) => setEditedData({ ...editedData, volume: e.target.value } as any)}
                     placeholder="ex : Tome 1"
                     className="h-11 rounded-xl bg-white/40 border-none italic"
                   />
                   <p className="text-[10px] text-muted-foreground italic">Utile pour distinguer les tomes d'une même série dans votre bibliothèque.</p>
                 </div>
                 <div className="space-y-3">
                   <Label className="italic text-xl font-headline">Saga (facultatif)</Label>
                   <Input
                     value={(editedData as any).saga || ""}
                     onChange={(e) => setEditedData({ ...editedData, saga: e.target.value } as any)}
                     placeholder="ex : Legacy of God"
                     className="h-11 rounded-xl bg-white/40 border-none italic"
                   />
                   <p className="text-[10px] text-muted-foreground italic">Pour regrouper des titres qui n'ont rien en commun entre eux — tape le même nom sur chaque tome.</p>
                 </div>
               </div>

               <div className="space-y-3">
                 <Label className="italic text-xl font-headline">Date de sortie</Label>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">US</Label>
                     <Input
                       value={(editedData as any).releaseDateUS || ""}
                       onChange={(e) => setEditedData({ ...editedData, releaseDateUS: e.target.value } as any)}
                       placeholder="ex : 2023"
                       className="h-11 rounded-xl bg-white/40 border-none italic"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">FR</Label>
                     <Input
                       value={(editedData as any).releaseDateFR || ""}
                       onChange={(e) => setEditedData({ ...editedData, releaseDateFR: e.target.value } as any)}
                       placeholder="ex : 2024"
                       className="h-11 rounded-xl bg-white/40 border-none italic"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">UE</Label>
                     <Input
                       value={(editedData as any).releaseDateUE || ""}
                       onChange={(e) => setEditedData({ ...editedData, releaseDateUE: e.target.value } as any)}
                       placeholder="ex : 2024"
                       className="h-11 rounded-xl bg-white/40 border-none italic"
                     />
                   </div>
                 </div>
               </div>
               <div className="p-10 rounded-[3rem] bg-white/40 border border-white/60 shadow-sm space-y-4">
                 <h4 className="font-headline text-2xl italic opacity-40">Résumé de la pépite</h4>
                 <Textarea
                   value={(editedData as any).description ?? cleanDescriptionHtml(masterBook?.description) ?? ""}
                   onChange={(e) => setEditedData({ ...editedData, description: e.target.value } as any)}
                   placeholder="Cette œuvre attend que vous en décriviez l'essence."
                   className="italic text-lg leading-relaxed text-muted-foreground bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary/20 resize-none min-h-[140px] p-0"
                 />
               </div>
               <div className="space-y-3 max-w-md">
                 <Label className="italic text-xl font-headline flex items-center gap-2">
                   <LinkIcon className="h-4 w-4" /> Lien de référence
                 </Label>
                 <div className="flex gap-2">
                   <Input
                     value={(editedData as any).referenceLink || ""}
                     onChange={(e) => setEditedData({ ...editedData, referenceLink: e.target.value } as any)}
                     placeholder="https://..."
                     className="h-11 rounded-xl bg-white/40 border-none italic"
                   />
                   <Button
                     onClick={handleFetchLinkInfo}
                     disabled={isFetchingLink || !(editedData as any).referenceLink}
                     variant="secondary"
                     title="Capturer le résumé et la couverture depuis ce lien"
                     className="h-11 px-4 rounded-xl shrink-0"
                   >
                     {isFetchingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Magnet className="h-4 w-4" />}
                   </Button>
                 </div>
                 <p className="text-xs italic text-muted-foreground leading-relaxed">
                   L'aimant capture le résumé et la couverture sur cette page (sans jamais écraser ce qui est déjà renseigné).
                 </p>
                 {(editedData as any).referenceLink && (
                   <a href={(editedData as any).referenceLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline italic break-all">
                     {(editedData as any).referenceLink}
                   </a>
                 )}
                 <p className="text-[10px] text-muted-foreground italic">Page d'achat, fiche Goodreads, interview de l'auteur... tout lien utile à garder sous la main.</p>
               </div>
               <div className="space-y-4">
                 <Label className="italic text-2xl font-headline">Genres</Label>
                 <div className="flex flex-wrap gap-2">
                   {taxonomy.genres.map((g) => {
                     const isActive = toArray<string>(editedData.genres).includes(g);
                     return (
                       <button
                         key={g}
                         type="button"
                         onClick={() => toggleTag("genres", g)}
                         className={cn(
                           "rounded-full border text-xs px-4 py-1.5 italic transition-all",
                           isActive ? "bg-primary text-white border-primary shadow-sm" : "border-primary/20 text-primary/60 bg-white/40 hover:bg-white/60"
                         )}
                       >
                         {g}
                       </button>
                     );
                   })}
                 </div>
               </div>

               <div className="space-y-4">
                 <Label className="italic text-2xl font-headline">Tropes</Label>
                 <div className="flex flex-wrap gap-2">
                   {taxonomy.tropes.map((t) => {
                     const isActive = toArray<string>(editedData.tropes).includes(t);
                     return (
                       <button
                         key={t}
                         type="button"
                         onClick={() => toggleTag("tropes", t)}
                         className={cn(
                           "rounded-full border text-xs px-4 py-1.5 italic transition-all",
                           isActive ? "bg-secondary text-white border-secondary shadow-sm" : "border-secondary/20 text-secondary/70 bg-white/40 hover:bg-white/60"
                         )}
                       >
                         {t}
                       </button>
                     );
                   })}
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">Cumulez 5 lectures avec le même genre ou trope pour débloquer le badge correspondant sur votre profil.</p>
               </div>

               <div className="space-y-4">
                 <Label className="italic text-2xl font-headline">Thèmes principaux</Label>
                 <div className="flex flex-wrap gap-2">
                   {taxonomy.themes.map((t) => {
                     const isActive = toArray<string>((editedData as any).themes).includes(t);
                     return (
                       <button
                         key={t}
                         type="button"
                         onClick={() => toggleTag("themes", t)}
                         className={cn(
                           "rounded-full border text-xs px-4 py-1.5 italic transition-all",
                           isActive ? "bg-primary text-white border-primary shadow-sm" : "border-primary/20 text-primary/60 bg-white/40 hover:bg-white/60"
                         )}
                       >
                         {t}
                       </button>
                     );
                   })}
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">De quoi parle vraiment ce livre sur le fond — à ne pas confondre avec les tropes ci-dessus, qui décrivent le schéma de la relation amoureuse.</p>
               </div>

               <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-primary h-12 px-8 font-headline italic">
                 {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Save className="mr-3 h-5 w-5" />} Enregistrer
               </Button>
            </TabsContent>

            <TabsContent value="journal" className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
               <div className="space-y-6">
                 <div className="flex items-center justify-between flex-wrap gap-4">
                   <Label className="italic text-3xl font-headline">Ma Note</Label>
                   <Dialog open={ratingGridOpen} onOpenChange={setRatingGridOpen}>
                     <DialogTrigger asChild>
                       <Button variant="outline" className="rounded-2xl h-11 px-6 italic font-headline border-primary/20">
                         <ClipboardList className="mr-2 h-4 w-4" /> Évaluer
                       </Button>
                     </DialogTrigger>
                     <DialogContent className="max-w-lg glass-card border-none bg-white/95 backdrop-blur-3xl shadow-2xl">
                       <DialogHeader>
                         <DialogTitle className="font-headline text-3xl italic">Grille d'évaluation</DialogTitle>
                       </DialogHeader>
                       <div className="space-y-5 py-2">
                         {EVALUATION_CRITERIA.map((c) => (
                           <div key={c.key} className="flex items-center justify-between gap-4">
                             <Label className="italic text-sm">{c.label}</Label>
                             <div className="flex gap-1 shrink-0">
                               {[1,2,3,4,5].map(s => (
                                 <Star
                                   key={s}
                                   onClick={() => setEditedData({
                                     ...editedData,
                                     detailedRatings: { ...((editedData as any).detailedRatings || {}), [c.key]: s }
                                   } as any)}
                                   className={cn(
                                     "h-5 w-5 cursor-pointer transition-all hover:scale-110",
                                     s <= (((editedData as any).detailedRatings || {})[c.key] || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/15"
                                   )}
                                 />
                               ))}
                             </div>
                           </div>
                         ))}
                       </div>
                       <DialogFooter>
                         <Button
                           onClick={async () => { await handleSave(); setRatingGridOpen(false); }}
                           disabled={isSaving}
                           className="w-full rounded-2xl bg-primary h-12 font-headline italic"
                         >
                           {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="mr-2 h-5 w-5" />} Enregistrer l'évaluation
                         </Button>
                       </DialogFooter>
                     </DialogContent>
                   </Dialog>
                 </div>
                 <div className="flex gap-4">
                   {[1,2,3,4,5].map(s => (
                    <Star 
                      key={s} 
                      onClick={() => setEditedData({ ...editedData, rating: s })} 
                      className={cn(
                        "h-12 w-12 cursor-pointer transition-all hover:scale-110", 
                        s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400 drop-shadow-md" : "text-muted-foreground/10"
                      )} 
                    />
                   ))}
                 </div>
               </div>

               <div className="space-y-6">
                 <Label className="italic text-3xl font-headline">Niveau Spicy</Label>
                 <div className="flex gap-4">
                   {[1,2,3,4,5].map(s => (
                    <Flame 
                      key={s} 
                      onClick={() => setEditedData({ ...editedData, spicyLevel: (editedData as any).spicyLevel === s ? 0 : s } as any)} 
                      className={cn(
                        "h-12 w-12 cursor-pointer transition-all hover:scale-110", 
                        s <= ((editedData as any).spicyLevel || 0) ? "text-orange-500 fill-orange-500 drop-shadow-md" : "text-muted-foreground/10"
                      )} 
                    />
                   ))}
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">0 = pas de spicy, 5 = très très spicy. Cliquez à nouveau sur la dernière flamme pour revenir à 0.</p>
               </div>

               <div className="grid sm:grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Début de lecture (facultatif)</Label>
                   <Input
                     type="date"
                     value={(editedData as any).readStartDate || ""}
                     onChange={(e) => setEditedData({ ...editedData, readStartDate: e.target.value } as any)}
                     className="h-12 rounded-xl bg-white/40 border-none italic"
                   />
                 </div>
                 <div className="space-y-3">
                   <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Fin de lecture (facultatif)</Label>
                   <Input
                     type="date"
                     value={(editedData as any).readEndDate || ""}
                     onChange={(e) => setEditedData({ ...editedData, readEndDate: e.target.value } as any)}
                     className="h-12 rounded-xl bg-white/40 border-none italic"
                   />
                 </div>
               </div>

               <div className="space-y-6">
                 <Label className="italic text-3xl font-headline">Mon Avis & Réflexions</Label>
                 <Textarea 
                  value={editedData.review || ""} 
                  onChange={(e) => setEditedData({ ...editedData, review: e.target.value })} 
                  placeholder="Qu'est-ce que cette lecture a gravé en vous ?"
                  className="min-h-[250px] rounded-[2rem] bg-white/40 border-none p-10 italic text-xl shadow-inner resize-none focus-visible:ring-1 focus-visible:ring-primary/20" 
                 />
               </div>

               <div className="grid sm:grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <Label className="italic text-xl font-headline">Citation préférée</Label>
                   <Textarea
                     value={editedData.favoriteQuote || ""}
                     onChange={(e) => setEditedData({ ...editedData, favoriteQuote: e.target.value })}
                     placeholder="Une phrase qui vous a marquée..."
                     className="min-h-[120px] rounded-2xl bg-white/40 border-none p-6 italic resize-none focus-visible:ring-1 focus-visible:ring-primary/20"
                   />
                 </div>
                 <div className="space-y-3">
                   <Label className="italic text-xl font-headline">Votre personnage pépite</Label>
                   <Input
                     value={(editedData as any).favoriteCharacter || ""}
                     onChange={(e) => setEditedData({ ...editedData, favoriteCharacter: e.target.value } as any)}
                     placeholder="Le personnage qui vous a le plus marquée"
                     className="h-12 rounded-xl bg-white/40 border-none italic"
                   />
                 </div>
               </div>

               <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-14 rounded-2xl bg-primary font-headline italic text-lg shadow-md">
                   {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Save className="mr-3 h-5 w-5" />} Enregistrer mon journal
                 </Button>
                 <Button asChild variant="outline" className="flex-1 h-14 rounded-2xl font-headline italic text-lg border-primary/20">
                   <Link href={`/share?book=${bookId}`}><Share2 className="mr-3 h-5 w-5" /> Exporter vers les réseaux</Link>
                 </Button>
               </div>
            </TabsContent>
          </Tabs>

      {adminMode && (
        <Dialog open={showMasterEditor} onOpenChange={setShowMasterEditor}>
          <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
            <ScrollArea className="max-h-[90vh] p-10">
              {masterBook && (
                <MasterBookEditor
                  book={masterBook}
                  onClose={() => setShowMasterEditor(false)}
                  onSaved={(saved) => {
                    setMasterBook((prev) => ({ ...(prev as any), ...saved }));
                    setShowMasterEditor(false);
                  }}
                />
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}