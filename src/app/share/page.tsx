
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Check, BookOpen } from "lucide-react";
import { siInstagram, siTiktok, siTwitch, siSnapchat, siFacebook } from "simple-icons";
import { toPng } from "html-to-image";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import Link from "next/link";
import { RANKS, EMOTIONS, Book, BookCard } from "@/app/library/page";
import { cn, toArray } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, query, where, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * Un seul gabarit de carte, aligné sur l'identité Lectoria (nuit / crème
 * / rose signature / cuivre) plutôt qu'un thème pastel différent par
 * genre — l'ancien thème "Romance Douce" (fond rose clair) est ce qui
 * rendait l'export très "girly" indépendamment du livre partagé. Le
 * fil vertical rose en haut à droite est la signature visuelle commune
 * à toute l'app (cf. mockup validé).
 */
const CARD_THEME = {
  gradient: "linear-gradient(165deg, #1B2430 0%, #2A3644 60%, #B08457 140%)",
  text: "#F5F1E8",
  accent: "#D98BA0",
  copper: "#B08457",
  badge: "rgba(245,241,232,0.12)",
};


export default function SharePage() {
  const { user } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Présélectionne le livre passé en paramètre (ex: bouton "Exporter vers
  // les réseaux" depuis la fiche d'un livre) dès qu'il devient disponible.
  useEffect(() => {
    const bookParam = searchParams.get("book");
    if (bookParam) setSelectedBookId(bookParam);
  }, [searchParams]);

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "books"),
      where("status", "in", ["read", "progress"])
    );
  }, [db, user]);

  const { data: books = [], loading } = useCollection(booksQuery);

  const selectedBook = useMemo(() => {
    if (selectedBookId) return books.find(b => b.id === selectedBookId) || books[0];
    return books[0];
  }, [books, selectedBookId]);

  const rank = selectedBook?.plumeRank ? RANKS[selectedBook.plumeRank as keyof typeof RANKS] : null;

  // Quand le livre de l'utilisatrice n'a pas d'URL de couverture (cas
  // fréquent des livres issus de BnF qui ne fournit pas d'image), on
  // tente de récupérer la couverture depuis la fiche partagée
  // masterBooks — qui aura été enrichie par l'admin ou par un ajout
  // ultérieur depuis une source qui avait l'image.
  const [masterCoverUrl, setMasterCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!db || !selectedBook) { setMasterCoverUrl(null); return; }
    if (selectedBook.cover) { setMasterCoverUrl(null); return; } // user cover a priorité
    const masterBookId = (selectedBook as any).masterBookId;
    if (!masterBookId) { setMasterCoverUrl(null); return; }
    getDoc(doc(db, "masterBooks", masterBookId))
      .then((snap) => { if (snap.exists()) setMasterCoverUrl(snap.data()?.cover || null); })
      .catch(() => setMasterCoverUrl(null));
  }, [db, selectedBook]);

  const effectiveCoverUrl = (selectedBook as any)?.cover || masterCoverUrl || "";

  // Filet de sécurité "zéro couverture manquante" — même principe que sur
  // la fiche livre : si ni l'exemplaire personnel ni la fiche partagée
  // n'ont de couverture, on tente Google Books en direct avant d'afficher
  // "Couverture indisponible" sur la carte.
  const [liveCoverUrl, setLiveCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedBook) { setLiveCoverUrl(null); return; }
    if ((selectedBook as any)?.cover || masterCoverUrl) { setLiveCoverUrl(null); return; }
    let cancelled = false;
    const query = `${selectedBook.title || ""} ${selectedBook.author || ""}`.trim();
    if (!query) return;
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const thumb = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail?.replace("http://", "https://");
        if (thumb) setLiveCoverUrl(thumb);
      })
      .catch(() => { if (!cancelled) setLiveCoverUrl(null); });
    return () => { cancelled = true; };
  }, [selectedBook, masterCoverUrl]);

  const finalCoverUrl = effectiveCoverUrl || liveCoverUrl || "";

  // Tronque l'avis de lecture pour qu'il tienne dans la carte de
  // partage sans la faire exploser — 180 caractères est un bon
  // compromis entre lisibilité sur story (petit texte) et densité
  // d'information. On coupe proprement au mot, jamais au milieu.
  const truncateReview = (text: string, max = 100) => {
    if (!text || text.length <= max) return text;
    const cut = text.slice(0, max).lastIndexOf(" ");
    return text.slice(0, cut > 0 ? cut : max) + "…";
  };

  // La couverture affichée sur la carte ET capturée à l'export passe
  // systématiquement par ce relais (data URI interne), jamais
  // directement par l'URL externe — voir /api/proxy-image pour le
  // détail du problème que ça résout (capture impossible sinon). On ne
  // considère la couverture "prête" qu'une fois qu'elle a réellement
  // fini de se décoder dans le navigateur (pas seulement reçue) — sans
  // ça, une image récupérée mais corrompue ou non décodable produisait
  // un export silencieusement vide, sans aucune indication du problème.
  const [coverDataUri, setCoverDataUri] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverRetryCount, setCoverRetryCount] = useState(0);
  useEffect(() => {
    if (!finalCoverUrl) { setCoverDataUri(null); setCoverError(null); return; }
    let cancelled = false;
    setCoverLoading(true);
    setCoverDataUri(null);
    setCoverError(null);
    (async () => {
      try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(finalCoverUrl)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error || !data.dataUri) {
          console.error("Proxy Cover Error:", data.error);
          setCoverError(data.error || "Couverture indisponible");
          setCoverLoading(false);
          return;
        }
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          setCoverDataUri(data.dataUri);
          setCoverLoading(false);
        };
        img.onerror = () => {
          if (cancelled) return;
          console.error("Cover Decode Error: image reçue mais non décodable");
          setCoverError("Image reçue mais illisible");
          setCoverLoading(false);
        };
        img.src = data.dataUri;
      } catch (err) {
        console.error("Proxy Cover Fetch Error:", err);
        if (!cancelled) { setCoverError("Erreur réseau"); setCoverLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [finalCoverUrl, coverRetryCount]);

  const theme = CARD_THEME;

  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const { toast } = useToast();

  // Génère réellement le fichier image à partir de la carte affichée à
  // l'écran (et non un gabarit séparé), pour que ce que la lectrice voit
  // soit exactement ce qu'elle obtient. Le délai court avant capture
  // laisse le temps aux polices/images de finir de se charger.
  const captureCard = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    await new Promise((r) => setTimeout(r, 150));
    return toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
  };

  const fileName = () => `lectoria-${(selectedBook?.title || "partage").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportDone(false);
    try {
      const dataUrl = await captureCard();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = fileName();
      link.href = dataUrl;
      link.click();
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch (err) {
      console.error("Export Share Card Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Ouvre la fenêtre de partage native du téléphone (qui propose
  // Instagram, TikTok, Messages...) avec l'image déjà générée jointe.
  // Si le navigateur ne sait pas partager de fichier (essentiellement
  // sur ordinateur), on retombe sur un simple téléchargement avec une
  // explication claire plutôt qu'un bouton qui ne fait rien.
  const handleShareToSocial = async (platform: string) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await captureCard();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName(), { type: "image/png" });

      if (typeof navigator !== "undefined" && (navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          files: [file],
          title: selectedBook?.title || "Lectoria",
          text: selectedBook ? `${selectedBook.title} — sur Lectoria` : "Lectoria",
        });
      } else {
        const link = document.createElement("a");
        link.download = fileName();
        link.href = dataUrl;
        link.click();
        toast({ title: "Image enregistrée", description: `Ouvre ${platform} et ajoute l'image manuellement à ta story.` });
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Share To Social Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header>
        <h1 className="text-4xl font-headline italic">Partage BookTok</h1>
        <p className="text-muted-foreground italic">Générez une fiche élégante pour vos réseaux sociaux.</p>
      </header>

      {loading ? (
        <div className="py-20 text-center italic text-muted-foreground">Préparation de vos lectures...</div>
      ) : books.length > 0 ? (
        <div className="grid md:grid-cols-[1fr_350px] gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-headline italic">Choisir un livre</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {books.map((book) => (
                <button 
                  key={book.id} 
                  onClick={() => setSelectedBookId(book.id)}
                  className={cn(
                    "relative aspect-[2/3] rounded-2xl overflow-hidden border-4 transition-all duration-500 shadow-sm",
                    selectedBook?.id === book.id ? "border-primary scale-95 shadow-xl" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <BookCover src={book.cover} alt={book.title} className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div
              ref={cardRef}
              className="relative w-full aspect-[9/16] rounded-[3rem] overflow-hidden shadow-2xl border border-white/40 flex flex-col items-center p-8 text-center animate-paper"
              style={{ background: theme.gradient, color: theme.text }}
            >
              <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
              <div className="absolute top-0 right-12 w-1.5 h-11 rounded-b-sm" style={{ background: theme.accent }} />
              
              <div className="relative z-10 space-y-3 w-full flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: theme.accent }}>Mon Carnet Lectoria</div>
                
                {selectedBook && (
                  <>
                    <div className="relative w-32 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white rotate-1">
                      {coverDataUri ? (
                        <img src={coverDataUri} alt={selectedBook.title} className="w-full h-full object-cover" />
                      ) : coverLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/15 to-primary/5">
                          <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                        </div>
                      ) : coverError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-secondary/15 to-primary/5 p-3 text-center">
                          <BookOpen className="h-8 w-8 opacity-30" />
                          <p className="text-[9px] italic opacity-50 leading-tight">Couverture indisponible</p>
                        </div>
                      ) : (
                        <BookCover src={finalCoverUrl} alt={selectedBook.title} className="object-cover" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-xl font-headline italic leading-tight">{selectedBook.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-70">{selectedBook.author}</p>
                    </div>

                    {rank && (
                      <div className="flex flex-col items-center gap-0.5 py-1">
                        <rank.icon className="h-6 w-6" style={{ color: theme.accent }} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">{rank.label}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-1.5">
                      {toArray<string>(selectedBook.emotions).map(e => (
                        <span
                          key={e}
                          className="text-[9px] px-2 py-1 rounded-full border shadow-sm font-bold flex items-center gap-1"
                          style={{ backgroundColor: theme.badge, borderColor: theme.badge }}
                        >
                          {EMOTIONS[e]?.icon} {EMOTIONS[e]?.label}
                        </span>
                      ))}
                    </div>

                    {(selectedBook as any).review ? (
                      <div className="pt-2 border-t w-full space-y-1.5" style={{ borderColor: theme.badge }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: theme.accent }}>Mon Avis</p>
                        <p className="text-[10px] italic leading-snug opacity-80 px-2 text-left">
                          {truncateReview((selectedBook as any).review)}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                          Lire l'avis complet sur Lectoria →
                        </p>
                      </div>
                    ) : selectedBook.favoriteQuote ? (
                      <div className="pt-3 border-t w-full" style={{ borderColor: theme.badge }}>
                        <p className="text-xs italic leading-snug opacity-70 px-4">
                          "{selectedBook.favoriteQuote}"
                        </p>
                      </div>
                    ) : (selectedBook as any).description ? (
                      // Repli résumé : sans ça, un livre sans avis ni citation
                      // personnelle produisait une carte quasi vide de texte —
                      // c'est ce qui donnait l'impression que "le résumé ne
                      // s'affiche pas" lors de l'export.
                      <div className="pt-2 border-t w-full space-y-1.5" style={{ borderColor: theme.badge }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: theme.accent }}>Résumé</p>
                        <p className="text-[10px] italic leading-snug opacity-80 px-2 text-left">
                          {truncateReview((selectedBook as any).description)}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                          Lire la fiche complète sur Lectoria →
                        </p>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="pt-1 text-[9px] font-headline italic tracking-widest opacity-30">@Lectoria</div>
              </div>
            </div>

            {coverError && (
              <p className="text-center text-[11px] italic text-amber-600 -mt-1">
                Couverture indisponible pour ce livre ({coverError}). L'export se fera sans, sauf si tu{" "}
                <button onClick={() => setCoverRetryCount((n) => n + 1)} className="underline">réessaies</button>.
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                {[
                  { name: "Instagram", icon: siInstagram, bg: "linear-gradient(45deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)" },
                  { name: "TikTok", icon: siTiktok, bg: `#${siTiktok.hex}` },
                  { name: "Twitch", icon: siTwitch, bg: `#${siTwitch.hex}` },
                  { name: "Snapchat", icon: siSnapchat, bg: `#${siSnapchat.hex}` },
                  { name: "Facebook", icon: siFacebook, bg: `#${siFacebook.hex}` },
                ].map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleShareToSocial(p.name)}
                    disabled={isExporting || !selectedBook || coverLoading}
                    title={`Partager sur ${p.name}`}
                    className="h-10 w-10 rounded-full shadow-md flex items-center justify-center shrink-0 transition-transform hover:scale-110 disabled:opacity-40 disabled:hover:scale-100"
                    style={{ background: p.bg }}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d={p.icon.path} /></svg>
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || !selectedBook || coverLoading}
                className="w-full rounded-2xl border-primary/20 text-primary h-12"
              >
                {isExporting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération...</>
                ) : exportDone ? (
                  <><Check className="mr-2 h-4 w-4" /> Image enregistrée !</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" /> Enregistrer</>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-32 text-center space-y-4 glass-card p-12">
          <p className="text-muted-foreground italic text-lg">Vous n'avez pas encore de livres lus ou en cours pour créer une fiche.</p>
          <Button asChild variant="link" className="text-primary">
            <Link href="/library">Accéder à ma bibliothèque</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
