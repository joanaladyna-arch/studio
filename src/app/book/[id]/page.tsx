"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
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
  Upload
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn, toArray } from "@/lib/utils";
import { UserBook, MasterBook, STATUSES, RANKS, RankType } from "@/app/library/page";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useStorage } from "@/firebase";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();

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

  // Récupération des données Master
  const fetchMasterData = useCallback(async (mid: string) => {
    if (!db || !mid) return;
    setMasterLoading(true);
    try {
      const mSnap = await getDoc(doc(db, "masterBooks", mid));
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

  const handleSave = async () => {
    if (!userBookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userBookRef, {
        ...editedData,
        updatedAt: serverTimestamp()
      });
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
    if (!userBookRef || !confirm("Retirer ce livre de votre sanctuaire ?")) return;
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
        <p className="text-muted-foreground italic">Cette pépite semble avoir disparu de votre sanctuaire.</p>
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

      <div className="grid lg:grid-cols-[350px_1fr] gap-16">
        <div className="space-y-8">
          <div className="relative aspect-[2/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5 group">
            <Image 
              src={editedData.cover || masterBook?.cover || "https://picsum.photos/seed/p/400/600"} 
              alt={masterBook?.title || "Livre"} 
              fill 
              className="object-contain" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <Label className="cursor-pointer bg-white text-primary px-4 py-2 rounded-full flex items-center gap-2 font-headline italic">
                 <Camera className="h-4 w-4" /> Changer
                 <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
               </Label>
            </div>
          </div>

          <Card className="glass-card p-8 border-none bg-white/60 space-y-8 shadow-sm">
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
             </div>

             <div className="space-y-4 pt-4 border-t border-primary/5">
               <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Mon Rang Plume</Label>
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

          <Button variant="ghost" onClick={handleDelete} className="w-full text-destructive hover:text-destructive hover:bg-rose-50 rounded-2xl h-14 italic font-headline text-lg">
            <Trash2 className="mr-3 h-5 w-5" /> Retirer du sanctuaire
          </Button>
        </div>

        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-6xl font-headline italic leading-tight">{masterBook?.title || userBook.title}</h1>
            <p className="text-3xl font-headline text-primary italic">{masterBook?.author || userBook.author}</p>
          </div>

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
               </div>
               <div className="p-10 rounded-[3rem] bg-white/40 border border-white/60 shadow-sm">
                 <h4 className="font-headline text-2xl italic mb-6 opacity-40">Résumé de la pépite</h4>
                 <p className="italic text-lg leading-relaxed text-muted-foreground">{masterBook?.description || "Cette œuvre attend que vous en décriviez l'essence."}</p>
               </div>
               {(() => {
                 const genres = toArray<string>(masterBook?.genres).length > 0 ? toArray<string>(masterBook?.genres) : toArray<string>(userBook.genres);
                 return genres.length > 0 ? (
                   <div className="flex flex-wrap gap-2">
                     {genres.map((g) => (
                       <Badge key={g} variant="outline" className="rounded-full border-primary/20 text-primary/70 italic text-xs px-4 py-1.5">{g}</Badge>
                     ))}
                   </div>
                 ) : null;
               })()}
            </TabsContent>

            <TabsContent value="journal" className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
               <div className="space-y-6">
                 <Label className="italic text-3xl font-headline">Ma Note</Label>
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
                 <Label className="italic text-3xl font-headline">Mon Avis & Réflexions</Label>
                 <Textarea 
                  value={editedData.review || ""} 
                  onChange={(e) => setEditedData({ ...editedData, review: e.target.value })} 
                  placeholder="Qu'est-ce que cette lecture a gravé en vous ?"
                  className="min-h-[250px] rounded-[2rem] bg-white/40 border-none p-10 italic text-xl shadow-inner resize-none focus-visible:ring-1 focus-visible:ring-primary/20" 
                 />
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}