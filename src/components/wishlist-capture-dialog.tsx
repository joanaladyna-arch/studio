"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn, slugify } from "@/lib/utils";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";
import { Camera, Check, ChevronLeft, ChevronRight, Copy, Download, Loader2, Share2 } from "lucide-react";

/**
 * Capture de la wishlist en PDF / JPG / PNG, en deux versions :
 *  - "Avec couvertures" : corde à linge de couvertures (les images sont
 *    d'abord récupérées via /api/proxy-image puis intégrées à la feuille,
 *    sinon la capture les perd — restriction CORS du canvas) ;
 *  - "Liste seule" : titre + auteur, sans aucune image à charger.
 * L'aperçu à l'écran et le fichier exporté partagent le même composant
 * <Sheet> ; l'export capture une copie hors écran à taille réelle.
 */

export type CaptureBook = { id: string; title: string; author: string; cover: string | null };

type Mode = "covers" | "list";
type Format = "pdf" | "jpg" | "png";
type ThemeKey = "creme" | "nuit" | "saison";
type CoverMap = Record<string, string | null>;

type SheetTheme = { label: string; bg: string; solid: string; ink: string; paper: string; cord: string; peg: string; swatch: string };

const SHEET_W = 600;
const A4_H = 849;

const COVER_PALETTE: [string, string][] = [
  ["#7a2335", "#c4566b"], ["#1f3a5f", "#4f7cac"], ["#3b2f5e", "#8e6fc4"], ["#a8552b", "#e59a52"], ["#2f5d50", "#5fa58f"],
  ["#5c2a3e", "#b85a7a"], ["#26364d", "#6c7f9c"], ["#8a6a14", "#d1a73c"], ["#43351f", "#9c7a46"], ["#5a2d82", "#b979d6"],
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

function buildThemes(): Record<ThemeKey, SheetTheme | null> {
  const season = getCurrentSeasonalTheme();
  return {
    creme: { label: "Crème", bg: "#f6efe3", solid: "#f6efe3", ink: "#1b2430", paper: "#fbf6ec", cord: "#8c6b4a", peg: "#c9a273", swatch: "#f6efe3" },
    nuit: { label: "Nuit", bg: "#16202c", solid: "#16202c", ink: "#f3eadc", paper: "#1f2b3a", cord: "#b9976f", peg: "#d9b98a", swatch: "#16202c" },
    saison: season
      ? {
          label: season.label,
          bg: `linear-gradient(${season.top}, ${mix(season.top, season.bottom, 0.55)})`,
          solid: mix(season.top, season.bottom, 0.3),
          ink: season.ink,
          paper: mix(season.top, "#ffffff", 0.6),
          cord: season.accent,
          peg: mix(season.accent, "#ffffff", 0.4),
          swatch: `linear-gradient(${season.top}, ${season.bottom})`,
        }
      : null,
  };
}

/* ---------- couvertures : récupération avant capture ---------- */

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function decodes(dataUri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 8 && img.naturalHeight > 8); // écarte les faux visuels 1×1
    img.onerror = () => resolve(false);
    img.src = dataUri;
  });
}

async function fetchCover(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let dataUri: string | null = null;
    if (url.startsWith("data:")) {
      dataUri = url;
    } else if (url.startsWith("/")) {
      const res = await fetch(url);
      if (res.ok) dataUri = await blobToDataUri(await res.blob());
    } else {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      dataUri = data?.dataUri || null;
    }
    return dataUri && (await decodes(dataUri)) ? dataUri : null;
  } catch {
    return null;
  }
}

/* ---------- polices embarquées ---------- */

