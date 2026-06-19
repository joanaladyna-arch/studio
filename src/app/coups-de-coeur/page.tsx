
"use client";

import { useMemo, useState, useEffect } from "react";
import { RANKS, RankType } from "@/app/library/page";
import { Diamond, Sparkles, Heart, Pencil, Loader2, User as UserIcon, BookHeart, Gift, Sun, X } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MasterBookEditor } from "@/components/master-book-editor";
import { useCollection, useUser, useFirestore } from "@/firebase";
import { useAdminMode } from "@/components/admin-mode";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { cn, ADMIN_EMAILS, authorKey, sortBySaga } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import Link from "next/link";

export default function CoupsDeCoeurPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { adminMode } = useAdminMode();
  const isAdmin = adminMode;
  const [editingMasterBook, setEditingMasterBook] = useState<any | null>(null);
  const [isLoadingEditBook, setIsLoadingEditBook] = useState(false);
  const [activeView, setActiveView] = useState<"lectures" | "auteurs">("lectures");
  const [followedAuthors, setFollowedAuthors] = useState<{ slug: string; name: string; photo: string | null }[] | null>(null);
  const [allAuthors, setAllAuthors] = useState<{ slug: string; name: string; photo: string | null }[] | null>(null);

  // Auteurs suivis par la lectrice (champ followedAuthors sur son propre
  // profil), enrichis de leur nom affiché et de leur photo si elle a été
  // renseignée via la fiche auteur (mode admin). Échoue toujours
  // silencieusement : l'absence de photo n'empêche jamais d'afficher la
  // carte de l'auteur (juste avec une icône par défaut à la place).
  useEffect(() => {
    if (!db || !user || activeView !== "auteurs" || isAdmin || followedAuthors !== null) return;
    (async () => {
      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const slugs: string[] = profileSnap.data()?.followedAuthors || [];
        if (slugs.length === 0) { setFollowedAuthors([]); return; }
        const authorsSnap = await getDocs(collection(db, "authors"));
        const bySlug: Record<string, any> = {};
        authorsSnap.docs.forEach((d) => { bySlug[d.id] = d.data(); });

        // Filet de sécurité : si la fiche authors/{slug} n'existe pas
        // encore (jamais synchronisée ni éditée), on retrouve un nom
        // lisible en cherchant un livre du catalogue partagé dont
        // l'auteur correspond à ce même slug, plutôt que d'afficher le
        // slug technique brut (ex. "kent-rina") à la lectrice.
        const missingSlugs = slugs.filter((s) => !bySlug[s]?.name);
        let fallbackNames: Record<string, string> = {};
        if (missingSlugs.length > 0) {
          const booksSnap = await getDocs(collection(db, "masterBooks"));
          booksSnap.docs.forEach((d) => {
            const author = (d.data() as any)?.author;
            if (!author) return;
            const key = authorKey(author);
            if (missingSlugs.includes(key) && !fallbackNames[key]) fallbackNames[key] = author;
          });
        }

        const list = slugs.map((slug) => ({
          slug,
          name: bySlug[slug]?.name || fallbackNames[slug] || slug,
          photo: bySlug[slug]?.photo || null,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setFollowedAuthors(list);
      } catch (err) {
        console.error("Load Followed Authors Error:", err);
        setFollowedAuthors([]);
      }
    })();
  }, [db, user, activeView, isAdmin, followedAuthors]);

  // Mode admin : "Auteurs coup de cœur" devient la base complète de
  // tous les auteurs (et non plus seulement ceux suivis par la
  // lectrice) — pratique pour parcourir/gérer rapidement n'importe
  // quel auteur. On combine la collection authors (fiches déjà créées,
  // avec photo) et les auteurs présents dans le catalogue partagé mais
  // n'ayant pas encore de fiche dédiée, pour une liste vraiment
  // exhaustive. Le clic sur un auteur mène à la même page /author/[name]
  // qu'en usage normal, avec les mêmes outils d'édition déjà en place.
  useEffect(() => {
    if (!db || !isAdmin || activeView !== "auteurs" || allAuthors !== null) return;
    (async () => {
      try {
        const authorsSnap = await getDocs(collection(db, "authors"));
        const bySlug: Record<string, any> = {};
        authorsSnap.docs.forEach((d) => { bySlug[d.id] = d.data(); });

        const booksSnap = await getDocs(collection(db, "masterBooks"));
        const discovered: Record<string, string> = {};
        booksSnap.docs.forEach((d) => {
          const author = (d.data() as any)?.author;
          if (!author) return;
          const key = authorKey(author);
          if (!discovered[key]) discovered[key] = author;
        });

        const allSlugs = new Set([...Object.keys(bySlug), ...Object.keys(discovered)]);
        const list = Array.from(allSlugs).map((slug) => ({
          slug,
          name: bySlug[slug]?.name || discovered[slug] || slug,
          photo: bySlug[slug]?.photo || null,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setAllAuthors(list);
      } catch (err) {
        console.error("Load All Authors Error:", err);
        setAllAuthors([]);
      }
    })();
  }, [db, isAdmin, activeView, allAuthors]);

  const openMasterEditor = async (masterBookId?: string) => {
    if (!db || !masterBookId) return;
    setIsLoadingEditBook(true);
    try {
      const snap = await getDoc(doc(db, "masterBooks", masterBookId));
      if (snap.exists()) setEditingMasterBook({ id: snap.id, ...snap.data() });
      else toast({ variant: "destructive", title: "Fiche introuvable dans la base partagée" });
    } catch (err) {
      console.error("Load MasterBook Error:", err);
      toast({ variant: "destructive", title: "Erreur de chargement" });
    } finally {
      setIsLoadingEditBook(false);
    }
  };

  // On récupère les livres de TOUTES les Palmes attribuées (pas
  // seulement Diamant/Royale), pour les afficher façon pile en éventail
  // — comme "Mon étagère PAL" — avec un écrin spécial réservé aux deux
  // rangs les plus prestigieux. "À offrir" et "Relecture d'été" peuvent
  // aussi concerner des livres SANS Palme (ajout manuel) — un seul
  // écouteur sur toute la bibliothèque suffit pour tout calculer,
  // plutôt que de faire tourner deux écouteurs Firestore simultanés
  // sur la même collection.
  const allBooksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);
  const { data: allUserBooks = [], loading } = useCollection(allBooksQuery);

  const rankedBooks = useMemo(() => allUserBooks.filter((b: any) => b.plumeRank && Object.keys(RANKS).includes(b.plumeRank)), [allUserBooks]);

  const giftBooks = useMemo(() => sortBySaga(allUserBooks.filter((b: any) => b.toGift) as any[]), [allUserBooks]);

  // Diamant/Royale par défaut, sauf override explicite à false ; un
  // override explicite à true ajoute un livre qui n'a pas cette Palme.
  const summerRereadBooks = useMemo(() => {
    return sortBySaga(allUserBooks.filter((b: any) => {
      if (b.summerReread === true) return true;
      if (b.summerReread === false) return false;
      return b.plumeRank === "diamant" || b.plumeRank === "royale";
    }) as any[]);
  }, [allUserBooks]);

  const removeFromSummerReread = async (bookId: string) => {
    if (!db || !user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "books", bookId), { summerReread: false });
    } catch (err) {
      console.error("Remove From Summer Reread Error:", err);
    }
  };

  const booksByRank = useMemo(() => {
    const map: Record<string, any[]> = {};
    (rankedBooks || []).forEach((b: any) => {
      if (!b.plumeRank) return;
      if (!map[b.plumeRank]) map[b.plumeRank] = [];
      map[b.plumeRank].push(b);
    });
    Object.keys(map).forEach((rank) => { map[rank] = sortBySaga(map[rank]); });
    return map;
  }, [rankedBooks]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <header className="text-center space-y-4 py-12">
        <div className="flex justify-center gap-3 mb-2">
          <Heart className="h-8 w-8 text-primary/40 animate-pulse" />
        </div>
        <h1 className="text-6xl font-headline tracking-tight">Coups de Cœur</h1>
        <p className="text-primary/60 max-w-md mx-auto italic text-lg font-medium">
          L'écrin de vos lectures, classées selon la Palme que vous leur avez attribuée.
        </p>
      </header>

      <div className="flex justify-center gap-3">
        <button
          onClick={() => setActiveView("lectures")}
          className={cn(
            "h-12 px-6 rounded-2xl italic font-headline text-sm transition-all flex items-center gap-2",
            activeView === "lectures" ? "bg-primary text-white shadow-lg" : "bg-white/40 text-primary/60 hover:bg-white/60"
          )}
        >
          <Heart className="h-4 w-4" /> Lectures classées
        </button>
        <button
          onClick={() => setActiveView("auteurs")}
          className={cn(
            "h-12 px-6 rounded-2xl italic font-headline text-sm transition-all flex items-center gap-2",
            activeView === "auteurs" ? "bg-primary text-white shadow-lg" : "bg-white/40 text-primary/60 hover:bg-white/60"
          )}
        >
          <BookHeart className="h-4 w-4" /> {isAdmin ? "Tous les Auteurs (admin)" : "Auteurs coup de cœur"}
        </button>
      </div>

      {activeView === "auteurs" && (
        <div className="max-w-4xl mx-auto px-4 pb-12">
          {(isAdmin ? allAuthors : followedAuthors) === null ? (
            <div className="py-24 text-center italic text-muted-foreground">Ouverture de l'écrin...</div>
          ) : (isAdmin ? allAuthors : followedAuthors)!.length === 0 ? (
            <div className="py-24 text-center space-y-6">
              <BookHeart className="h-16 w-16 mx-auto text-primary/10" />
              <p className="text-muted-foreground italic text-lg">
                {isAdmin ? (
                  <>Aucun auteur dans la base pour le moment.</>
                ) : (
                  <>Tu ne suis encore aucun auteur.<br />Va sur la fiche d'un auteur que tu aimes et clique sur "Suivre cet auteur" pour le retrouver ici.</>
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {(isAdmin ? allAuthors! : followedAuthors!).map((author) => (
                <Link
                  key={author.slug}
                  href={`/author/${encodeURIComponent(author.name)}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <div className="relative h-28 w-28 rounded-full overflow-hidden shadow-lg ring-4 ring-white bg-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    {author.photo ? (
                      <Image src={author.photo} alt={author.name} fill className="object-cover" />
                    ) : (
                      <UserIcon className="h-10 w-10 text-primary/20" />
                    )}
                    {!isAdmin && (
                      <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary shadow-md flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <p className="font-headline italic text-sm leading-tight">{author.name}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === "lectures" && (
      <>
      {loading ? (
        <div className="py-24 text-center italic text-muted-foreground">Ouverture de l'écrin...</div>
      ) : Object.keys(booksByRank).length > 0 ? (
        <div className="space-y-12 max-w-5xl mx-auto px-4">
          {(Object.keys(RANKS) as RankType[]).map((rankKey) => {
            const books = booksByRank[rankKey];
            if (!books || books.length === 0) return null;
            const rank = RANKS[rankKey];
            const RankIcon = rank.icon;
            const isPrestige = rankKey === "diamant" || rankKey === "royale";

            const header = (
              <div className="flex items-center gap-3 px-2">
                <RankIcon className={cn("h-6 w-6", rank.color)} />
                <h2 className="text-2xl font-headline italic">{rank.label}</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                  {books.length} livre{books.length > 1 ? "s" : ""}
                </span>
              </div>
            );

            const pile = (
              <div className="flex items-end overflow-x-auto pb-6 pt-6 px-4 -mx-2">
                {books.slice(0, 14).map((book: any, i: number) => (
                  <div key={book.id} className="relative shrink-0">
                    <Link
                      href={`/book/${book.id}`}
                      className="relative block w-20 aspect-[2/3] rounded-xl overflow-hidden border-2 border-white shadow-lg first:ml-0 -ml-7 hover:z-20 hover:-translate-y-3 transition-transform duration-300 bg-secondary/5"
                      style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`, zIndex: i }}
                    >
                      <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMasterEditor(book.masterBookId); }}
                        className="absolute -bottom-1 -right-1 z-30 h-6 w-6 rounded-full bg-white shadow-md flex items-center justify-center text-primary hover:scale-110 transition-transform"
                        title="Éditer la fiche (admin)"
                      >
                        {isLoadingEditBook ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                ))}
                {books.length > 14 && (
                  <div className="relative shrink-0 w-20 aspect-[2/3] rounded-xl border-2 border-dashed border-primary/20 bg-white/40 flex items-center justify-center -ml-7 text-primary/60 font-bold text-sm italic">
                    +{books.length - 14}
                  </div>
                )}
              </div>
            );

            if (isPrestige) {
              return (
                <div
                  key={rankKey}
                  className={cn(
                    "p-8 rounded-[2.5rem] border-2 shadow-lg relative overflow-hidden",
                    rankKey === "diamant"
                      ? "bg-gradient-to-br from-cyan-50 via-white to-white border-cyan-200/60"
                      : "bg-gradient-to-br from-amber-50 via-white to-white border-amber-200/60"
                  )}
                >
                  <Sparkles className={cn("absolute top-6 right-6 h-6 w-6 opacity-30", rank.color)} />
                  <div className="space-y-2">
                    {header}
                    {pile}
                  </div>
                </div>
              );
            }

            return (
              <div key={rankKey} className="space-y-2">
                {header}
                {pile}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center space-y-6">
          <Sparkles className="h-16 w-16 mx-auto text-primary/10" />
          <p className="text-muted-foreground italic text-lg">
            Vos Coups de Cœur attendent vos premières lectures.<br />
            Attribuez une Palme à vos livres pour les voir apparaître ici.
          </p>
        </div>
      )}

      {summerRereadBooks.length > 0 && (
        <section className="space-y-6 max-w-5xl mx-auto px-4 pt-12">
          <div className="flex items-center gap-3 px-2">
            <Sun className="h-7 w-7 text-amber-400" />
            <div>
              <h2 className="text-3xl font-headline italic">Relecture d'été</h2>
              <p className="text-sm italic opacity-50">Je t'accompagne même en vacances.</p>
            </div>
          </div>
          <div className="flex items-end overflow-x-auto pb-6 pt-6 px-4 -mx-2">
            {summerRereadBooks.slice(0, 14).map((book: any, i: number) => (
              <div key={book.id} className="relative shrink-0">
                <Link
                  href={`/book/${book.id}`}
                  className="relative block w-20 aspect-[2/3] rounded-xl overflow-hidden border-2 border-white shadow-lg first:ml-0 -ml-7 hover:z-20 hover:-translate-y-3 transition-transform duration-300 bg-secondary/5"
                  style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`, zIndex: i }}
                >
                  <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFromSummerReread(book.id); }}
                  className="absolute -top-1 -right-1 z-30 h-6 w-6 rounded-full bg-white shadow-md flex items-center justify-center text-primary/50 hover:text-red-500 hover:scale-110 transition-all"
                  title="Retirer de Relecture d'été"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {giftBooks.length > 0 && (
        <section className="space-y-6 max-w-5xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 px-2">
            <Gift className="h-7 w-7 text-rose-400" />
            <h2 className="text-3xl font-headline italic">À offrir</h2>
          </div>
          <div className="flex items-end overflow-x-auto pb-6 pt-6 px-4 -mx-2">
            {giftBooks.slice(0, 14).map((book: any, i: number) => (
              <Link
                key={book.id}
                href={`/book/${book.id}`}
                className="relative shrink-0 block w-20 aspect-[2/3] rounded-xl overflow-hidden border-2 border-white shadow-lg first:ml-0 -ml-7 hover:z-20 hover:-translate-y-3 transition-transform duration-300 bg-secondary/5"
                style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + (i % 3))}deg)`, zIndex: i }}
              >
                <BookCover src={book.cover} alt={book.title || ""} className="object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="pt-20 border-t border-primary/10">
        <h2 className="text-3xl font-headline mb-10 text-center">Les Grades de Prestige</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-sm hover:bg-white/60 transition-colors">
            <h3 className="font-headline text-2xl flex items-center gap-3 text-cyan-500 mb-2">
                <Sparkles className="h-5 w-5" /> Palme Éternelle
            </h3>
            <p className="text-sm text-muted-foreground italic leading-relaxed">Le coup de cœur absolu. Un livre qui a laissé une empreinte indélébile sur votre âme.</p>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-sm hover:bg-white/60 transition-colors">
            <h3 className="font-headline text-2xl flex items-center gap-3 text-amber-500 mb-2">
                <Diamond className="h-5 w-5" /> Palme de Diamant
            </h3>
            <p className="text-sm text-muted-foreground italic leading-relaxed">Une lecture exceptionnelle, portée par une écriture magistrale de bout en bout.</p>
          </div>
        </div>
      </section>
      </>
      )}

      {isAdmin && (
        <Dialog open={!!editingMasterBook} onOpenChange={(open) => !open && setEditingMasterBook(null)}>
          <DialogContent className="glass-card border-none max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl max-h-[90vh]">
            <ScrollArea className="max-h-[90vh] p-10">
              {editingMasterBook && (
                <MasterBookEditor
                  book={editingMasterBook}
                  onClose={() => setEditingMasterBook(null)}
                  onSaved={() => setEditingMasterBook(null)}
                />
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
