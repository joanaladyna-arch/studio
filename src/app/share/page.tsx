
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Check, BookOpen } from "lucide-react";
import { siInstagram, siTiktok } from "simple-icons";
import { toPng } from "html-to-image";
import Image from "next/image";
import { BookCover } from "@/components/book-cover";
import Link from "next/link";
import { RANKS, EMOTIONS, Book, BookCard } from "@/app/library/page";
import { cn, toArray } from "@/lib/utils";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * Ambiances de couleur pour la carte de partage, choisies pour rester
 * "jolies et soignées" tout en se démarquant visuellement selon le ton
 * du livre — une carte Dark Romance ne doit pas ressembler à une carte
 * Romance Contemporaine. Couleurs en valeurs explicites (pas de
 * variables CSS du thème) pour un rendu fiable lors de l'export en
 * image. `genres` sert à la suggestion automatique ; la lectrice garde
 * toujours la main pour changer manuellement via les pastilles.
 */
const SHARE_THEMES: Record<string, { label: string; genres: string[]; gradient: string; text: string; accent: string; badge: string; swatch: string }> = {
  dark_romance: {
    label: "Dark Romance",
    genres: ["Dark romance"],
    gradient: "linear-gradient(150deg, #160c10 0%, #2d0f1a 55%, #160c10 100%)",
    text: "#f5e6e8",
    accent: "#d65d83",
    badge: "rgba(245,230,232,0.12)",
    swatch: "#2d0f1a",
  },
  thriller: {
    label: "Thriller & Suspense",
    genres: ["Thriller", "Suspense", "Policier", "Mystère"],
    gradient: "linear-gradient(150deg, #0c121f 0%, #1c2740 55%, #0c121f 100%)",
    text: "#e8edf5",
    accent: "#7da3d6",
    badge: "rgba(232,237,245,0.12)",
    swatch: "#1c2740",
  },
  fantasy: {
    label: "Fantasy & Romantasy",
    genres: ["Fantasy", "Romantasy"],
    gradient: "linear-gradient(150deg, #170f28 0%, #2e1f4d 55%, #170f28 100%)",
    text: "#f0e8fa",
    accent: "#c2a15b",
    badge: "rgba(240,232,250,0.12)",
    swatch: "#2e1f4d",
  },
  romance: {
    label: "Romance Douce",
    genres: ["Romance contemporaine", "New romance", "New adult", "Young adult"],
    gradient: "linear-gradient(150deg, #fdf2f5 0%, #fbe4ea 55%, #fdf2f5 100%)",
    text: "#4a2c35",
    accent: "#d68fa3",
    badge: "rgba(74,44,53,0.07)",
    swatch: "#fbe4ea",
  },
  default: {
    label: "Lectoria",
    genres: [],
    gradient: "linear-gradient(150deg, #fdf8f5 0%, #f7e7ce 55%, #fdf8f5 100%)",
    text: "#2b2b2b",
    accent: "#d68fa3",
    badge: "rgba(43,43,43,0.06)",
    swatch: "#f7e7ce",
  },
};

const THEME_ORDER = ["dark_romance", "thriller", "fantasy", "romance", "default"];

function detectTheme(genres: string[]): string {
  for (const key of THEME_ORDER) {
    if (key === "default") continue;
    if (SHARE_THEMES[key].genres.some((g) => genres.includes(g))) return key;
  }
  return "default";
}


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
    if (!selectedBook?.cover) { setCoverDataUri(null); setCoverError(null); return; }
    let cancelled = false;
    setCoverLoading(true);
    setCoverDataUri(null);
    setCoverError(null);
    (async () => {
      try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(selectedBook.cover)}`);
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
  }, [selectedBook?.cover, coverRetryCount]);

  // Ambiance suggérée automatiquement selon le(s) genre(s) du livre
  // sélectionné, mais jamais imposée : la lectrice change le rendu via
  // les pastilles de couleur sous la carte à tout moment.
  const [selectedTheme, setSelectedTheme] = useState<string>("default");
  const [themeManuallySet, setThemeManuallySet] = useState(false);
  useEffect(() => {
    if (!selectedBook || themeManuallySet) return;
    setSelectedTheme(detectTheme(toArray<string>((selectedBook as any).genres)));
  }, [selectedBook, themeManuallySet]);
  const theme = SHARE_THEMES[selectedTheme];

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
              
              <div className="relative z-10 space-y-6 w-full flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: theme.accent }}>Mon Carnet Lectoria</div>
                
                {selectedBook && (
                  <>
                    <div className="relative w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white rotate-1">
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
                        <BookCover src={selectedBook.cover} alt={selectedBook.title} className="object-cover" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-2xl font-headline italic leading-tight">{selectedBook.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-70">{selectedBook.author}</p>
                    </div>

                    {rank && (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <rank.icon className="h-8 w-8" style={{ color: theme.accent }} />
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

                    {selectedBook.favoriteQuote && (
                      <div className="pt-4 border-t w-full" style={{ borderColor: theme.badge }}>
                        <p className="text-xs italic leading-relaxed opacity-70 px-4">
                          "{selectedBook.favoriteQuote}"
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="absolute bottom-3 text-[9px] font-headline italic tracking-widest opacity-30">@Lectoria</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {THEME_ORDER.map((key) => (
                <button
                  key={key}
                  onClick={() => { setSelectedTheme(key); setThemeManuallySet(true); }}
                  title={SHARE_THEMES[key].label}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all shadow-sm",
                    selectedTheme === key ? "border-primary scale-110" : "border-white/60 hover:scale-105"
                  )}
                  style={{ background: SHARE_THEMES[key].swatch }}
                />
              ))}
            </div>
            <p className="text-center text-[10px] italic opacity-40 -mt-2">{theme.label}{!themeManuallySet && " (suggéré selon le genre)"}</p>
            {coverError && (
              <p className="text-center text-[11px] italic text-amber-600 -mt-1">
                Couverture indisponible pour ce livre ({coverError}). L'export se fera sans, sauf si tu{" "}
                <button onClick={() => setCoverRetryCount((n) => n + 1)} className="underline">réessaies</button>.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleShareToSocial("Instagram")}
                disabled={isExporting || !selectedBook || coverLoading}
                className="w-full rounded-2xl shadow-lg shadow-pink-200 border-none h-12"
                style={{ background: "linear-gradient(45deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)" }}
              >
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-white"><path d={siInstagram.path} /></svg>} Insta
              </Button>
              <Button
                onClick={() => handleShareToSocial("TikTok")}
                disabled={isExporting || !selectedBook || coverLoading}
                className="w-full rounded-2xl shadow-lg shadow-slate-200 border-none h-12"
                style={{ backgroundColor: `#${siTiktok.hex}` }}
              >
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-white"><path d={siTiktok.path} /></svg>} TikTok
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || !selectedBook || coverLoading}
                className="w-full col-span-2 rounded-2xl border-primary/20 text-primary h-12"
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
