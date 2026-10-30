"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn, slugify } from "@/lib/utils";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";
import { exportNodes, fetchCover, mix, type OutFile } from "@/lib/capture-utils";
import { Camera, Check, ChevronLeft, ChevronRight, Copy, Download, Loader2, Share2 } from "lucide-react";

/**
 * Capture de l'avis d'un livre (remplace l'ancienne fenêtre "Exporter
 * l'avis") : la carte d'avis telle qu'elle apparaît sur la fiche, en PDF,
 * JPG ou PNG. Un avis long est coupé en plusieurs images. La couverture est
 * récupérée avant la capture (sinon le canvas la perd) et remplacée par une
 * couverture dessinée avec le titre si elle est introuvable.
 */

export type ReviewCaptureBook = {
  title: string;
  author: string;
  cover: string | null;
  rating: number;
  spicy: number;
  rankLabel: string | null;
  isPepite: boolean;
  genres: string[];
  review: string;
  quotes: string[];
};

type Format = "pdf" | "jpg" | "png";
type ThemeKey = "creme" | "nuit" | "saison";
type Split = "auto" | "1" | "2" | "3";
type SheetTheme = { label: string; bg: string; solid: string; card: string; ink: string; copper: string; love: string; palme: string; swatch: string };

const SHEET_W = 600;
const A4_H = 849;

function buildThemes(): Record<ThemeKey, SheetTheme | null> {
  const season = getCurrentSeasonalTheme();
  return {
    creme: { label: "Crème", bg: "#f6efe3", solid: "#f6efe3", card: "#fdfaf4", ink: "#1b2430", copper: "#a9703f", love: "#9b3d5d", palme: "#7a5d10", swatch: "#f6efe3" },
    nuit: { label: "Nuit", bg: "#16202c", solid: "#16202c", card: "#1f2b3a", ink: "#f3eadc", copper: "#d9a96e", love: "#f0a3ba", palme: "#f0cf74", swatch: "#16202c" },
    saison: season
      ? {
          label: season.label,
          bg: `linear-gradient(${season.top}, ${mix(season.top, season.bottom, 0.55)})`,
          solid: mix(season.top, season.bottom, 0.3),
          card: mix(season.top, "#ffffff", 0.6),
          ink: season.ink,
          copper: season.accent,
          love: season.accent,
          palme: season.accent,
          swatch: `linear-gradient(${season.top}, ${season.bottom})`,
        }
      : null,
  };
}

const FLAME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";
const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z";

/* ---------- découpage du texte ---------- */

function excerpt(text: string): string {
  const raw = text.trim();
  if (raw.length <= 260) return raw;
  let cut = raw.slice(0, 260);
  cut = cut.slice(0, Math.max(cut.lastIndexOf(" "), 200));
  return `${cut.replace(/[ ,;.]+$/, "")}…`;
}

function splitText(text: string, n: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [text];
  const target = text.length / n;
  const parts: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length >= target && parts.length < n - 1) { parts.push(cur.trim()); cur = ""; }
    cur += s;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

function makeParts(text: string, format: Format, split: Split): string[] {
  const limit = format === "pdf" ? 1700 : 900;
  let n = format === "pdf" || split === "auto" ? Math.max(1, Math.ceil(text.length / limit)) : Number(split);
  n = Math.min(n, 3);
  return n === 1 ? [text] : splitText(text, n);
}

function cleanText(s: string) {
  return s.replace(/^["«“\s]+|["»”\s]+$/g, "");
}

/* ---------- feuille ---------- */

type SheetProps = {
  book: ReviewCaptureBook;
  coverSrc: string | null;
  text: string;
  index: number;
  total: number;
  theme: SheetTheme;
  a4: boolean;
  show: { cover: boolean; stars: boolean; spicy: boolean; palme: boolean; quote: boolean; tags: boolean; name: boolean };
  quote: string;
  name: string;
  dateLabel: string;
};

function Stars({ n, color }: { n: number; color: string }) {
  return (
    <div style={{ display: "flex", gap: 4, color }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={21} height={21} aria-hidden="true" style={{ stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round", fill: i < n ? "currentColor" : "none", opacity: i < n ? 1 : 0.35 }}>
          <path d={STAR} />
        </svg>
      ))}
    </div>
  );
}

