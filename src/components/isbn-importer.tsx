
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
 * affiché en mode admin sur la page Ajouter.
 *
 * IMPORTANT (consigne explicite) : Google Books et Apple Books sont les
 * deux seules sources utilisées pour TROUVER un livre — la BnF n'est
 * plus jamais utilisée pour ça (elle ne fournit pas de couverture, ce
 * qui donnait des fiches inachevées). La BnF n'intervient plus qu'en
 * tout dernier lieu, uniquement pour compléter un résumé encore vide.
 * Si Google et Apple échouent tous les deux à identifier l'ISBN, on
 * arrête là plutôt que de créer une fiche sans couverture.
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

      let title = "", author = "", cover = "", description = "", publisher = "", pageCount = 0, foundSource = "";

      // 1. Google Books, source principale
      try {
        const gUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}`;
        const res = await fetchWithTimeout(gUrl, {}, 8000);
        const data = await res.json();
        const info = data.items?.[0]?.volumeInfo;
        if (info) {
          title = info.title || "";
          author = info.authors ? info.authors.join(", ") : "";
          cover = info.imageLinks?.thumbnail?.replace("http://", "https://") || "";
          description = cleanDescriptionHtml(info.description) || "";
          publisher = info.publisher || "";
          pageCount = info.pageCount || 0;
          foundSource = "google";
        }
      } catch { /* on tente Apple ensuite */ }

      // 2. Apple Books en repli si Google n'a rien donné
      if (!title) {
        try {
          const res = await fetchWithTimeout(`/api/itunes-search?q=${encodeURIComponent(cleanIsbn)}&isbn=1`, {}, 8000);
          const data = await res.json();
          const b = data.results?.[0];
          if (b) {
            title = b.title || "";
            author = b.author || "";
            cover = b.cover || "";
            description = b.description || "";
            foundSource = "apple";
          }
        } catch { /* aucune source n'a rien donné, on arrête plus bas */ }
      }

      if (!title) {
        toast({ variant: "destructive", title: "ISBN introuvable", description: "Ni Google Books ni Apple Books n'ont ce livre. Tu peux le créer manuellement (Nouvelle fiche) depuis la Bibliothèque." });
        return;
      }

      // 3. Garantie couverture : Open Library en dernier recours si les
      // deux sources principales n'en ont pas fourni.
      if (!cover) {
        cover = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      }

      // 4. BnF, uniquement pour combler un résumé encore vide — jamais
      // pour la couverture, le titre ou l'auteur.
      if (!description) {
        try {
          const bnfResults = await searchBnF(cleanIsbn, "isbn");
          description = cleanDescriptionHtml(bnfResults[0]?.description) || "";
        } catch { /* résumé optionnel, non bloquant */ }
      }

      await setDoc(masterRef, {
        title: title || "Titre inconnu",
        author: author || "Inconnu",
        cover,
        isbn13: cleanIsbn,
        description,
        publisher,
        pageCount,
        updatedAt: serverTimestamp(),
        source: `admin-isbn-import-${foundSource}`
      }, { merge: true });
      toast({ title: "Livre importé", description: `${title} a été ajouté à la base.` });
      setIsbn("");
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
          <p className="text-xs italic opacity-60">Google Books, puis Apple Books en repli.</p>
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