// html-to-image ne sait pas lire la feuille de style Google Fonts (accès
// refusé) et, sans police embarquée, la capture retombe sur une police
// par défaut. On construit donc nous-mêmes le CSS des polices (sous-ensemble
// latin) avec les fichiers en data URI, avec un délai maximal par requête
// pour qu'une connexion lente ne bloque jamais l'export.
let fontCssPromise: Promise<string> | null = null;

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getFontEmbedCSS(): Promise<string> {
  if (fontCssPromise) return fontCssPromise;
  fontCssPromise = (async () => {
    try {
      const link = document.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com/css"]');
      if (!link) return "";
      const css = await (await fetchWithTimeout(link.href)).text();
      const blocks = Array.from(css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)).filter((m) => m[1] === "latin");
      const out = await Promise.all(
        blocks.map(async (m) => {
          let block = m[2];
          const urls = Array.from(block.matchAll(/url\((https:[^)]+)\)/g));
          for (const u of urls) {
            try {
              const res = await fetchWithTimeout(u[1]);
              block = block.replace(u[1], await blobToDataUri(await res.blob()));
            } catch {
              return "";
            }
          }
          return block;
        })
      );
      return out.join("\n");
    } catch {
      return "";
    }
  })();
  return fontCssPromise;
}

/* ---------- mise en page ---------- */

type Split = "auto" | "1" | "2" | "3";

