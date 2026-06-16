
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useStorage } from "@/firebase";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Heart, 
  Trash2, 
  Save, 
  Star, 
  Quote, 
  MessageSquare, 
  PersonStanding, 
  MapPin, 
  Loader2,
  CheckCircle2,
  Globe,
  Tag,
  Hash,
  Layers,
  Clock,
  User as UserIcon,
  ChevronRight,
  Bookmark,
  Book as BookIcon,
  Smartphone,
  Tablet,
  Headphones,
  Camera,
  Link as LinkIcon,
  X,
  UserCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { 
  Book, 
  STATUSES, 
  FORMATS, 
  RANKS, 
  BookStatus, 
  BookFormat, 
  RankType,
  GENRES_LIST,
  TROPES_LIST
} from "@/app/library/page";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();

  const bookRef = useMemo(() => {
    if (!db || !user || !bookId) return null;
    return doc(db, "users", user.uid, "books", bookId);
  }, [db, user, bookId]);

  const { data: book, loading: bookLoading } = useDoc(bookRef);

  const [isSaving, setIsSaving] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<Book>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (book) {
      setEditedData(book as Book);
      fetchAuthorPhoto(book.author);
    }
  }, [book]);

  const fetchAuthorPhoto = async (name: string) => {
    if (!name || name === "Auteur inconnu") return;
    try {
      const olRes = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}`);
      const data = await olRes.json();
      if (data.docs?.[0]) {
        setAuthorPhoto(`https://covers.openlibrary.org/a/id/${data.docs[0].id}-L.jpg`);
      }
    } catch (e) {}
  };

  const handleSave = async () => {
    if (!bookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(bookRef, { ...editedData, lastUpdated: serverTimestamp() });
      toast({ title: "Sanctuaire mis à jour", description: "Vos modifications ont été gravées." });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: bookRef.path,
        operation: 'update',
        requestResourceData: editedData,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bookRef || !confirm("Voulez-vous vraiment retirer cette pépite ?")) return;
    try {
      await deleteDoc(bookRef);
      router.push("/library");
      toast({ title: "Pépite retirée", description: "L'œuvre a quitté votre collection." });
    } catch (e) {}
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user || !bookRef) return;

    setIsUploading(true);
    const coverRef = ref(storage, `users/${user.uid}/covers/${bookId}-${Date.now()}`);
    try {
      await uploadBytes(coverRef, file);
      const url = await getDownloadURL(coverRef);
      await updateDoc(bookRef, { cover: url, lastUpdated: serverTimestamp() });
      setEditedData(prev => ({ ...prev, cover: url }));
      setIsEditingCover(false);
      toast({ title: "Couverture mise à jour" });
    } catch (error) {
      toast({ variant: "destructive", title: "Importation impossible" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverUrlSubmit = async () => {
    if (!newCoverUrl.trim() || !bookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(bookRef, { cover: newCoverUrl, lastUpdated: serverTimestamp() });
      setEditedData(prev => ({ ...prev, cover: newCoverUrl }));
      setIsEditingCover(false);
      setNewCoverUrl("");
      toast({ title: "Couverture mise à jour" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur URL" });
    } finally {
      setIsSaving(false);
    }
  };

  if (bookLoading) return <div className="h-[80vh] flex flex-col items-center justify-center gap-6"><Loader2 className="h-12 w-12 animate-spin text-primary/40" /><p className="font-headline italic text-primary/60 text-2xl">Ouverture de votre écrin...</p></div>;
  if (!book) return <div className="h-[80vh] flex flex-col items-center justify-center gap-6 text-center"><p className="font-headline italic text-primary/60 text-3xl">Cette pépite n'existe plus.</p><Button asChild variant="outline" className="rounded-2xl h-14 px-10"><Link href="/library">Retourner au sanctuaire</Link></Button></div>;

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-7xl mx-auto px-4">
      <header className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-6">
        <Button asChild variant="ghost" className="rounded-full text-lg font-headline italic"><Link href="/library"><ArrowLeft className="h-5 w-5 mr-3" /> Ma Bibliothèque</Link></Button>
        <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-primary h-14 px-10 shadow-xl font-headline italic text-xl">
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Save className="h-5 w-5 mr-3" />} Graver les modifications
        </Button>
      </header>

      <div className="grid lg:grid-cols-[400px_1fr] gap-16 items-start">
        <div className="space-y-10 flex flex-col items-center lg:items-start">
          <div className="relative w-full max-w-[280px] space-y-4">
            <div className="relative aspect-[2/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5 group">
              <Image src={editedData.cover || "https://picsum.photos/seed/p/600/900"} alt="" fill className="object-contain" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Button variant="secondary" onClick={() => setIsEditingCover(true)} className="rounded-full font-headline italic"><Camera className="h-4 w-4 mr-2" /> Modifier</Button></div>
            </div>
          </div>
          
          <Card className="glass-card p-10 border-none bg-white/60 space-y-10 w-full">
            <div className="space-y-5"><Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Statut</Label>
              <div className="flex flex-wrap gap-2">{Object.entries(STATUSES).map(([k,v]) => (<Button key={k} variant="outline" onClick={() => setEditedData({...editedData, status: k as BookStatus})} className={cn("rounded-full text-[9px] h-9 px-4 uppercase font-bold tracking-widest", editedData.status === k ? "bg-primary text-white" : "bg-white/40")}>{v.label}</Button>))}</div>
            </div>
            <div className="pt-6 border-t flex items-center justify-between">
              <span className="text-sm font-headline italic">De Plume</span>
              <Button variant="ghost" size="icon" onClick={() => setEditedData({...editedData, dePlume: !editedData.dePlume})} className={cn("rounded-full h-12 w-12", editedData.dePlume ? "text-primary bg-primary/10" : "text-muted-foreground/20")}><Heart className={cn("h-6 w-6", editedData.dePlume && "fill-primary")} /></Button>
            </div>
          </Card>

          <Button variant="ghost" onClick={handleDelete} className="w-full text-destructive rounded-2xl h-14 italic font-headline text-lg"><Trash2 className="h-5 w-5 mr-3" /> Retirer du sanctuaire</Button>
        </div>

        <div className="space-y-16">
          <section className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-6xl sm:text-7xl font-headline italic tracking-tight leading-[1.1]">{editedData.title}</h1>
              <div className="flex items-center gap-6">
                <Link href={`/author/${encodeURIComponent(editedData.author || "")}`} className="inline-flex items-center gap-3 text-3xl text-primary font-bold uppercase tracking-widest hover:opacity-70 group">
                  {editedData.author} <ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
                </Link>
                <div className="h-16 w-16 relative rounded-full overflow-hidden border-2 border-white shadow-md bg-secondary/10 flex items-center justify-center">
                  {authorPhoto ? (
                    <Image src={authorPhoto} alt="" fill className="object-cover" />
                  ) : (
                    <UserCircle className="h-10 w-10 text-primary/20" />
                  )}
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-primary/5 h-16 justify-start rounded-none mb-12 gap-12">
              <TabsTrigger value="overview" className="rounded-none font-headline italic text-2xl data-[state=active]:border-b-4 data-[state=active]:border-primary pb-4">L'Œuvre</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none font-headline italic text-2xl data-[state=active]:border-b-4 data-[state=active]:border-primary pb-4">Mon Journal</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-16 animate-paper">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-[11px] font-bold uppercase tracking-widest opacity-60">
                 <div><div className="flex items-center gap-3"><BookOpen className="h-5 w-5" /> Pages</div><span className="text-lg italic font-headline text-foreground">{editedData.pages || "Inconnu"}</span></div>
                 <div><div className="flex items-center gap-3"><CalendarIcon className="h-5 w-5" /> Parution</div><span className="text-lg italic font-headline text-foreground">{editedData.publicationDate || "Inconnue"}</span></div>
                 <div><div className="flex items-center gap-3"><Hash className="h-5 w-5" /> ISBN</div><span className="text-lg italic font-headline text-foreground">{editedData.isbn || "N/A"}</span></div>
                 <div><div className="flex items-center gap-3"><Globe className="h-5 w-5" /> Éditeur</div><span className="text-lg italic font-headline text-foreground">{editedData.publisher || "Inconnu"}</span></div>
               </div>
               <div className="space-y-8"><h3 className="font-headline italic text-4xl flex items-center gap-4"><Bookmark className="h-8 w-8" /> Résumé</h3><div className="p-10 rounded-[3rem] bg-white/40 shadow-inner"><p className="text-muted-foreground italic text-xl leading-relaxed whitespace-pre-wrap">{editedData.description || "Aucun résumé n'a encore été capturé."}</p></div></div>
            </TabsContent>
            <TabsContent value="journal" className="space-y-16 animate-paper">
               <div className="space-y-8"><Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Note</Label><div className="flex gap-6">{[1,2,3,4,5].map(s => (<Star key={s} onClick={() => setEditedData({...editedData, rating: s})} className={cn("h-14 w-14 cursor-pointer transition-all", s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/10")} />))}</div></div>
               <div className="space-y-5"><Label className="italic text-3xl font-headline">Mon avis</Label><Textarea value={editedData.review || ""} onChange={(e) => setEditedData({...editedData, review: e.target.value})} className="min-h-[200px] bg-white/40 rounded-[2rem] p-10 italic text-xl shadow-inner border-none" /></div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditingCover} onOpenChange={setIsEditingCover}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader><DialogTitle className="font-headline italic text-2xl">Modifier la couverture</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3"><Label className="text-[10px] uppercase font-bold opacity-60">URL Image</Label><div className="flex gap-2"><Input value={newCoverUrl} onChange={(e) => setNewCoverUrl(e.target.value)} placeholder="https://..." className="bg-white/40 border-none italic" /><Button onClick={handleCoverUrlSubmit}>Valider</Button></div></div>
            <div className="relative py-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div><div className="relative flex justify-center text-[10px] uppercase"><span className="bg-background px-4 opacity-40">Ou</span></div></div>
            <div className="space-y-3"><Label className="text-[10px] uppercase font-bold opacity-60">Depuis l'appareil</Label><Button variant="outline" className="w-full h-20 border-dashed rounded-2xl flex flex-col gap-2 hover:bg-primary/5" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}<span className="text-xs italic">{isUploading ? "Importation..." : "Choisir une photo"}</span></Button><input type="file" ref={fileInputRef} onChange={handleCoverUpload} className="hidden" accept="image/*" /></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
