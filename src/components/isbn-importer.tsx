
"use client";

import { useState } from "react";
import { useFirestore } from "@/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Book, Loader2 } from "lucide-react";
import { fetchWithTimeout, searchBnF, slugify, cleanIsbnValue, cleanDescriptionHtml } from "@/lib/utils";

/**
 * Import d'un livre dans la base partagée par son ISBN, pensé pour être
 * affiché en mode admin sur la page Ajouter. Interroge Google Books, puis
 * la BnF en repli (meilleure couverture des petites maisons françaises).
 * Ne crée jamais de doublon ni n'écrase une fiche existante enrichie.
 */
export function IsbnImporter() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);

  const importByIsbn = async () => {
    const cleanIsbn = cleanIsbnValue(isbn);
    if (!cleanIsbn || !db) return;
    setLoading(true);
    try {
      const docId = slugify(cleanIsbn);
      const masterRef = doc(db, "masterBooks", docId);

      const existingSnap = await getDoc(masterRef);
      if (existingSnap.exists()) {
        toast({ title: "Déjà dans la base", description: `${existingSnap.data()?.title || "Ce livre"} existe déjà — édite-le depuis la Bibliothèque pour le compléter sans rien perdre.` });
        setLoading(false);
        return;
      }

      const gUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}`;
      const res = await fetchWithTimeout(gUrl, {}, 8000);
      const data = await res.json();
      const info = data.items?.[0]?.volumeInfo;

      if (info) {
        await setDoc(masterRef, {
          title: info.title || "Titre inconnu",
          author: info.authors ? info.authors.join(", ") : "Inconnu",
          cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || "",
          isbn13: cleanIsbn,
          description: cleanDescriptionHtml(info.description),
          publisher: info.publisher || "",
          pageCount: info.pageCount || 0,
          updatedAt: serverTimestamp(),
          source: "admin-isbn-import"
        }, { merge: true });
        toast({ title: "Livre importé", description: `${info.title || "Le livre"} a été ajouté à la base (Google Books).` });
        setIsbn("");
        return;
      }

      const bnfResults = await searchBnF(cleanIsbn, "isbn");
      const bnfBook = bnfResults[0];
      if (bnfBook) {
        await setDoc(masterRef, {
          title: bnfBook.title || "Titre inconnu",
          author: bnfBook.author || "Inconnu",
          translator: bnfBook.translator || "",
          cover: "",
          isbn13: cleanIsbn,
          publisher: bnfBook.publisher || "",
          language: bnfBook.language || "",
          publishedDate: bnfBook.publishedDate || "",
          updatedAt: serverTimestamp(),
          source: "admin-isbn-import-bnf"
        }, { merge: true });
        toast({ title: "Livre importé (BnF)", description: `${bnfBook.title} a été ajouté. Pense à ajouter la couverture en l'éditant depuis la Bibliothèque.` });
        setIsbn("");
      } else {
        toast({ variant: "destructive", title: "ISBN introuvable", description: "Ni Google Books ni la BnF n'ont ce livre. Tu peux le créer manuellement (Nouvelle fiche) depuis la Bibliothèque." });
      }
    } catch (err) {
      console.error("Import ISBN Error:", err);
      toast({ variant: "destructive", title: "Erreur d'importation" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Book className="h-6 w-6 text-primary" />
        <div>
          <h3 className="font-headline text-xl italic">Importer un livre par ISBN</h3>
          <p className="text-xs italic opacity-60">Google Books, puis BnF en repli si introuvable.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="9782..."
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); importByIsbn(); } }}
          className="h-12 italic bg-white/40 rounded-xl border-none shadow-inner"
        />
        <Button onClick={importByIsbn} disabled={loading} className="h-12 px-6 rounded-xl bg-primary italic shrink-0">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Importer"}
        </Button>
      </div>
    </div>
  );
}
