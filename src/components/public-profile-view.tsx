"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Feather } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";
import type { ShareDoc, ShowcaseBook } from "@/lib/public-profile";
import "./public-profile.css";

/**
 * Profil de lectrice en lecture seule : ce que voit une personne invitée
 * avec le lien (page /p/[token]) et l'aperçu en direct dans le panneau
 * "Modifier mon profil visible". Aucune lecture Firestore ici : tout vient
 * du document `ShareDoc` reçu en paramètre.
 */

const icon = (name: string): CSSProperties => ({ ["--pv-src" as string]: `url(/icons/profil/${name}.svg)` });
const Ico = ({ name, className = "" }: { name: string; className?: string }) => (
  <i className={`pv-i ${className}`} style={icon(name)} aria-hidden="true" />
);

function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r1, g1, b1] = p(a); const [r2, g2, b2] = p(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

export function themeVars(theme: ShareDoc["theme"]): CSSProperties {
  if (theme !== "saison") return {};
  const s = getCurrentSeasonalTheme();
  if (!s) return {};
  return {
    ["--pv-season-bg" as string]: `linear-gradient(${s.top}, ${mixHex(s.top, s.bottom, 0.55)})`,
    ["--pv-season-ink" as string]: s.ink,
  };
}

const MEDAL_COLORS: Record<string, [string, string, string?]> = {
  Bronze: ["#e3a76f", "#a9692f"],
  Argent: ["#eef1f5", "#9aa7b6", "#46566a"],
  Or: ["#f4d77a", "#c9971f"],
  Diamant: ["#cfe7ff", "#6aa5d8", "#1d3b5e"],
};

function Stars({ n }: { n: number }) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className="pv-stars" aria-label={`${r} sur 5`}>
      {"★".repeat(r)}<span style={{ opacity: 0.28 }}>{"★".repeat(5 - r)}</span>
    </span>
  );
}

function Cover({ b, small }: { b: { t: string; c: string }; small?: boolean }) {
  return (
    <div className="pv-cv" title={b.t} style={small ? undefined : undefined}>
      <BookCover src={b.c} alt={b.t} className="object-cover" />
    </div>
  );
}

function Vitrine({ tabs }: { tabs: { id: string; label: string; books: ShowcaseBook[] }[] }) {
  const [tab, setTab] = useState(tabs[0]?.id);
  const [cols, setCols] = useState(6);
  const [info, setInfo] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const current = tabs.find((t) => t.id === tab) || tabs[0];

  useEffect(() => {
    if (!tabs.find((t) => t.id === tab)) setTab(tabs[0]?.id);
  }, [tabs, tab]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(Math.max(3, Math.min(7, Math.floor((el.clientWidth - 28) / 80)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const out: ShowcaseBook[][] = [];
    const list = current?.books || [];
    for (let i = 0; i < list.length; i += cols) out.push(list.slice(i, i + cols));
    return out;
  }, [current, cols]);

  const update = () => {
    const el = scroller.current;
    if (el) setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  };
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
    update();
  }, [tab, cols, current]);

  useEffect(() => {
    if (!info) return;
    const close = () => setInfo(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [info]);

  if (!current) return null;
  return (
    <div className="pv-vit">
      <div className="pv-vtabs">
        <div className="pv-vseg" role="tablist" aria-label="Vitrines">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === current.id} onClick={() => setTab(t.id)}>
              {t.label}<b>{t.books.length}</b>
            </button>
          ))}
        </div>
        <span className="pv-infowrap">
          <button
            type="button"
            className="pv-info"
            aria-label="Aide : comment voir la suite de la vitrine"
            aria-expanded={info}
            onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
            onMouseEnter={() => setInfo(true)}
            onMouseLeave={() => setInfo(false)}
          >
            i
          </button>
          {info && <span className="pv-pop" role="tooltip">Fais défiler la vitrine pour voir la suite.</span>}
        </span>
      </div>
      <div className="pv-frame">
        <div className="pv-scroller" ref={scroller} onScroll={update}>
          {rows.length === 0 && <p style={{ textAlign: "center", fontStyle: "italic", opacity: 0.7, padding: "24px 0" }}>Rien à montrer pour l'instant.</p>}
          {rows.map((row, i) => (
            <div key={i} className="pv-shelf" style={{ ["--pv-cols" as string]: cols } as CSSProperties}>
              {row.map((b) => <Cover key={b.id} b={b} />)}
            </div>
          ))}
        </div>
        <div className={`pv-fadeb${atEnd ? " off" : ""}`} />
        <div className="pv-shine" />
      </div>
    </div>
  );
}

