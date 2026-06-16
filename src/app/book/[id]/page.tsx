
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Heart, 
  Trash2, 
  Save, 
  Star, 
  Bookmark,
  Globe,
  Hash,
  Loader2,
  ChevronRight,
  Camera,
  UserCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UserBook, MasterBook, STATUSES } from "@/app/library/page";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
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

  useEffect(() => {
    if (userBook) {
      setEditedData(userBook);
      fetchMasterData(userBook.masterBookId);
    }
  }, [userBook]);

  const fetchMasterData = async (mid: string) => {
    if (!db || !mid) return;
    setMasterLoading(true);
    try {
      const mSnap = await getDoc(doc(db, "masterBooks", mid));
      if (mSnap.exists()) setMasterBook({ id: mSnap.id, ...mSnap.data() } as MasterBook);
    } finally {
      setMasterLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userBookRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userBookRef, editedData);
      toast({ title: "Journal mis à jour" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!userBookRef || !confirm("Retirer ce livre de votre sanctuaire ?")) return;
    await deleteDoc(userBookRef);
    router.push("/library");
  };

  if (userLoading || masterLoading) return <div className="h-screen flex items-center justify-center italic">Ouverture du livre...</div>;
  if (!userBook || !masterBook) return <div className="p-20 text-center">Livre introuvable.</div>;

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-7xl mx-auto px-4">
      <header className="flex justify-between items-center pt-4">
        <Button asChild variant="ghost" className="font-headline italic text-lg">
          <Link href="/library"><ArrowLeft className="mr-3" /> Bibliothèque</Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-primary h-14 px-10 shadow-xl font-headline italic">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-3" />} Graver
        </Button>
      </header>

      <div className="grid lg:grid-cols-[350px_1fr] gap-16">
        <div className="space-y-8">
          <div className="relative aspect-[2/3] rounded-[3rem] overflow-hidden shadow-2xl border border-white/60 bg-secondary/5">
            <Image src={masterBook.cover || userBook.cover || ""} alt="" fill className="object-contain" />
          </div>
          <Card className="glass-card p-6 border-none bg-white/60">
             <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Statut</Label>
               <div className="flex flex-wrap gap-2">
                 {Object.entries(STATUSES).map(([k, v]) => (
                   <Button key={k} variant="outline" onClick={() => setEditedData({ ...editedData, status: k as any })} className={cn("rounded-full h-8 px-3 text-[9px] uppercase font-bold", editedData.status === k ? "bg-primary text-white" : "bg-white/40")}>{v.label}</Button>
                 ))}
               </div>
             </div>
          </Card>
          <Button variant="ghost" onClick={handleDelete} className="w-full text-destructive rounded-xl h-12 italic"><Trash2 className="mr-2 h-4 w-4" /> Retirer</Button>
        </div>

        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-6xl font-headline italic leading-tight">{masterBook.title}</h1>
            <p className="text-3xl font-headline text-primary italic">{masterBook.author}</p>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="bg-transparent border-b h-14 justify-start p-0 gap-10 mb-8">
              <TabsTrigger value="overview" className="rounded-none font-headline italic text-2xl data-[state=active]:border-b-4 data-[state=active]:border-primary pb-4">L'Œuvre</TabsTrigger>
              <TabsTrigger value="journal" className="rounded-none font-headline italic text-2xl data-[state=active]:border-b-4 data-[state=active]:border-primary pb-4">Mon Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-8">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px] font-bold uppercase tracking-widest opacity-60">
                 <div><div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Pages</div><span>{masterBook.pages || "N/A"}</span></div>
                 <div><div className="flex items-center gap-2"><Hash className="h-4 w-4" /> ISBN</div><span>{masterBook.isbn || "N/A"}</span></div>
                 <div><div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Éditeur</div><span>{masterBook.publisher || "N/A"}</span></div>
               </div>
               <div className="p-8 rounded-[2rem] bg-white/40 italic text-lg leading-relaxed">{masterBook.description || "Aucun résumé."}</div>
            </TabsContent>

            <TabsContent value="journal" className="space-y-8">
               <div className="space-y-4">
                 <Label className="italic text-2xl font-headline">Ma Note</Label>
                 <div className="flex gap-2">
                   {[1,2,3,4,5].map(s => <Star key={s} onClick={() => setEditedData({ ...editedData, rating: s })} className={cn("h-10 w-10 cursor-pointer", s <= (editedData.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/10")} />)}
                 </div>
               </div>
               <div className="space-y-4">
                 <Label className="italic text-2xl font-headline">Mon Avis</Label>
                 <Textarea value={editedData.review || ""} onChange={(e) => setEditedData({ ...editedData, review: e.target.value })} className="min-h-[150px] rounded-2xl bg-white/40 p-6 italic text-lg" />
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