function CoverBox({ book, src }: { book: ReviewCaptureBook; src: string | null }) {
  const common = { flex: "none", width: 104, aspectRatio: "3 / 4", borderRadius: 28, overflow: "hidden", boxShadow: "0 8px 14px -8px rgba(0,0,0,.5)" } as const;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={{ ...common, objectFit: "cover" }} />;
  }
  return (
    <div className="font-headline" style={{ ...common, background: "linear-gradient(160deg,#a8552b,#e59a52)", color: "#fff", padding: "14px 10px", display: "flex", flexDirection: "column", justifyContent: "flex-end", textAlign: "center", fontStyle: "italic", fontWeight: 700, lineHeight: 1.1, fontSize: 14 }}>
      {book.title}
      <span style={{ display: "block", marginTop: 6, fontFamily: "'Work Sans',sans-serif", fontStyle: "normal", fontWeight: 600, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.9 }}>{book.author}</span>
    </div>
  );
}

function Sheet({ book, coverSrc, text, index, total, theme, a4, show, quote, name, dateLabel }: SheetProps) {
  const first = index === 0;
  const chip = (extra: React.CSSProperties) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 500, background: "rgba(127,127,127,.16)", ...extra });
  return (
    <div
      data-sheet
      style={{ width: SHEET_W, minHeight: a4 ? A4_H : undefined, boxSizing: "border-box", padding: 34, display: "flex", flexDirection: "column", gap: 18, background: theme.bg, color: theme.ink, fontFamily: "'Work Sans', system-ui, sans-serif" }}
    >
      <div style={{ background: theme.card, borderRadius: 28, padding: "28px 28px 26px", boxShadow: "0 10px 26px -18px rgba(0,0,0,.35)" }}>
        {first ? (
          <>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {show.cover && <CoverBox book={book} src={coverSrc} />}
              <div style={{ minWidth: 0, paddingTop: 6 }}>
                <h2 className="font-headline" style={{ margin: 0, fontStyle: "italic", fontWeight: 500, fontSize: 26, lineHeight: 1.15 }}>{book.title}</h2>
                <p style={{ margin: "10px 0 8px", fontSize: 13, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.62 }}>{book.author}</p>
                {show.stars && book.rating > 0 && <Stars n={book.rating} color={theme.copper} />}
                {show.spicy && book.spicy > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontSize: 11.5, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.85 }}>
                    Spicy
                    <span style={{ display: "flex", gap: 2 }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" style={{ stroke: "#e8650f", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", fill: i < book.spicy ? "#f07a1a" : "none", opacity: i < book.spicy ? 1 : 0.28 }}>
                          <path d={FLAME} />
                        </svg>
                      ))}
                    </span>
                  </div>
                )}
                {((show.palme && book.rankLabel) || (show.tags && (book.isPepite || book.genres.length > 0))) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {show.palme && book.rankLabel && <span style={chip({ background: "rgba(212,175,55,.28)", color: theme.palme, fontWeight: 600 })}>{book.rankLabel}</span>}
                    {show.tags && book.isPepite && <span style={chip({ background: "rgba(207,109,140,.22)", color: theme.love })}>Pépite incontournable</span>}
                    {show.tags && book.genres.map((g) => <span key={g} style={chip({})}>{g}</span>)}
                  </div>
                )}
              </div>
            </div>
            {show.quote && quote && (
              <blockquote className="font-headline" style={{ margin: "20px 0 0", padding: "12px 16px", borderLeft: `3px solid ${theme.copper}`, borderRadius: "0 14px 14px 0", background: "rgba(127,127,127,.12)", fontStyle: "italic", fontSize: 17, lineHeight: 1.4 }}>
                « {cleanText(quote)} »
                <small style={{ display: "block", marginTop: 7, fontFamily: "'Work Sans',sans-serif", fontStyle: "normal", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.65 }}>Citation du livre</small>
              </blockquote>
            )}
          </>
        ) : (
          <div className="font-headline" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14, fontStyle: "italic", fontSize: 17 }}>
            <span>{book.title}</span>
            <small style={{ fontFamily: "'Work Sans',sans-serif", fontStyle: "normal", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.65 }}>{book.author}</small>
          </div>
        )}
        <p style={{ margin: first ? "22px 0 0" : 0, fontStyle: "italic", fontSize: 16.5, lineHeight: 1.7, opacity: 0.85, whiteSpace: "pre-line" }}>
          {index === 0 ? "\"" : "… "}{text}{index === total - 1 ? "\"" : " …"}
        </p>
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.7 }}>
        <span>{show.name && name ? `Avis de ${name} · Lectoria` : "Lectoria"}</span>
        <span>{total > 1 ? `${index + 1} / ${total}` : dateLabel}</span>
      </div>
    </div>
  );
}

