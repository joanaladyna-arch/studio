
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, doc, setDoc, serverTimestamp, query, where, getDocs, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  User as UserIcon, 
  CheckCircle2, 
  Plus, 
  Globe,
  Heart,
  Bell,
  BellRing,
  Newspaper,
  Pencil
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUSES, FORMATS, BookStatus, BookFormat } from "@/app/library/page";
import { cn, fetchWithTimeout, toArray, searchBnF, authorKey, cleanDescriptionHtml, cleanIsbnValue, stableBookKey, isAuthorMatch, defaultAvatarUrl } from "@/lib/utils";
import { useAdminMode } from "@/components/admin-mode";
import { AuthorEditor } from "@/components/author-editor";
import { MasterBookEditor } from "@/components/master-book-editor";

export default function AuthorPage() {
  const params = useParams();
  const authorName = decodeURIComponent(params.name as string);
  const authorSlug = useMemo(() => authorKey(authorName), [authorName]);
  const { user } = useUser();
  const { adminMode } = useAdminMode();
  const [showAuthorEditor, setShowAuthorEditor] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [authorDocId, setAuthorDocId] = useState<string | null>(null);
  const db = useFirestore();
  const { toast } = useToast();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorBio, setAuthorBio] = useState("");
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);
  const [authorPhotoFailed, setAuthorPhotoFailed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [actualites, setActualites] = useState<any[]>([]);

  const [pendingBook, setPendingBook] = useState<any | null>(null);
  const [previewBook, setPreviewBook] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("pal");
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("papier");
  const [isAdding, setIsAdding] = useState(false);
  const [isDePlume, setIsDePlume] = useState(false);

  const libraryQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: currentLibrary = [] } = useCollection(libraryQuery);

  const isAlreadyInLibrary = useCallback((book: any) => {
    return currentLibrary.find(b => 
      (b.isbn && b.isbn === book.isbn) || 
      ((b.title || "").toLowerCase() === (book.title || "").toLowerCase() && (b.author || "").toLowerCase() === (book.author || "").toLowerCase())
    );
  }, [currentLibrary]);

  // Statut de suivi de cet auteur, et ses actualités publiées (visibles
  // par toutes les lectrices) — échoue toujours silencieusement, jamais
  // bloquant pour le reste de la fiche auteur.
  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "actualites"))
      .then((snap) => {
        const matching = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((a) => a.authorSlug === authorSlug);
        matching.sort((a, b) => (b.publishedAt?.toMillis?.() || 0) - (a.publishedAt?.toMillis?.() || 0));
        setActualites(matching);
      })
      .catch((err) => console.error("Load Author Actualites Error:", err));

    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const followed: string[] = snap.data()?.followedAuthors || [];
        setIsFollowing(followed.includes(authorSlug));
      })
      .catch((err) => console.error("Load Follow Status Error:", err));
  }, [db, user, authorSlug]);

  const toggleFollow = async () => {
    if (!db || !user) return;
    setIsFollowLoading(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { followedAuthors: isFollowing ? arrayRemove(authorSlug) : arrayUnion(authorSlug) },
        { merge: true }
      );
      setIsFollowing(!isFollowing);
      toast({ title: isFollowing ? "Auteur retiré du suivi" : "Auteur suivi", description: isFollowing ? undefined : "Tu seras alertée des prochaines actualités de cet auteur." });
    } catch (err) {
      console.error("Toggle Follow Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setIsFollowLoading(false);
    }
  };

  useEffect(() => {
    const fetchAuthorUniverse = async () => {
      setLoading(true);
      setAuthorPhotoFailed(false);
      try {
        // 1. Fiche auteur manuelle (admin) en priorité : si une bio/photo a
        // été saisie à la main, elle prime sur Open Library. On la cherche
        // par slug insensible à l'ordre du nom.
        let manualBio = "";
        let manualPhoto = "";
        if (db) {
          try {
            const authorDoc = await getDoc(doc(db, "authors", authorSlug));
            if (authorDoc.exists()) {
              const ad: any = authorDoc.data();
              if (ad.manualBio && ad.bio) manualBio = ad.bio;
              if (ad.manualPhoto && ad.photo) manualPhoto = ad.photo;
            }
          } catch (e) {
            console.error("Manual author fiche error:", e);
          }
        }
        if (manualBio) setAuthorBio(manualBio);
        if (manualPhoto) setAuthorPhoto(manualPhoto);

        const olRes = await fetchWithTimeout(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}`, {}, 8000);
        const olData = await olRes.json();
        if (olData.docs?.[0]?.key) {
           try {
             const bioRes = await fetchWithTimeout(`https://openlibrary.org/authors/${olData.docs[0].key}.json`, {}, 8000);
             const bioData = await bioRes.json();
             // On ne remplace par Open Library QUE si rien n'a été saisi à la main.
             if (!manualBio) setAuthorBio(typeof bioData.bio === 'string' ? bioData.bio : bioData.bio?.value || "Biographie en cours d'écriture...");
             if (!manualPhoto) setAuthorPhoto(`https://covers.openlibrary.org/a/olid/${olData.docs[0].key}-L.jpg`);
           } catch (bioErr) {
             console.error("Author Bio Error:", bioErr);
             // On continue sans biographie plutôt que de bloquer toute la page
           }
        }

        // On interroge en parallèle Google Books (univers large), la
        // base Lectoria (masterBooks) et la BnF (Bibliothèque nationale de
        // France) : sans ça, les livres importés via Excel/admin ou
        // publiés chez de petites maisons françaises (BMR, Nox,
        // Chatterley...) que Google Books référence mal n'apparaissent
        // jamais sur la fiche de leur auteur. Le dépôt légal rend le
        // catalogue de la BnF exhaustif pour tout livre publié en France.
        const [googleSettled, masterSettled, bnfSettled, appleSettled] = await Promise.allSettled([
          (async () => {
            const url = `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(authorName)}&maxResults=40&orderBy=newest`;
            const response = await fetchWithTimeout(url, {}, 8000);
            const data = await response.json();
            if (!data.items) return [];
            return data.items.map((item: any) => {
              const info = item.volumeInfo;
              return {
                id: item.id,
                title: info.title,
                subtitle: info.subtitle,
                author: info.authors ? info.authors.join(", ") : authorName,
                publisher: info.publisher,
                cover: info.imageLinks?.thumbnail?.replace("http://", "https://"),
                pages: info.pageCount || 0,
                description: cleanDescriptionHtml(info.description),
                publicationDate: info.publishedDate,
                genres: info.categories || [],
                language: "Français",
                isbn: info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier ||
                      info.industryIdentifiers?.[0]?.identifier ||
                      "",
              };
            });
          })(),
          (async () => {
            if (!db) return [];
            const masterRef = collection(db, "masterBooks");
            const q = query(masterRef, where("author", ">=", authorName), where("author", "<=", authorName + "\uf8ff"));
            const snap = await getDocs(q);
            return snap.docs.map(d => {
              const data: any = d.data();
              return {
                id: d.id,
                masterBookId: d.id,
                title: data.title,
                subtitle: data.subtitle,
                author: data.author || authorName,
                publisher: data.publisher,
                cover: data.cover,
                pages: data.pageCount || data.pages || 0,
                description: data.description || "",
                publicationDate: data.publishedDate,
                genres: data.genres || [],
                language: data.language || "Français",
                isbn: data.isbn13 || data.isbn || "",
                source: "master",
              };
            });
          })(),
          (async () => {
            const bnfResults = await searchBnF(authorName, "author");
            return bnfResults.map((b: any) => ({
              id: b.id,
              title: b.title,
              subtitle: "",
              author: b.author || authorName,
              translator: b.translator || "",
              publisher: b.publisher,
              cover: b.cover || undefined,
              pages: 0,
              description: "",
              publicationDate: b.publicationDate,
              genres: toArray<string>(b.genres),
              language: b.language || "Français",
              isbn: b.isbn || "",
              source: "bnf",
            }));
          })(),
          (async () => {
            const res = await fetchWithTimeout(`/api/itunes-search?q=${encodeURIComponent(authorName)}`, {}, 8000);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.results || []).map((b: any) => ({
              id: b.id,
              title: b.title,
              subtitle: "",
              author: b.author || authorName,
              publisher: "",
              cover: b.cover || undefined,
              pages: 0,
              description: b.description || "",
              publicationDate: b.publishedDate,
              genres: toArray<string>(b.genres),
              language: b.language || "",
              isbn: "",
              source: "apple",
            }));
          })(),
        ]);

        const bnfResults = (bnfSettled.status === "fulfilled" ? bnfSettled.value : [])
          .filter((b: any) => isAuthorMatch(b.author, authorName));

        const googleResults = (googleSettled.status === "fulfilled" ? googleSettled.value : [])
          .filter((g: any) => isAuthorMatch(g.author, authorName));
        const masterResults = (masterSettled.status === "fulfilled" ? masterSettled.value : [])
          .filter((m: any) => isAuthorMatch(m.author, authorName));
        // La base Lectoria (masterBooks) est prioritaire, suivie de la BnF
        // (plus fiable que Google Books pour les éditeurs français) :
        // on évite les doublons en excluant de chaque source suivante
        // tout titre déjà présent dans les sources précédentes.
        const dedupedBnf = bnfResults.filter((b: any) =>
          !masterResults.some((m: any) => (m.title || "").toLowerCase() === (b.title || "").toLowerCase())
        );
        const dedupedGoogle = googleResults.filter((g: any) =>
          !masterResults.some((m: any) => (m.title || "").toLowerCase() === (g.title || "").toLowerCase()) &&
          !dedupedBnf.some((b: any) => (b.title || "").toLowerCase() === (g.title || "").toLowerCase())
        );
        const appleResults = (appleSettled.status === "fulfilled" ? appleSettled.value : [])
          .filter((a: any) => isAuthorMatch(a.author, authorName));
        const dedupedApple = appleResults.filter((a: any) =>
          !masterResults.some((m: any) => (m.title || "").toLowerCase() === (a.title || "").toLowerCase()) &&
          !dedupedBnf.some((b: any) => (b.title || "").toLowerCase() === (a.title || "").toLowerCase()) &&
          !dedupedGoogle.some((g: any) => (g.title || "").toLowerCase() === (a.title || "").toLowerCase())
        );
        setResults([...masterResults, ...dedupedBnf, ...dedupedGoogle, ...dedupedApple]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (authorName) fetchAuthorUniverse();
  }, [authorName]);

  const handleOpenAddDialog = (book: any) => {
    setPendingBook(book);
    setSelectedStatus("pal");
    setSelectedFormat("papier");
    setIsDePlume(false);
  };

  const confirmAdd = async () => {
    if (!db || !user || !pendingBook) return;

    setIsAdding(true);
    try {
      // Si le livre vient déjà de la base Lectoria (masterBooks), on réutilise
      // sa fiche existante au lieu d'en recréer une en double. Sinon
      // (résultat Google Books/BnF/Open Library), on calcule un
      // identifiant STABLE (ISBN nettoyé, ou clé titre+auteur normalisée)
      // au lieu d'un identifiant aléatoire — pour que ce même livre,
      // retrouvé une autre fois avec une légère variation de saisie,
      // retombe sur la même fiche au lieu d'en créer une en double. Si la
      // fiche existe déjà sous cet identifiant, on ne l'écrase jamais :
      // on ne complète que les champs encore vides.
      let masterBookId = pendingBook.masterBookId;
      if (!masterBookId) {
        const cleanedIsbn = cleanIsbnValue(pendingBook.isbn);
        const rawKey = cleanedIsbn || stableBookKey(pendingBook.title, pendingBook.author || authorName);
        masterBookId = rawKey && rawKey !== "-" ? rawKey : `unknown-${Date.now()}`;
        const masterRef = doc(db, "masterBooks", masterBookId);
        const existingSnap = await getDoc(masterRef);
        const existing: any = existingSnap.exists() ? existingSnap.data() : {};
        const keepText = (incoming: any, current: any) => {
          const v = (incoming ?? "").toString().trim();
          return v ? v : (current ?? "");
        };
        const keepArr = (incoming: any, current: any) =>
          Array.isArray(incoming) && incoming.length ? incoming : (Array.isArray(current) ? current : []);
        const keepNum = (incoming: any, current: any) => (incoming > 0 ? incoming : (current ?? 0));

        await setDoc(masterRef, {
          title: keepText(pendingBook.title, existing.title) || "Titre inconnu",
          subtitle: keepText(pendingBook.subtitle, existing.subtitle),
          author: keepText(pendingBook.author || authorName, existing.author),
          cover: keepText(pendingBook.cover, existing.cover),
          isbn13: keepText(cleanedIsbn, existing.isbn13),
          description: keepText(pendingBook.description, existing.description),
          publisher: keepText(pendingBook.publisher, existing.publisher),
          translator: keepText(pendingBook.translator, existing.translator),
          pageCount: keepNum(pendingBook.pages, existing.pageCount),
          publishedDate: keepText(pendingBook.publicationDate, existing.publishedDate),
          genres: keepArr(toArray<string>(pendingBook.genres), existing.genres),
          updatedAt: serverTimestamp(),
          source: existing.source || "discovered"
        }, { merge: true });
      }

      const booksRef = collection(db, "users", user.uid, "books");
      const bookData = {
        masterBookId,
        title: pendingBook.title || "Titre inconnu",
        author: pendingBook.author || authorName,
        cover: pendingBook.cover || "",
        genres: toArray<string>(pendingBook.genres),
        status: selectedStatus,
        format: selectedFormat,
        dePlume: isDePlume,
        dateAdded: serverTimestamp(),
        progress: selectedStatus === 'read' ? 100 : 0,
        pagesRead: 0,
      };

      await addDoc(booksRef, bookData)
        .then(() => {
          toast({ title: "Pépite ajoutée", description: `${pendingBook.title} a rejoint votre réserve.` });
          setPendingBook(null);
        })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: booksRef.path, operation: 'create', requestResourceData: bookData }));
        });
    } catch (err: any) {
      console.error("Add Book From Author Error:", err);
      toast({ variant: "destructive", title: "Impossible d'ajouter le livre", description: err?.message || "Erreur inconnue." });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-12 animate-paper pb-32 max-w-6xl mx-auto px-4">
      <header className="space-y-10 pt-8">
        <Button asChild variant="ghost" className="rounded-full hover:bg-primary/5 text-primary text-lg font-headline italic">
          <Link href="/library"><ArrowLeft className="h-5 w-5 mr-3" /> Ma Bibliothèque</Link>
        </Button>
        
        <div className="flex flex-col md:flex-row gap-12 items-center md:items-start text-center md:text-left">
          <div className="relative h-48 w-48 shrink-0 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-primary/5 flex items-center justify-center">
            {authorPhoto && !authorPhotoFailed ? (
               <Image src={authorPhoto} alt={authorName} fill className="object-cover" onError={() => setAuthorPhotoFailed(true)} />
            ) : (
               <img src={defaultAvatarUrl(authorName)} alt={authorName} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <h1 className="text-6xl font-headline italic tracking-tight">{authorName}</h1>
              <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-primary/40">Portrait d'auteur</p>
            </div>
            <p className="text-muted-foreground italic text-lg leading-relaxed line-clamp-4">
               {authorBio || "Exploration de la bibliographie complète en cours..."}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {user && (
                <Button
                  onClick={toggleFollow}
                  disabled={isFollowLoading}
                  variant="outline"
                  className={cn(
                    "rounded-2xl h-12 px-6 italic font-headline transition-all",
                    isFollowing ? "bg-primary text-white border-primary shadow-lg" : "border-primary/20 text-primary/70 bg-white/40 hover:bg-white/60"
                  )}
                >
                  {isFollowLoading ? <Loader2 className="h-4 w-4 mr-3 animate-spin" /> : isFollowing ? <BellRing className="h-4 w-4 mr-3" /> : <Bell className="h-4 w-4 mr-3" />}
                  {isFollowing ? "Auteur suivi" : "Suivre cet auteur"}
                </Button>
              )}
              {adminMode && (
                <Button
                  onClick={() => setShowAuthorEditor(true)}
                  variant="outline"
                  className="rounded-2xl h-12 px-6 italic font-headline border-primary/20 bg-primary/5 text-primary"
                >
                  <Pencil className="h-4 w-4 mr-3" /> Modifier la biographie
                </Button>
              )}
              {adminMode && (
                <Button
                  onClick={() => setShowAddBook(true)}
                  variant="outline"
                  className="rounded-2xl h-12 px-6 italic font-headline border-primary/20 bg-primary/5 text-primary"
                >
                  <Plus className="h-4 w-4 mr-3" /> Ajouter une fiche
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {adminMode && (
        <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
          <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
            <ScrollArea className="max-h-[90vh] p-10">
              <MasterBookEditor
                book={{ isNew: true, author: authorName }}
                onClose={() => setShowAddBook(false)}
                onSaved={(saved) => {
                  setResults((prev) => [{ ...saved, source: "master" }, ...prev]);
                }}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {adminMode && (
        <Dialog open={showAuthorEditor} onOpenChange={setShowAuthorEditor}>
          <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
            <ScrollArea className="max-h-[90vh] p-10">
              <AuthorEditor
                onClose={() => setShowAuthorEditor(false)}
                initialAuthorId={authorSlug}
                initialAuthorName={authorName}
                onSaved={(saved) => {
                  if (saved.bio) setAuthorBio(saved.bio);
                  if (saved.photo) { setAuthorPhoto(saved.photo); setAuthorPhotoFailed(false); }
                }}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {actualites.length > 0 && (
        <div className="space-y-6 max-w-3xl">
          <h2 className="text-2xl font-headline italic flex items-center gap-3">
            <Newspaper className="h-5 w-5 text-primary/50" /> Actualités
          </h2>
          {actualites.map((item) => (
            <div key={item.id} className="glass-card rounded-[2rem] p-8 bg-white/50 border-none shadow-sm flex flex-col sm:flex-row gap-6">
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-xl font-headline italic">{item.title}</h3>
                <p className="text-muted-foreground italic leading-relaxed whitespace-pre-line">{item.content}</p>
              </div>
              {item.cover && (
                <div className="w-full sm:w-36 h-44 sm:h-auto flex-shrink-0 flex items-center justify-center bg-secondary/5 rounded-2xl">
                  <img src={item.cover} alt={item.title} className="max-h-full max-w-full object-contain rounded-xl shadow-md" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-40 text-center space-y-8 flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
          <p className="italic text-primary/40 font-headline text-3xl">Exploration de l'univers de {authorName}...</p>
        </div>
      ) : (
        <div className="space-y-12">
          <h2 className="text-4xl font-headline italic flex items-center gap-4">
            <Sparkles className="h-8 w-8 text-primary/40" /> Bibliographie Complète
          </h2>
          
          <div className="grid gap-10">
            {results.map((book) => {
              const existingBook = isAlreadyInLibrary(book);
              return (
                <Card key={book.id} className="glass-card overflow-hidden border-none group shadow-sm hover:shadow-2xl transition-all duration-700">
                  <CardContent className="p-0 flex flex-col sm:flex-row">
                    <div className="relative w-full sm:w-44 aspect-[2/3] shrink-0 overflow-hidden bg-secondary/5 flex items-center justify-center p-4">
                      {existingBook ? (
                        <Link href={`/book/${existingBook.id}`} className="relative w-full h-full block">
                          <BookCover src={book.cover} alt={book.title} className="object-contain transition-transform duration-700 group-hover:scale-110" />
                        </Link>
                      ) : book.source === 'master' ? (
                        <Link href={`/master-book/${book.id}`} className="relative w-full h-full block">
                          <BookCover src={book.cover} alt={book.title} className="object-contain transition-transform duration-700 group-hover:scale-110" />
                        </Link>
                      ) : (
                        <button onClick={() => setPreviewBook(book)} className="relative w-full h-full block">
                          <BookCover src={book.cover} alt={book.title} className="object-contain transition-transform duration-700 group-hover:scale-110" />
                        </button>
                      )}
                    </div>
                    <div className="p-8 flex flex-col flex-1 justify-between gap-6">
                      <div className="space-y-3">
                        <h3 className="text-2xl font-headline italic leading-tight group-hover:text-primary transition-colors">{book.title}</h3>
                        {book.subtitle && <p className="text-sm text-muted-foreground italic opacity-60">{book.subtitle}</p>}
                        {book.source === 'master' && (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none text-[8px]">
                            Base Lectoria
                          </Badge>
                        )}
                        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-40 pt-2">
                          <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {book.pages} pages</span>
                          <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> {book.publisher || "Éditeur inconnu"}</span>
                        </div>
                      </div>
                      <div className="flex justify-end items-center gap-4">
                        {existingBook ? (
                          <div className="h-14 px-8 rounded-[1.5rem] bg-emerald-50 text-emerald-600 border border-emerald-100 italic font-headline text-lg flex items-center gap-3 shadow-sm">
                            <CheckCircle2 className="h-6 w-6" /> Déjà en bibliothèque
                          </div>
                        ) : (
                          <Button onClick={() => handleOpenAddDialog(book)} className="h-14 px-10 rounded-[1.5rem] bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 font-headline italic text-xl transition-all hover:scale-105">
                            <Plus className="h-6 w-6 mr-3" /> Ajouter
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!previewBook} onOpenChange={(open) => !open && setPreviewBook(null)}>
        <DialogContent className="glass-card border-none max-w-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
          <ScrollArea className="max-h-[90vh] p-10">
            {previewBook && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row gap-8">
                  <div className="relative w-40 aspect-[2/3] rounded-2xl overflow-hidden shadow-lg mx-auto sm:mx-0 shrink-0 bg-secondary/5">
                    <BookCover src={previewBook.cover} alt={previewBook.title} className="object-cover" />
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <h2 className="text-3xl font-headline italic leading-tight">{previewBook.title}</h2>
                    <p className="text-sm text-muted-foreground font-bold uppercase">{previewBook.author || authorName}</p>
                    {previewBook.publisher && <p className="text-xs text-primary/50 italic">{previewBook.publisher}</p>}
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-primary/5 space-y-2">
                  <h3 className="font-headline italic opacity-50">Résumé</h3>
                  <p className="text-sm italic text-muted-foreground leading-relaxed whitespace-pre-line">
                    {cleanDescriptionHtml(previewBook.description) || "Pas encore de résumé pour cette pépite."}
                  </p>
                </div>
                <Button
                  onClick={() => { handleOpenAddDialog(previewBook); setPreviewBook(null); }}
                  className="w-full h-14 rounded-2xl bg-primary italic font-headline text-lg"
                >
                  <Plus className="mr-2 h-5 w-5" /> Ajouter à ma bibliothèque
                </Button>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* FIXED AND SCROLLABLE MODAL FOR ADDING BOOKS */}
      <Dialog open={!!pendingBook} onOpenChange={() => setPendingBook(null)}>
        <DialogContent className="glass-card border-none max-w-xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-10 border-b border-primary/5 bg-white/40 shrink-0">
            <DialogTitle className="font-headline text-4xl italic">Ajouter la pépite</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto min-h-0">
            <div className="p-10 space-y-10">
              <div className="flex gap-8 items-start">
                 <div className="relative h-44 w-32 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/60">
                    <BookCover src={pendingBook?.cover} alt={pendingBook?.title || ""} className="object-cover" />
                 </div>
                 <div className="space-y-3 flex-1">
                   <h3 className="font-headline italic text-3xl leading-tight">{pendingBook?.title}</h3>
                   <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{pendingBook?.author}</p>
                   <div className="pt-2 flex flex-wrap gap-2">
                     <Badge className="bg-primary/5 text-primary border-none text-[10px] uppercase font-bold tracking-widest">{pendingBook?.publisher}</Badge>
                     <Badge variant="outline" className="border-primary/20 text-primary/60 italic text-[10px]">{pendingBook?.language || "Français"}</Badge>
                   </div>
                 </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Quelle est votre intention ?</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUSES).map(([key, val]) => (
                      <Button 
                        key={key} 
                        variant="outline" 
                        onClick={() => setSelectedStatus(key as BookStatus)}
                        className={cn(
                          "rounded-full border-primary/10 text-[10px] h-11 px-5 uppercase font-bold tracking-widest transition-all", 
                          selectedStatus === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/60 hover:bg-white"
                        )}
                      >
                        {val.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Format de la pépite</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(FORMATS).map(([key, val]) => {
                      const Icon = val.icon;
                      return (
                        <Button 
                          key={key} 
                          variant="outline" 
                          onClick={() => setSelectedFormat(key as BookFormat)}
                          className={cn(
                            "rounded-2xl border-primary/10 h-14 flex items-center gap-3 transition-all", 
                            selectedFormat === key ? "bg-primary text-white border-primary shadow-lg" : "bg-white/60 hover:bg-white"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-headline italic text-lg">{val.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-primary/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-headline italic text-xl">Ajouter aux Coups de Cœur</p>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">L'écrin de vos favoris absolus</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsDePlume(!isDePlume)}
                    className={cn("rounded-full h-14 w-14 transition-all", isDePlume ? "text-primary bg-primary/10 shadow-inner" : "text-muted-foreground/20")}
                  >
                    <Heart className={cn("h-8 w-8", isDePlume && "fill-primary")} />
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-10 border-t border-primary/5 bg-white/60 shrink-0">
            <div className="flex w-full justify-end gap-4 sm:gap-6">
              <Button variant="ghost" onClick={() => setPendingBook(null)} className="rounded-2xl h-14 px-6 sm:px-8 italic font-headline text-xl">Annuler</Button>
              <Button 
                onClick={confirmAdd} 
                disabled={isAdding}
                className="rounded-[2rem] bg-primary hover:bg-primary/90 font-headline italic text-xl sm:text-2xl px-10 sm:px-14 h-16 shadow-2xl shadow-primary/20 transition-transform active:scale-95 flex-1 sm:flex-none"
              >
                {isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : "Enregistrer ce livre"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
