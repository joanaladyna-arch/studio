
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, BookOpen, Globe, Hash, Plus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, cleanAuthorName, cleanBookTitle, cleanDescriptionHtml, authorKey } from "@/lib/utils";

/**
 * Fiche livre PUBLIQUE : consultable même quand le livre n'est pas (ou
 * pas encore) dans la bibliothèque personnelle de la lectrice — utile
 * pour cliquer sur une couverture depuis une recherche, une bibliographie
 * d'auteur, etc. et voir le résumé/les infos avant de décider de
 * l'ajouter. Lit directement la fiche partagée (masterBooks/{id}), ne
 * touche jamais aux données personnelles de qui que ce soit tant que la
 * lectrice n'a pas explicitement cliqué "Ajouter".
 */
export default function MasterBookPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const masterBookId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [isAdding, setIsAdding] = useState(false);
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !masterBookId) return;
    (async () => {
      try {
        let resolvedId = masterBookId;
        let snap = await getDoc(doc(db, "masterBooks", resolvedId));
        // Si cette fiche a été fusionnée dans une autre (admin →
        // doublons) entre le moment où le lien a été affiché et celui où
        // on clique, on suit la redirection enregistrée — sinon la
        // lectrice tomberait à tort sur "fiche introuvable".
        if (!snap.exists()) {
          const mergesSnap = await getDoc(doc(db, "config", "bookMerges"));
          const map: Record<string, string> = mergesSnap.exists() ? (mergesSnap.data() as any)?.map || {} : {};
          let hops = 0;
          while (map[resolvedId] && hops < 5) {
            resolvedId = map[resolvedId];
            hops++;
          }
          if (resolvedId !== masterBookId) {
            snap = await getDoc(doc(db, "masterBooks", resolvedId));
          }
        }
        if (snap.exists()) {
          setBook({ id: snap.id, ...snap.data() });
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Load Master Book Preview Error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, masterBookId]);

  useEffect(() => {
    if (!db || !book?.author) return;
    const unsub = onSnapshot(
      doc(db, "authors", authorKey(book.author)),
      (snap) => setAuthorPhoto(snap.exists() ? (snap.data() as any)?.photo || null : null),
      () => setAuthorPhoto(null)
    );
    return () => unsub();
  }, [db, book?.author]);

  const handleAdd = async () => {
    if (!db || !user || !book) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, "users", user.uid, "books"), {
        masterBookId: book.id,
        title: book.title || "Titre inconnu",
        author: book.author || "Auteur inconnu",
        cover: book.cover || "",
        genres: book.genres || [],
        tropes: book.tropes || [],
        themes: book.themes || [],
        description: book.description || "",
        volume: book.volume || "",
        status: selectedStatus,
        format: selectedFormat,
        dateAdded: serverTimestamp(),
        countTowardGoals: true,
      });
      toast({ title: "Pépite ajoutée", description: `${book.title} est dans ta bibliothèque.` });
      router.push("/library");
    } catch (err) {
      console.error("Add From Preview Error:", err);
      toast({ variant: "destructive", title: "Erreur lors de l'ajout" });
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
      </div>
    );
  }

  if (notFound || !book) {
    return (
      <div className="py-32 text-center space-y-6">
        <p className="text-muted-foreground italic text-lg">Cette fiche n'existe plus — elle a peut-être été fusionnée avec une autre.</p>
        <Button asChild variant="outline" className="rounded-2xl"><Link href="/add"><ArrowLeft className="mr-2 h-4 w-4" /> Retour à la recherche</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-paper pb-32 max-w-4xl mx-auto px-4">
      <Link href="/add" className="inline-flex items-center gap-2 text-sm text-primary/60 hover:text-primary transition-colors italic">
        <ArrowLeft className="h-4 w-4" /> Retour à la recherche
      </Link>

      <div className="flex flex-col sm:flex-row gap-10">
        <div className="relative w-full sm:w-56 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-xl mx-auto sm:mx-0">
          <BookCover src={book.cover} alt={book.title} className="object-cover" />
        </div>

        <div className="flex-1 space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-4xl font-headline italic leading-tight">
              {cleanBookTitle(book.title)}
              {book.volume && <span className="text-2xl text-primary/50 ml-3">— {book.volume}</span>}
            </h1>
            <Link
              href={`/author/${encodeURIComponent(book.author || "")}`}
              className="text-2xl font-headline text-primary italic hover:underline inline-flex items-center gap-3"
            >
              {authorPhoto && (
                <span className="relative h-8 w-8 rounded-full overflow-hidden shadow-sm flex-shrink-0 inline-block">
                  <img src={authorPhoto} alt="" className="w-full h-full object-cover" />
                </span>
              )}
              {cleanAuthorName(book.author)}
            </Link>
            {book.translator && (
              <p className="text-sm text-muted-foreground italic">Traduit par {cleanAuthorName(book.translator)}</p>
            )}
          </div>

          <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-40 justify-center sm:justify-start flex-wrap">
            <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {book.pageCount || book.pages || "N/A"} pages</span>
            <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> {book.publisher || "Éditeur inconnu"}</span>
            {(book.isbn13 || book.isbn) && <span className="flex items-center gap-2"><Hash className="h-4 w-4" /> {book.isbn13 || book.isbn}</span>}
          </div>

          {(book.genres?.length > 0 || book.tropes?.length > 0 || book.themes?.length > 0) && (
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {[...(book.genres || []), ...(book.tropes || []), ...(book.themes || [])].map((tag: string) => (
                <span key={tag} className="text-xs italic px-3 py-1 rounded-full bg-primary/5 text-primary/70">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-10 rounded-[3rem] bg-white/40 border border-white/60 shadow-sm space-y-4">
        <h2 className="font-headline text-2xl italic opacity-40">Résumé</h2>
        <p className="italic text-lg leading-relaxed text-muted-foreground whitespace-pre-line">
          {cleanDescriptionHtml(book.description) || "Cette œuvre n'a pas encore de résumé."}
        </p>
      </div>

      {user && (
        <div className="p-10 rounded-[3rem] bg-white/60 border border-white/60 shadow-sm space-y-8">
          <h2 className="font-headline text-2xl italic">Ajouter à ma bibliothèque</h2>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Statut</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUSES).map(([k, v]: [string, any]) => (
                <button
                  key={k}
                  onClick={() => setSelectedStatus(k as BookStatus)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-sm italic border transition-colors",
                    selectedStatus === k ? "bg-primary text-white border-primary" : "bg-white/60 border-primary/10 text-primary/70"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Format</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FORMATS).map(([k, v]: [string, any]) => (
                <button
                  key={k}
                  onClick={() => setSelectedFormat(k as BookFormat)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-sm italic border transition-colors",
                    selectedFormat === k ? "bg-primary text-white border-primary" : "bg-white/60 border-primary/10 text-primary/70"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleAdd} disabled={isAdding} className="w-full h-14 rounded-2xl bg-primary italic font-headline text-xl shadow-xl shadow-primary/10">
            {isAdding ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Plus className="h-5 w-5 mr-3" />} Ajouter à ma bibliothèque
          </Button>
        </div>
      )}
    </div>
  );
}
