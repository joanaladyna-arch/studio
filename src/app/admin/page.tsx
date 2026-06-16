
"use client";

import { useState } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Book, Landmark, Tags, Search, Loader2 } from "lucide-react";

export default function AdminPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [publisherName, setPublisherName] = useState("");

  // Simplified Admin check
  if (!user || user.email !== "votre-email@admin.com") { // Remplacez par votre email
    return <div className="p-20 text-center italic">Accès réservé aux gardiens de Plume.</div>;
  }

  const importByIsbn = async () => {
    if (!isbn.trim() || !db) return;
    setLoading(true);
    try {
      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
      const res = await fetch(gUrl);
      const data = await res.json();
      
      if (data.items) {
        const info = data.items[0].volumeInfo;
        const masterRef = doc(collection(db, "masterBooks"));
        await setDoc(masterRef, {
          title: info.title,
          author: info.authors ? info.authors.join(", ") : "Inconnu",
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
          isbn13: isbn,
          description: info.description || "",
          publisher: info.publisher || "",
          pageCount: info.pageCount || 0,
          updatedAt: serverTimestamp(),
          source: "admin-import"
        });
        toast({ title: "Livre importé", description: `${info.title} ajouté à la base centrale.` });
        setIsbn("");
      } else {
        toast({ variant: "destructive", title: "ISBN introuvable" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur d'importation" });
    } finally {
      setLoading(false);
    }
  };

  const addPublisher = async () => {
    if (!publisherName.trim() || !db) return;
    try {
      await addDoc(collection(db, "publishers"), {
        name: publisherName,
        slug: publisherName.toLowerCase().replace(/ /g, "-"),
        createdAt: serverTimestamp()
      });
      toast({ title: "Éditeur ajouté" });
      setPublisherName("");
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  return (
    <div className="space-y-12 animate-paper pb-20">
      <header className="pt-10 flex items-center gap-4">
        <Shield className="h-10 w-10 text-primary" />
        <h1 className="text-5xl font-headline italic">Sanctuaire Admin</h1>
      </header>

      <div className="grid md:grid-cols-2 gap-10">
        <Card className="glass-card border-none bg-white/60">
          <CardHeader>
            <CardTitle className="font-headline italic flex items-center gap-3">
              <Book className="h-6 w-6" /> Import MasterBook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="ISBN 13..." 
              value={isbn} 
              onChange={(e) => setIsbn(e.target.value)}
              className="h-12 italic bg-white/40"
            />
            <Button onClick={importByIsbn} disabled={loading} className="w-full h-12 bg-primary italic text-lg">
              {loading ? <Loader2 className="animate-spin" /> : "Importer via ISBN"}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-none bg-white/60">
          <CardHeader>
            <CardTitle className="font-headline italic flex items-center gap-3">
              <Landmark className="h-6 w-6" /> Gestion Éditeurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="Nom de l'éditeur..." 
              value={publisherName} 
              onChange={(e) => setPublisherName(e.target.value)}
              className="h-12 italic bg-white/40"
            />
            <Button onClick={addPublisher} className="w-full h-12 bg-secondary italic text-lg">Ajouter Éditeur</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