export function PublicProfileView({
  data,
  cta,
  overlay,
}: {
  data: ShareDoc;
  cta?: ReactNode;
  overlay?: ReactNode;
}) {
  const show = data.show;
  const tabs = [
    ...(show.wishlist ? [{ id: "wish", label: "Wishlist", books: data.wishlist }] : []),
    ...(show.pal ? [{ id: "pal", label: "PAL", books: data.pal }] : []),
  ];
  const name = data.name || "Lectrice Lectoria";

  return (
    <div className="pv-theme pv-guest" data-theme={data.theme} style={themeVars(data.theme)}>
      {overlay}

      <div className="pv-avatar" aria-hidden="true">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt="" />
        ) : (
          <Feather />
        )}
      </div>
      <h2 className="pv-gname">{name}</h2>
      {data.bio && <p className="pv-since">{data.bio}</p>}
      {cta && <div className="pv-ctas">{cta}</div>}

      {data.favoriteGenres.length > 0 && (
        <div className="pv-gl">
          <div className="pv-glab">Genres favoris</div>
          <div className="pv-chips">{data.favoriteGenres.map((g) => <span key={g}>{g}</span>)}</div>
        </div>
      )}

      {show.pepites && data.pepites.length > 0 && (
        <div className="pv-block pv-pep">
          <div className="pv-glab"><Ico name="diamants" className="pv-gic" />Pépites incontournables de {name}</div>
          <div className="pv-minis">
            {data.pepites.map((b) => (
              <div key={b.id} className="pv-mini">
                <Cover b={b} />
                <span style={{ display: "block", marginTop: 5 }}>{b.t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {show.review && data.review && (
        <div className="pv-block pv-review">
          <Cover b={data.review} />
          <div>
            <p className="pv-rt">{data.review.t}</p>
            <div><Stars n={data.review.r} /></div>
            <q>{data.review.x}</q>
            <small>
              Avis choisi par {name}
              {data.review.d ? ` · ${new Date(data.review.d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </small>
          </div>
        </div>
      )}

      {show.quotes && data.quotes.length > 0 && (
        <div className="pv-block pv-quotes">
          <div className="pv-glab"><Ico name="citation" className="pv-gic" />Citations préférées de {name}</div>
          <div className="pv-qgrid">
            {data.quotes.map((q, i) => (
              <div key={i} className="pv-qcard">
                <Ico name="citation" />
                <p>{q.x}</p>
                <small>{q.s}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {show.medals && data.medals.length > 0 && (
        <div className="pv-block pv-medals">
          <div className="pv-glab"><Ico name="decerner" className="pv-gic" />Badges et médailles</div>
          <div className="pv-mgrid">
            {data.medals.map((m) => {
              const c = MEDAL_COLORS[m.lv] || MEDAL_COLORS.Bronze;
              return (
                <div key={`${m.l}-${m.lv}`} className="pv-medal">
                  <div className="pv-disc" style={{ ["--pv-m1" as string]: c[0], ["--pv-m2" as string]: c[1], ["--pv-mi" as string]: c[2] || "#fff" } as CSSProperties}>
                    <Ico name="decerner" />
                  </div>
                  <b>{m.l}</b>
                  <small>{m.lv} · {m.n} lus</small>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tabs.length > 0 && <Vitrine tabs={tabs} />}

      <div className="pv-gfoot">
        <span>Profil en lecture seule · mis à jour en direct</span>
      </div>
    </div>
  );
}
