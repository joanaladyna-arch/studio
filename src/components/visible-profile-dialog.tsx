"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useDoc, useFirestore, useUser } from "@/firebase";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";
import { cn } from "@/lib/utils";
import {
  buildShareDoc, listQuoteCandidates, listReviewCandidates, mergeSettings, newShareToken, persistVisibleProfile,
  type ProfileTheme, type ShareDoc, type ShowFlags, type VisibleSettings,
} from "@/lib/public-profile";
import { PublicProfileView } from "@/components/public-profile-view";
import { Copy, Loader2, Share2, ExternalLink } from "lucide-react";

const Ic = ({ name, size = 26 }: { name: string; size?: number }) => (
  <i className="pv-i" aria-hidden="true" style={{ ["--pv-src" as string]: `url(/icons/profil/${name}.svg)`, width: size, height: size } as CSSProperties} />
);

function Row({ icon, title, sub, checked, onChange }: { icon: string; title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-3 cursor-pointer border-b border-primary/10 last:border-b-0">
      <span className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 text-primary/85"><Ic name={icon} size={28} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{sub}</span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const Legend = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
);

const selectCls = "w-full h-10 rounded-xl border border-primary/15 bg-white px-3 text-sm min-w-0";

function Body() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(profileRef);
  const booksRef = useMemo(() => (db && user ? collection(db, "users", user.uid, "books") : null), [db, user]);
  const savedRef = useMemo(() => (db && user ? collection(db, "users", user.uid, "savedQuotes") : null), [db, user]);
  const { data: booksRaw = [] } = useCollection(booksRef);
  const { data: savedRaw = [] } = useCollection(savedRef);
  const books = booksRaw as any[];
  const saved = savedRaw as any[];

  const [draft, setDraft] = useState<VisibleSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState<ShareDoc | null>(null);
  const persistedToken = useRef<string>("");

  useEffect(() => {
    if (draft || profileLoading || !profile) return;
    const s = mergeSettings((profile as any).visibleProfile);
    persistedToken.current = s.shareToken;
    setDraft(s);
  }, [profile, profileLoading, draft]);

  const patch = (p: Partial<VisibleSettings>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  };
  const patchShow = (k: keyof ShowFlags, v: boolean) => {
    setDraft((d) => (d ? { ...d, show: { ...d.show, [k]: v } } : d));
    setDirty(true);
  };

  const reviewCands = useMemo(() => listReviewCandidates(books), [books]);
  const quoteCands = useMemo(() => listQuoteCandidates(books, saved), [books, saved]);

  // Aperçu en direct
  useEffect(() => {
    if (!draft || !user || !profile) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const d = await buildShareDoc({ uid: user.uid, profile, books, saved, settings: draft });
      if (!cancelled) setPreview(d);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [draft, user, profile, books, saved]);

  // Enregistrement automatique
  useEffect(() => {
    if (!dirty || !draft || !db || !user || !profile) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        await persistVisibleProfile({ db, uid: user.uid, profile, books, saved, settings: draft, previousToken: persistedToken.current });
        persistedToken.current = draft.shareToken;
        setDirty(false);
        setStatus("saved");
      } catch (err: any) {
        console.error("Visible profile save:", err);
        setStatus("error");
        toast({
          variant: "destructive",
          title: "Enregistrement impossible",
          description: err?.code === "permission-denied"
            ? "Firestore refuse l'écriture : la règle « profileShares » doit être ajoutée dans la console Firebase."
            : "Réessaie dans un instant.",
        });
        setDirty(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = draft?.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${draft.shareToken}` : "";

  const toggleLink = (on: boolean) => {
    if (!draft) return;
    patch({ shareActive: on, shareToken: on && !draft.shareToken ? newShareToken() : draft.shareToken });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Lien copié" });
    } catch {
      toast({ variant: "destructive", title: "Copie impossible", description: link });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `${(profile as any)?.name || "Mon profil"} sur Lisoria`, url: link }); return; } catch (err: any) { if (err?.name === "AbortError") return; }
    }
    copy();
  };

  if (!draft) {
    return <div className="py-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground/50" /></div>;
  }

  const season = getCurrentSeasonalTheme();
  const themes: { k: ProfileTheme; label: string; bg: string }[] = [
    { k: "creme", label: "Crème", bg: "#f6efe3" },
    { k: "nuit", label: "Nuit", bg: "#16202c" },
    ...(season ? [{ k: "saison" as ProfileTheme, label: season.label, bg: `linear-gradient(${season.top}, ${season.bottom})` }] : []),
  ];

  const nWish = books.filter((b) => b.status === "envie").length;
  const nPal = books.filter((b) => b.status === "pal").length;
  const nPep = books.filter((b) => b.isRecommended).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-[1.35fr_1fr]">
      <div className="bg-primary/[0.04] p-4 sm:p-6 min-w-0 md:border-r md:border-primary/10">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ce que voit la personne invitée</p>
        <div className="rounded-2xl overflow-hidden border border-primary/10 shadow-lg">
          {preview ? (
            <PublicProfileView
              data={preview}
              cta={<><span className="pv-gbtn">Rejoindre Lisoria</span><span className="pv-gbtn pv-alt">Suivre</span></>}
              overlay={!draft.shareActive ? (
                <div className="pv-off-overlay"><p>Ce lien n'est pas actif.<small>Active le lien pour que ton profil soit visible.</small></p></div>
              ) : undefined}
            />
          ) : (
            <div className="py-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground/50" /></div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-5 min-w-0">
        <div>
          <Legend>Sur mon profil</Legend>
          <Row icon="etoiles" title="Mon dernier avis" sub="Un seul avis, celui que tu choisis" checked={draft.show.review} onChange={(v) => patchShow("review", v)} />
          {draft.show.review && (
            <div className="pb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">Avis affiché</span>
              {reviewCands.length > 0 ? (
                <select className={selectCls} aria-label="Avis affiché" value={draft.reviewBookId || reviewCands[0].id} onChange={(e) => patch({ reviewBookId: e.target.value })}>
                  {reviewCands.map((r) => <option key={r.id} value={r.id}>{r.title}{r.rating ? ` · ${"★".repeat(Math.round(r.rating))}` : ""}</option>)}
                </select>
              ) : (
                <span className="italic">Aucun avis écrit pour l'instant.</span>
              )}
            </div>
          )}
          <Row icon="diamants" title="Mes livres préférés lus" sub={nPep ? `${nPep} pépite${nPep > 1 ? "s" : ""} incontournable${nPep > 1 ? "s" : ""}` : "Aucune pépite marquée pour l'instant"} checked={draft.show.pepites} onChange={(v) => patchShow("pepites", v)} />
          <Row icon="citation" title="Mes citations préférées" sub="Les 2 que tu choisis" checked={draft.show.quotes} onChange={(v) => patchShow("quotes", v)} />
          {draft.show.quotes && (
            <div className="pb-3 space-y-2">
              {quoteCands.length === 0 && <p className="text-xs italic text-muted-foreground">Aucune citation enregistrée pour l'instant (fiche d'un livre ou citation du jour).</p>}
              {quoteCands.length > 0 && [0, 1].map((i) => (
                <select key={i} className={selectCls} aria-label={`Citation ${i + 1}`} value={draft.quoteKeys[i] || ""} onChange={(e) => {
                  const k = [...draft.quoteKeys]; k[i] = e.target.value || null; patch({ quoteKeys: k });
                }}>
                  <option value="">— Citation {i + 1} : aucune —</option>
                  {quoteCands.map((c) => <option key={c.key} value={c.key}>{c.text.length > 64 ? `${c.text.slice(0, 64)}…` : c.text}</option>)}
                </select>
              ))}
            </div>
          )}
          <Row icon="decerner" title="Mes badges et médailles" sub={preview && draft.show.medals ? `${preview.medals.length} médaille${preview.medals.length > 1 ? "s" : ""} gagnée${preview.medals.length > 1 ? "s" : ""}` : "Ceux que tu as gagnés"} checked={draft.show.medals} onChange={(v) => patchShow("medals", v)} />
          <Row icon="favori" title="Ma wishlist en vitrine" sub={`${nWish} livre${nWish > 1 ? "s" : ""}, toujours à jour`} checked={draft.show.wishlist} onChange={(v) => patchShow("wishlist", v)} />
          <Row icon="signets" title="Ma PAL en vitrine" sub={`${nPal} livre${nPal > 1 ? "s" : ""}, toujours à jour`} checked={draft.show.pal} onChange={(v) => patchShow("pal", v)} />
        </div>

        <div>
          <Legend>Aspect du profil</Legend>
          <div role="radiogroup" aria-label="Aspect du profil" className="flex flex-wrap gap-2">
            {themes.map((t) => (
              <button key={t.k} type="button" role="radio" aria-checked={draft.theme === t.k} onClick={() => patch({ theme: t.k })}
                className={cn("flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors", draft.theme === t.k ? "border-rose bg-rose/15" : "border-primary/10 bg-white/70 hover:border-rose/50")}>
                <span className="h-6 w-6 rounded-full border border-black/15" style={{ background: t.bg }} />{t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Legend>Lien de partage</Legend>
          <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Lien actif</span>
              <span className="block text-xs text-muted-foreground">Lecture seule, sans compte nécessaire</span>
            </span>
            <Switch checked={draft.shareActive} onCheckedChange={toggleLink} />
          </label>
          {draft.shareActive && draft.shareToken && (
            <div className="space-y-2">
              <input readOnly aria-label="Lien de partage" value={link} onFocus={(e) => e.currentTarget.select()} className="w-full h-10 rounded-xl border border-primary/15 bg-primary/5 px-3 text-sm" />
              <div className="flex gap-2 flex-wrap">
                <Button type="button" onClick={copy} className="flex-1 min-w-[130px] rounded-xl"><Copy className="h-4 w-4 mr-2" />Copier le lien</Button>
                <Button type="button" variant="outline" onClick={share} className="flex-1 min-w-[130px] rounded-xl"><Share2 className="h-4 w-4 mr-2" />Partager</Button>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button type="button" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-rose" onClick={() => { patch({ shareToken: newShareToken() }); toast({ title: "Nouveau lien créé", description: "L'ancien ne fonctionne plus." }); }}>
                  Créer un nouveau lien (l'ancien cessera de fonctionner)
                </button>
                <a href={link} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-rose"><ExternalLink className="h-3 w-3" />Ouvrir la page</a>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground" role="status" aria-live="polite">
          {status === "saving" ? "Enregistrement…" : status === "saved" ? "Enregistré." : status === "error" ? "Non enregistré." : "Les changements s'enregistrent tout seuls."}
        </p>
      </div>
    </div>
  );
}

export function VisibleProfileButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("h-11 px-5 text-sm md:h-16 md:px-10 rounded-2xl md:rounded-[2rem] bg-primary text-white font-headline italic md:text-2xl shadow-xl transition-transform active:scale-95", className)}
      >
        <i className="pv-i mr-2 md:mr-3" aria-hidden="true" style={{ ["--pv-src" as string]: "url(/icons/profil/utilisateur.svg)", width: 26, height: 26 } as CSSProperties} />
        Mon profil visible
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card border-none max-w-6xl p-0 bg-white/95 backdrop-blur-3xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-primary/10 shrink-0 flex items-start gap-3">
            <span className="mt-1 text-rose"><Ic name="vis" size={30} /></span>
            <div>
              <DialogTitle className="font-headline italic text-2xl font-normal">Modifier mon profil visible</DialogTitle>
              <DialogDescription className="mt-1 italic">Tu choisis ce qui est montré. Rien d'autre n'est jamais partagé.</DialogDescription>
            </div>
          </div>
          {open && <Body />}
        </DialogContent>
      </Dialog>
    </>
  );
}