/* ---------- fenêtre ---------- */

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; title: string; hint?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("flex-1 min-w-[84px] min-h-[52px] rounded-2xl border-2 px-3 py-2 text-center transition-colors", value === o.value ? "border-rose bg-rose/15 text-primary" : "border-primary/10 bg-white/70 hover:border-rose/50")}>
          <span className="block font-semibold text-sm">{o.title}</span>
          {o.hint && <span className="block text-[11px] text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

const Legend = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
);

function ToggleRow({ title, sub, checked, onChange }: { title: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
      <span><span className="block text-sm font-medium">{title}</span>{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function ReviewCaptureDialog({ open, onOpenChange, book, defaultName }: { open: boolean; onOpenChange: (o: boolean) => void; book: ReviewCaptureBook; defaultName: string }) {
  const { toast } = useToast();
  const themes = useMemo(buildThemes, []);
  const [full, setFull] = useState(true);
  const [format, setFormat] = useState<Format>("jpg");
  const [split, setSplit] = useState<Split>("auto");
  const [show, setShow] = useState({ cover: true, stars: true, spicy: true, palme: true, quote: true, tags: true, name: true });
  const [themeKey, setThemeKey] = useState<ThemeKey>("creme");
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [part, setPart] = useState(0);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverState, setCoverState] = useState<"loading" | "ready" | "missing">("loading");
  const [exporting, setExporting] = useState<"download" | "share" | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const offRef = useRef<HTMLDivElement>(null);

  const theme = (themes[themeKey] ?? themes.creme)!;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCoverState("loading");
    (book.cover ? fetchCover(book.cover) : Promise.resolve(null)).then((uri) => {
      if (cancelled) return;
      setCoverSrc(uri);
      setCoverState(uri ? "ready" : "missing");
    });
    return () => { cancelled = true; };
  }, [open, book.cover]);

  const raw = cleanText(book.review);
  const text = full ? raw : excerpt(raw);
  const parts = useMemo(() => makeParts(text, format, split), [text, format, split]);
  const safePart = Math.min(part, parts.length - 1);
  const quote = book.quotes[Math.min(quoteIdx, Math.max(book.quotes.length - 1, 0))] || "";
  const dateLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const set = (k: keyof typeof show) => (v: boolean) => setShow((s) => ({ ...s, [k]: v }));

  const sheetProps = (i: number): SheetProps => ({ book, coverSrc, text: parts[i], index: i, total: parts.length, theme, a4: format === "pdf", show, quote, name: defaultName, dateLabel });

  const fitRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      if (fitRef.current) setScale(Math.min(1, fitRef.current.clientWidth / SHEET_W));
      if (innerRef.current) setInnerH(innerRef.current.offsetHeight);
    };
    const ro = new ResizeObserver(fit);
    const id = setTimeout(() => {
      if (fitRef.current) ro.observe(fitRef.current);
      if (innerRef.current) ro.observe(innerRef.current);
      fit();
    }, 50);
    return () => { clearTimeout(id); ro.disconnect(); };
  }, [open, format, safePart, parts, show, full, coverSrc, themeKey]);

  const meta = format === "pdf"
    ? `PDF · A4 · ${parts.length} page${parts.length > 1 ? "s" : ""}`
    : `${format.toUpperCase()} · 1080 × ${Math.round((innerH || A4_H) * (1080 / SHEET_W))} px · ${parts.length > 1 ? `${parts.length} images` : "une seule image"}`;

  const fileBase = `lectoria-avis-${slugify(book.title || "livre") || "livre"}`;

  const buildFiles = async (): Promise<OutFile[]> => {
    setOffscreen(true);
    await new Promise((r) => setTimeout(r, 350));
    try {
      const nodes = offRef.current ? Array.from(offRef.current.querySelectorAll<HTMLElement>("[data-sheet]")) : [];
      if (!nodes.length) throw new Error("Rien à capturer");
      return await exportNodes({ nodes, format, solid: theme.solid, fileBase, sheetWidth: SHEET_W });
    } finally {
      setOffscreen(false);
    }
  };

  const run = async (kind: "download" | "share") => {
    if (exporting) return;
    setExporting(kind);
    try {
      const out = await buildFiles();
      if (kind === "share") {
        const files = out.map((o) => new File([o.blob], o.filename, { type: o.type }));
        if (typeof navigator !== "undefined" && navigator.canShare?.({ files })) {
          try { await navigator.share({ files, title: book.title }); return; } catch (err: any) { if (err?.name === "AbortError") return; }
        }
        toast({ title: out.length > 1 ? "Fichiers enregistrés" : "Fichier enregistré", description: "Ton appareil ne propose pas le partage direct : retrouve-les dans tes téléchargements pour les envoyer." });
      }
      for (let i = 0; i < out.length; i++) {
        const url = URL.createObjectURL(out[i].blob);
        const a = document.createElement("a");
        a.href = url; a.download = out[i].filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        if (i < out.length - 1) await new Promise((r) => setTimeout(r, 450));
      }
      if (kind === "download") toast({ title: out.length > 1 ? `${out.length} images enregistrées` : "Capture enregistrée", description: out.length > 1 ? "Retrouve-les dans tes téléchargements." : out[0].filename });
    } catch (err) {
      console.error("Capture avis:", err);
      toast({ variant: "destructive", title: "La capture a échoué", description: "Réessaie dans un instant." });
    } finally {
      setExporting(null);
    }
  };

  const copyText = async () => {
    const stars = book.rating > 0 ? `\n${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}` : "";
    const txt = `${book.title}${book.author ? ` — ${book.author}` : ""}${stars}\n\n${raw}`;
    try { await navigator.clipboard.writeText(txt); toast({ title: "Avis copié", description: "Tu peux le coller dans un message." }); }
    catch { toast({ variant: "destructive", title: "Copie impossible", description: "Ton navigateur refuse l'accès au presse-papiers." }); }
  };

  const themeList = (Object.keys(themes) as ThemeKey[]).filter((k) => themes[k]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-none max-w-5xl p-0 bg-white/95 backdrop-blur-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-primary/10 shrink-0">
          <DialogTitle className="font-headline italic text-2xl font-normal flex items-center gap-3"><Camera className="h-5 w-5 text-rose" /> Capturer mon avis</DialogTitle>
          <DialogDescription className="mt-1 italic">{book.title} · l'aperçu est exactement ce qui sera enregistré.</DialogDescription>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-[1.05fr_1fr]">
          <div className="bg-primary/[0.04] p-5 sm:p-6 flex flex-col gap-3 min-w-0 md:border-r md:border-primary/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>
              {parts.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Précédent" disabled={safePart === 0} onClick={() => setPart(safePart - 1)} className="h-8 w-8 rounded-full border border-primary/15 bg-white grid place-items-center disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs text-muted-foreground min-w-[84px] text-center">{format === "pdf" ? "Page" : "Image"} {safePart + 1} sur {parts.length}</span>
                  <button type="button" aria-label="Suivant" disabled={safePart >= parts.length - 1} onClick={() => setPart(safePart + 1)} className="h-8 w-8 rounded-full border border-primary/15 bg-white grid place-items-center disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <div ref={fitRef} className="w-full max-w-[520px] overflow-hidden rounded-md shadow-xl" style={{ height: innerH * scale || undefined }}>
                <div ref={innerRef} style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                  <Sheet {...sheetProps(safePart)} />
                </div>
              </div>
            </div>
            <div role="status" className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm", coverState === "loading" ? "bg-white border-primary/10" : "bg-emerald-50 border-transparent")}>
              {coverState === "loading" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Check className="h-4 w-4 text-emerald-700 shrink-0" />}
              <div>
                <p>{coverState === "loading" ? "Chargement de la couverture…" : coverState === "ready" ? "Couverture prête" : "Pas de visuel disponible"}</p>
                <p className="text-xs text-muted-foreground">
                  {coverState === "missing" ? "Une couverture avec le titre est dessinée à la place, jamais de vide." : "Elle est enregistrée avec la carte avant la capture."}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col gap-5 min-w-0">
            <div>
              <Legend>Texte de l'avis</Legend>
              <Seg label="Texte de l'avis" value={full ? "full" : "short"} onChange={(v) => { setFull(v === "full"); setPart(0); }} options={[
                { value: "full", title: "Avis complet", hint: "tout le texte" },
                { value: "short", title: "Extrait", hint: "le début, coupé proprement" },
              ]} />
            </div>

            <div>
              <Legend>Format</Legend>
              <Seg label="Format" value={format} onChange={(v) => { setFormat(v); setPart(0); }} options={[
                { value: "pdf", title: "PDF", hint: "à garder ou imprimer" },
                { value: "jpg", title: "JPG", hint: "léger, pour envoyer" },
                { value: "png", title: "PNG", hint: "qualité maximale" },
              ]} />
              <p className="mt-2 text-xs text-muted-foreground">{format === "pdf" ? "Une page A4, ou plusieurs si l'avis est long." : format === "jpg" ? "Léger, facile à envoyer." : "Qualité maximale, texte le plus net."}</p>
            </div>

            {format !== "pdf" && (
              <div>
                <Legend>Découpage</Legend>
                <Seg label="Nombre d'images" value={split} onChange={(v) => { setSplit(v); setPart(0); }} options={[
                  { value: "auto", title: "Auto" }, { value: "1", title: "1 image" }, { value: "2", title: "2 images" }, { value: "3", title: "3 images" },
                ]} />
                <p className="mt-2 text-xs text-muted-foreground">Un avis long est coupé en plusieurs images pour rester lisible sur téléphone.</p>
              </div>
            )}

            <div>
              <Legend>Sur la carte</Legend>
              <div className="divide-y divide-primary/10">
                <ToggleRow title="Couverture" sub="À côté du titre" checked={show.cover} onChange={set("cover")} />
                {book.rating > 0 && <ToggleRow title="Note en étoiles" checked={show.stars} onChange={set("stars")} />}
                {book.spicy > 0 && <ToggleRow title="Note spicy" sub="Les flammes, de 0 à 5" checked={show.spicy} onChange={set("spicy")} />}
                {book.rankLabel && <ToggleRow title="Palme de classement" sub={book.rankLabel} checked={show.palme} onChange={set("palme")} />}
                {book.quotes.length > 0 && <ToggleRow title="Citation du livre" sub="Celle que tu as enregistrée" checked={show.quote} onChange={set("quote")} />}
                {(book.isPepite || book.genres.length > 0) && <ToggleRow title="Pépite et genres" sub="Les petites pastilles" checked={show.tags} onChange={set("tags")} />}
                <ToggleRow title="Mon prénom" sub="« Avis de … · Lectoria »" checked={show.name} onChange={set("name")} />
              </div>
              {show.quote && book.quotes.length > 1 && (
                <select aria-label="Citation affichée" value={quoteIdx} onChange={(e) => setQuoteIdx(Number(e.target.value))} className="mt-2 w-full h-10 rounded-xl border border-primary/15 bg-white px-3 text-sm min-w-0">
                  {book.quotes.map((q, i) => <option key={i} value={i}>{cleanText(q).length > 64 ? `${cleanText(q).slice(0, 64)}…` : cleanText(q)}</option>)}
                </select>
              )}
            </div>

            <div>
              <Legend>Fond</Legend>
              <div role="radiogroup" aria-label="Fond de la carte" className="flex flex-wrap gap-2">
                {themeList.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={themeKey === k} onClick={() => setThemeKey(k)}
                    className={cn("flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors", themeKey === k ? "border-rose bg-rose/15" : "border-primary/10 bg-white/70 hover:border-rose/50")}>
                    <span className="h-6 w-6 rounded-full border border-black/15" style={{ background: themes[k]!.swatch }} />{themes[k]!.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button type="button" onClick={() => run("download")} disabled={!!exporting || coverState === "loading" || !raw} className="h-14 rounded-2xl text-base font-semibold">
                {exporting === "download" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                {exporting === "download" ? "Création du fichier…" : `Télécharger en ${format.toUpperCase()}${format !== "pdf" && parts.length > 1 ? ` (${parts.length} images)` : ""}`}
              </Button>
              <Button type="button" variant="outline" onClick={copyText} className="h-12 rounded-2xl"><Copy className="mr-2 h-4 w-4" /> Copier l'avis en texte</Button>
              <Button type="button" variant="outline" onClick={() => run("share")} disabled={!!exporting || coverState === "loading" || !raw} className="h-12 rounded-2xl">
                {exporting === "share" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                Partager à un proche ou sur les réseaux
              </Button>
            </div>
          </div>
        </div>

        {offscreen && (
          <div ref={offRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
            {parts.map((_, i) => <Sheet key={i} {...sheetProps(i)} />)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