// PDF : pages A4 de taille fixe. JPG/PNG : la wishlist est coupée en
// plusieurs images (en "Auto", assez courtes pour rester lisibles sur un
// téléphone) ; en mode couvertures on coupe toujours entre deux rangées.
function paginate(books: CaptureBook[], mode: Mode, cols: number, format: Format, split: Split): CaptureBook[][] {
  const n = books.length;
  let perPage: number;
  if (format === "pdf") {
    perPage = mode === "list" ? 24 : cols === 6 ? 18 : 8;
  } else if (split === "auto") {
    perPage = mode === "list" ? 24 : cols === 6 ? 24 : 12;
  } else {
    const parts = Number(split);
    perPage = mode === "list" ? Math.ceil(n / parts) : Math.ceil(Math.ceil(n / cols) / parts) * cols;
  }
  perPage = Math.max(perPage, 1);
  const pages: CaptureBook[][] = [];
  for (let i = 0; i < n; i += perPage) pages.push(books.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type SheetProps = {
  books: CaptureBook[];
  covers: CoverMap;
  mode: Mode;
  cols: number;
  showTitles: boolean;
  showBoxes: boolean;
  heading: string;
  total: number;
  theme: SheetTheme;
  a4: boolean;
  footerRight: string;
  startIndex: number;
};

function Cover({ book, src, theme, tf }: { book: CaptureBook; src: string | null; theme: SheetTheme; tf: number }) {
  const pal = COVER_PALETTE[hash(book.id || book.title) % COVER_PALETTE.length];
  if (src) {
    return (
      <div style={{ position: "relative", aspectRatio: "2 / 3", borderRadius: 5, overflow: "hidden", boxShadow: "0 5px 10px -5px rgba(0,0,0,.5)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  // Pas de visuel exploitable : couverture dessinée avec le titre, jamais un trou.
  return (
    <div
      style={{
        position: "relative", aspectRatio: "2 / 3", borderRadius: 5, overflow: "hidden",
        boxShadow: "0 5px 10px -5px rgba(0,0,0,.5)", color: "#fff", padding: "9% 8%",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        background: `linear-gradient(155deg, ${pal[0]}, ${pal[1]})`,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "7%", background: "rgba(0,0,0,.18)" }} />
      <div className="font-headline" style={{ position: "relative", fontWeight: 700, fontSize: tf, lineHeight: 1.12 }}>{book.title}</div>
      {book.author && (
        <div style={{ position: "relative", marginTop: 4, fontSize: tf * 0.72, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.85 }}>
          {book.author.split(" ").slice(-1)[0]}
        </div>
      )}
    </div>
  );
}

function Sheet({ books, covers, mode, cols, showTitles, showBoxes, heading, total, theme, a4, footerRight, startIndex }: SheetProps) {
  const tf = cols === 6 ? 10 : 13;
  const cf = cols === 6 ? 10 : 12.5;
  const rows: CaptureBook[][] = [];
  if (mode === "covers") for (let i = 0; i < books.length; i += cols) rows.push(books.slice(i, i + cols));

  return (
    <div
      data-sheet
      style={{
        width: SHEET_W, minHeight: a4 ? A4_H : undefined, boxSizing: "border-box", padding: "34px 34px 26px",
        display: "flex", flexDirection: "column", gap: 20, background: theme.bg, color: theme.ink,
        fontFamily: "'Work Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192-v3.png" alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 13, boxShadow: "0 6px 12px -6px rgba(0,0,0,.5)" }} />
        <div>
          <div className="font-headline" style={{ fontStyle: "italic", fontWeight: 700, fontSize: 26, lineHeight: 1.05 }}>{heading}</div>
          <div style={{ marginTop: 3, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.7 }}>
            {total} livre{total > 1 ? "s" : ""} à lire
          </div>
        </div>
      </div>

      {mode === "covers" ? (
        rows.map((row, ri) => (
          <div key={ri} style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: 14, paddingTop: 28, marginBottom: 12 }}>
            <i style={{ position: "absolute", left: -8, right: -8, top: 10, height: 2, borderRadius: 2, background: theme.cord, opacity: 0.85 }} />
            {row.map((b) => {
              const rot = (((hash(b.id) % 5) - 2) * 0.55).toFixed(2);
              return (
                <div key={b.id} style={{ position: "relative", minWidth: 0, display: "flex", flexDirection: "column", gap: 6, transform: `rotate(${rot}deg)`, transformOrigin: "50% 0" }}>
                  <i style={{ position: "absolute", zIndex: 2, left: "50%", top: -18, width: 9, height: 22, borderRadius: "2px 2px 3px 3px", background: theme.peg, boxShadow: "0 1px 0 rgba(0,0,0,.25)", transform: "translateX(-50%)" }} />
                  <Cover book={b} src={covers[b.id] ?? null} theme={theme} tf={tf} />
                  {showTitles && (
                    <div style={{ fontSize: cf, lineHeight: 1.25 }}>
                      <b className="font-headline" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", fontWeight: 700, fontSize: "1.1em" }}>{b.title}</b>
                      <span style={{ display: "block", opacity: 0.72 }}>{b.author}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <div style={{ columnCount: 2, columnGap: 30 }}>
          {books.map((b, i) => (
            <div key={b.id} style={{ breakInside: "avoid", display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0", borderBottom: `1px dashed ${mix(theme.solid, theme.ink, 0.28)}` }}>
              {showBoxes ? (
                <i style={{ flex: "none", width: 16, height: 16, marginTop: 2, border: `1.8px solid ${theme.ink}`, borderRadius: 4, opacity: 0.8 }} />
              ) : (
                <span style={{ flex: "none", width: 18, marginTop: 1, textAlign: "right", fontSize: 12, opacity: 0.55 }}>{startIndex + i + 1}</span>
              )}
              <div>
                <b className="font-headline" style={{ display: "block", fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>{b.title}</b>
                {b.author && <span style={{ display: "block", marginTop: 2, fontSize: 12, opacity: 0.72 }}>{b.author}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 6, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.7 }}>
        <span>Ma wishlist sur Lectoria</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}

/* ---------- fenêtre ---------- */

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; title: string; hint?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 min-w-[84px] min-h-[52px] rounded-2xl border-2 px-3 py-2 text-center transition-colors",
            value === o.value ? "border-rose bg-rose/15 text-primary" : "border-primary/10 bg-white/70 hover:border-rose/50"
          )}
        >
          <span className="block font-semibold text-sm">{o.title}</span>
          {o.hint && <span className="block text-[11px] text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}

export function WishlistCaptureDialog({
  open,
  onOpenChange,
  books,
  defaultName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  books: CaptureBook[];
  defaultName: string;
}) {
  const { toast } = useToast();
  const themes = useMemo(buildThemes, []);
  const [mode, setMode] = useState<Mode>("covers");
  const [format, setFormat] = useState<Format>("pdf");
  const [cols, setCols] = useState(6);
  const [showTitles, setShowTitles] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showName, setShowName] = useState(true);
  const [name, setName] = useState(defaultName);
  const [themeKey, setThemeKey] = useState<ThemeKey>("creme");
  const [page, setPage] = useState(0);
  const [split, setSplit] = useState<Split>("auto");
  const [covers, setCovers] = useState<CoverMap>({});
  const [loaded, setLoaded] = useState(0);
  const [exporting, setExporting] = useState<"download" | "share" | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const offRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<CoverMap>({});

  useEffect(() => { if (open) setName(defaultName); }, [open, defaultName]);

  const theme = (themes[themeKey] ?? themes.creme)!;
  const total = books.length;
  const needsCovers = mode === "covers";
  const coversReady = !needsCovers || loaded >= total;
  const missing = useMemo(() => books.filter((b) => needsCovers && coversReady && !covers[b.id]).length, [books, covers, needsCovers, coversReady]);

  // Récupération de toutes les couvertures dès l'ouverture (6 à la fois),
  // puis on les garde pour la session : changer de format ne recharge rien.
  useEffect(() => {
    if (!open || !needsCovers) return;
    let cancelled = false;
    const todo = books.filter((b) => !(b.id in cacheRef.current));
    const out: CoverMap = {};
    books.forEach((b) => { if (b.id in cacheRef.current) out[b.id] = cacheRef.current[b.id]; });
    setCovers({ ...out });
    setLoaded(books.length - todo.length);
    let next = 0;
    const worker = async () => {
      while (!cancelled) {
        const i = next++;
        if (i >= todo.length) return;
        const b = todo[i];
        const uri = b.cover ? await fetchCover(b.cover) : null;
        if (cancelled) return;
        cacheRef.current[b.id] = uri;
        out[b.id] = uri;
        setCovers({ ...out });
        setLoaded((n) => n + 1);
      }
    };
    Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
    return () => { cancelled = true; };
  }, [open, needsCovers, books]);

  const heading = showName && name.trim() ? `La wishlist de ${name.trim()}` : "Ma wishlist";
  const pages = useMemo(() => paginate(books, mode, cols, format, split), [books, mode, cols, format, split]);
  const safePage = Math.min(page, pages.length - 1);
  const dateLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const startIndexOf = (p: number) => pages.slice(0, p).reduce((n, arr) => n + arr.length, 0);

  const sheetProps = (p: number): SheetProps => ({
    books: pages[p], covers, mode, cols, showTitles, showBoxes, heading, total, theme,
    a4: format === "pdf", startIndex: startIndexOf(p),
    footerRight: format === "pdf" ? `Page ${p + 1} / ${pages.length}` : pages.length > 1 ? `${dateLabel} · ${p + 1} / ${pages.length}` : dateLabel,
  });

  // Aperçu mis à l'échelle de la colonne (la feuille fait toujours 600 px de large).
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
    const id = requestAnimationFrame(() => {
      if (fitRef.current) ro.observe(fitRef.current);
      if (innerRef.current) ro.observe(innerRef.current);
      fit();
    });
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, [open, mode, format, cols, showTitles, safePage, covers, split]);

  const dims = useMemo(() => {
    if (format === "pdf") return `PDF · A4 · ${pages.length} page${pages.length > 1 ? "s" : ""}${mode === "list" ? " · liste" : ""}`;
    const h = `1080 × ${Math.round((innerH || A4_H) * (1080 / SHEET_W))} px`;
    return `${format.toUpperCase()} · ${h} · ${pages.length > 1 ? `${pages.length} images` : "une seule image"}`;
  }, [format, pages.length, mode, innerH]);

  const fileBase = `lectoria-wishlist${showName && name.trim() ? `-${slugify(name.trim())}` : ""}`;

  // Capture réelle : on monte une copie hors écran à taille réelle (toutes
  // les pages), on attend que les images soient décodées, puis on capture.
  type OutFile = { blob: Blob; filename: string; type: string };
  const buildFile = async (): Promise<OutFile[]> => {
    setOffscreen(true);
    // setTimeout plutôt que requestAnimationFrame : ce dernier est suspendu si l'onglet passe en arrière-plan.
    await new Promise((r) => setTimeout(r, 350));
    try {
      const root = offRef.current;
      const nodes = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-sheet]")) : [];
      if (!nodes.length) throw new Error("Rien à capturer");
      await Promise.all(
        nodes.flatMap((n) => Array.from(n.querySelectorAll("img")).map((im) => (im as HTMLImageElement).decode().catch(() => undefined)))
      );
      const { toPng, toJpeg } = await import("html-to-image");
      const fontEmbedCSS = await getFontEmbedCSS();
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const [r, g, b] = hexToRgb(theme.solid);
        for (let i = 0; i < nodes.length; i++) {
          if (i > 0) doc.addPage();
          doc.setFillColor(r, g, b);
          doc.rect(0, 0, 210, 297, "F");
          // JPEG dans le PDF : un PNG pleine page pèse plusieurs Mo par page.
          const img = await toJpeg(nodes[i], { pixelRatio: 2, quality: 0.92, cacheBust: true, fontEmbedCSS, backgroundColor: theme.solid });
          const w = nodes[i].offsetWidth;
          const h = nodes[i].offsetHeight;
          const k = Math.min(210 / w, 297 / h);
          doc.addImage(img, "JPEG", (210 - w * k) / 2, 0, w * k, h * k, undefined, "FAST");
        }
        return [{ blob: doc.output("blob"), filename: `${fileBase}.pdf`, type: "application/pdf" }];
      }
      const opts = { pixelRatio: 1080 / SHEET_W, cacheBust: true, fontEmbedCSS, backgroundColor: theme.solid };
      const files: OutFile[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const dataUrl = format === "jpg" ? await toJpeg(nodes[i], { ...opts, quality: 0.92 }) : await toPng(nodes[i], opts);
        const blob = await (await fetch(dataUrl)).blob();
        const suffix = nodes.length > 1 ? `-${i + 1}sur${nodes.length}` : "";
        files.push({ blob, filename: `${fileBase}${suffix}.${format}`, type: format === "jpg" ? "image/jpeg" : "image/png" });
      }
      return files;
    } finally {
      setOffscreen(false);
    }
  };

  const run = async (kind: "download" | "share") => {
    if (exporting) return;
    setExporting(kind);
    try {
      const out = await buildFile();
      if (kind === "share") {
        const files = out.map((o) => new File([o.blob], o.filename, { type: o.type }));
        if (typeof navigator !== "undefined" && navigator.canShare?.({ files })) {
          try {
            await navigator.share({ files, title: heading });
            return;
          } catch (err: any) {
            if (err?.name === "AbortError") return;
          }
        }
        toast({ title: out.length > 1 ? "Fichiers enregistrés" : "Fichier enregistré", description: "Ton appareil ne propose pas le partage direct : retrouve-les dans tes téléchargements pour les envoyer." });
      }
      // Plusieurs images : téléchargements espacés, sinon le navigateur n'en garde qu'un.
      for (let i = 0; i < out.length; i++) {
        const url = URL.createObjectURL(out[i].blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = out[i].filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        if (i < out.length - 1) await new Promise((r) => setTimeout(r, 450));
      }
      if (kind === "download") toast({ title: out.length > 1 ? `${out.length} images enregistrées` : "Capture enregistrée", description: out.length > 1 ? "Retrouve-les dans tes téléchargements." : out[0].filename });
    } catch (err) {
      console.error("Capture wishlist:", err);
      toast({ variant: "destructive", title: "La capture a échoué", description: "Réessaie, ou utilise la version « Liste seule » qui ne dépend d'aucune image." });
    } finally {
      setExporting(null);
    }
  };

  const copyText = async () => {
    const txt = `${heading}\n\n` + books.map((b, i) => `${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast({ title: "Liste copiée", description: "Tu peux la coller dans un message." });
    } catch {
      toast({ variant: "destructive", title: "Copie impossible", description: "Ton navigateur refuse l'accès au presse-papiers." });
    }
  };

  const fmtNote =
    mode === "list"
      ? { pdf: "Toute la liste, répartie sur des pages A4.", jpg: "Images courtes, idéales pour une conversation.", png: "Images courtes, texte le plus net." }[format]
      : { pdf: "Toute la wishlist, répartie sur des pages A4.", jpg: "Coupée en images lisibles, faciles à envoyer.", png: "Coupée en images lisibles, texte le plus net." }[format];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-none max-w-5xl p-0 bg-white/95 backdrop-blur-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-primary/10 shrink-0">
          <DialogTitle className="font-headline italic text-2xl font-normal flex items-center gap-3"><Camera className="h-5 w-5 text-rose" /> Capturer ma wishlist</DialogTitle>
          <DialogDescription className="mt-1 italic">{total} livre{total > 1 ? "s" : ""} · l'aperçu est exactement ce qui sera enregistré.</DialogDescription>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-[1.05fr_1fr]">
          {/* Aperçu */}
          <div className="bg-primary/[0.04] p-5 sm:p-6 flex flex-col gap-3 min-w-0 md:border-r md:border-primary/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground tabular-nums">{dims}</span>
              {pages.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Précédent" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="h-8 w-8 rounded-full border border-primary/15 bg-white grid place-items-center disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs text-muted-foreground min-w-[84px] text-center">{format === "pdf" ? "Page" : "Image"} {safePage + 1} sur {pages.length}</span>
                  <button type="button" aria-label="Suivant" disabled={safePage >= pages.length - 1} onClick={() => setPage(safePage + 1)} className="h-8 w-8 rounded-full border border-primary/15 bg-white grid place-items-center disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div ref={fitRef} className="w-full max-w-[520px] overflow-hidden rounded-md shadow-xl" style={{ height: innerH * scale || undefined }}>
                <div ref={innerRef} style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                  <Sheet {...sheetProps(safePage)} />
                </div>
              </div>
            </div>

            <div role="status" className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm", coversReady ? "bg-emerald-50 border-transparent" : "bg-white border-primary/10")}>
              {coversReady ? <Check className="h-4 w-4 text-emerald-700 shrink-0" /> : <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
              <div className="min-w-0 flex-1">
                {!needsCovers ? (
                  <>
                    <p>Aucune couverture à charger</p>
                    <p className="text-xs text-muted-foreground">Rien ne peut manquer : seuls les titres et les auteurs sont enregistrés.</p>
                  </>
                ) : coversReady ? (
                  <>
                    <p>{total - missing} couverture{total - missing > 1 ? "s" : ""} prête{total - missing > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {missing > 0 ? `${missing} livre${missing > 1 ? "s" : ""} sans visuel : une couverture avec le titre est dessinée à la place, jamais de vide.` : "Elles sont enregistrées avec la feuille."}
                    </p>
                  </>
                ) : (
                  <>
                    <p>Chargement des couvertures… {loaded} / {total}</p>
                    <p className="text-xs text-muted-foreground">Elles sont enregistrées avec la feuille avant la capture.</p>
                  </>
                )}
              </div>
              {needsCovers && !coversReady && (
                <div className="h-1.5 w-20 rounded-full bg-primary/10 overflow-hidden"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${(loaded / Math.max(total, 1)) * 100}%` }} /></div>
              )}
            </div>
          </div>

          {/* Réglages */}
          <div className="p-5 sm:p-6 flex flex-col gap-5 min-w-0">
            <div>
              <Legend>Contenu</Legend>
              <Seg label="Contenu de la feuille" value={mode} onChange={(v) => { setMode(v); setPage(0); }} options={[
                { value: "covers", title: "Avec couvertures", hint: "la jolie corde à linge" },
                { value: "list", title: "Liste seule", hint: "titre et auteur" },
              ]} />
              <p className="mt-2 text-xs text-muted-foreground">{mode === "list" ? "Très léger, rien à charger : se lit d'un coup d'œil, même sans connexion." : "Toutes les couvertures, accrochées sur une corde à linge."}</p>
            </div>

            <div>
              <Legend>Format</Legend>
              <Seg label="Format" value={format} onChange={(v) => { setFormat(v); setPage(0); }} options={[
                { value: "pdf", title: "PDF", hint: "à garder ou imprimer" },
                { value: "jpg", title: "JPG", hint: "léger, pour envoyer" },
                { value: "png", title: "PNG", hint: "qualité maximale" },
              ]} />
              <p className="mt-2 text-xs text-muted-foreground">{fmtNote}</p>
            </div>

            {format !== "pdf" && (
              <div>
                <Legend>Découpage</Legend>
                <Seg label="Nombre d'images" value={split} onChange={(v) => { setSplit(v); setPage(0); }} options={[
                  { value: "auto", title: "Auto", hint: "selon la taille" },
                  { value: "1", title: "1 image" },
                  { value: "2", title: "2 images" },
                  { value: "3", title: "3 images" },
                ]} />
                <p className="mt-2 text-xs text-muted-foreground">Une seule image très longue devient illisible sur téléphone : en plusieurs morceaux, chaque couverture reste bien visible.</p>
              </div>
            )}

            {mode === "covers" && (
              <div>
                <Legend>Taille des couvertures</Legend>
                <Seg label="Taille des couvertures" value={String(cols) as "4" | "6"} onChange={(v) => { setCols(Number(v)); setPage(0); }} options={[
                  { value: "4", title: "Grandes · 4 par rangée" },
                  { value: "6", title: "Compactes · 6 par rangée" },
                ]} />
              </div>
            )}

            <div>
              <Legend>Sur la feuille</Legend>
              <div className="divide-y divide-primary/10">
                {mode === "covers" ? (
                  <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
                    <span><span className="block text-sm font-medium">Titres et auteurs</span><span className="block text-xs text-muted-foreground">Sous chaque couverture</span></span>
                    <Switch checked={showTitles} onCheckedChange={setShowTitles} />
                  </label>
                ) : (
                  <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
                    <span><span className="block text-sm font-medium">Cases à cocher</span><span className="block text-xs text-muted-foreground">Pour cocher en librairie ou en bibliothèque</span></span>
                    <Switch checked={showBoxes} onCheckedChange={setShowBoxes} />
                  </label>
                )}
                <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
                  <span><span className="block text-sm font-medium">Mon prénom</span><span className="block text-xs text-muted-foreground">« La wishlist de … »</span></span>
                  <Switch checked={showName} onCheckedChange={setShowName} />
                </label>
              </div>
              <Input aria-label="Prénom affiché" value={name} maxLength={24} disabled={!showName} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 rounded-xl" />
            </div>

            <div>
              <Legend>Fond</Legend>
              <div role="radiogroup" aria-label="Fond de la feuille" className="flex flex-wrap gap-2">
                {(Object.keys(themes) as ThemeKey[]).filter((k) => themes[k]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={themeKey === k}
                    onClick={() => setThemeKey(k)}
                    className={cn("flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors", themeKey === k ? "border-rose bg-rose/15" : "border-primary/10 bg-white/70 hover:border-rose/50")}
                  >
                    <span className="h-6 w-6 rounded-full border border-black/15" style={{ background: themes[k]!.swatch }} />
                    {themes[k]!.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button type="button" onClick={() => run("download")} disabled={!!exporting || !coversReady || total === 0} className="h-14 rounded-2xl text-base font-semibold">
                {exporting === "download" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                {exporting === "download" ? "Création du fichier…" : `Télécharger en ${format.toUpperCase()}${format !== "pdf" && pages.length > 1 ? ` (${pages.length} images)` : ""}`}
              </Button>
              {mode === "list" && (
                <Button type="button" variant="outline" onClick={copyText} className="h-12 rounded-2xl"><Copy className="mr-2 h-4 w-4" /> Copier la liste en texte</Button>
              )}
              <Button type="button" variant="outline" onClick={() => run("share")} disabled={!!exporting || !coversReady || total === 0} className="h-12 rounded-2xl">
                {exporting === "share" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                Envoyer à un proche
              </Button>
            </div>
          </div>
        </div>

        {offscreen && (
          <div ref={offRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
            {pages.map((_, p) => (
              <Sheet key={p} {...sheetProps(p)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
