"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";
import "./login-scene.css";

/**
 * Décor de l'écran de connexion : une vitrine de librairie (fenêtre,
 * étagères, lampes, guirlande, particules) qui suit le calendrier
 * saisonnier de l'app (lib/seasonal-theme.ts), avec un mode "Lecture du
 * soir". Purement visuel : aucune donnée, aucun appel Firebase.
 *
 * Aperçu possible sans attendre la bonne date : /login?saison=printemps|ete|automne|hiver|aucune
 * et /login?soir=1 pour la lecture du soir.
 */

export type LoginSeason = "spring" | "summer" | "autumn" | "winter" | "none";

export const SEASON_LINES: Record<Exclude<LoginSeason, "none">, { tag: string; text: string }> = {
  spring: { tag: "Printemps", text: "Les pages aussi fleurissent au printemps." },
  summer: { tag: "Été", text: "Un livre, un transat, et rien d'autre au programme." },
  autumn: { tag: "Automne", text: "Une tasse de thé, un plaid, votre prochain roman." },
  winter: { tag: "Hiver", text: "Une lumière douce, un plaid, et la pile à lire qui attend." },
};

const THEME_TO_SEASON: Record<string, LoginSeason> = {
  valentin: "winter",
  printemps: "spring",
  ete: "summer",
  rentree: "autumn",
  automne: "autumn",
  noel: "winter",
  hiver: "winter",
};

const PREVIEW_PARAM: Record<string, LoginSeason> = {
  printemps: "spring",
  ete: "summer",
  automne: "autumn",
  hiver: "winter",
  aucune: "none",
};

const NIGHT_KEY = "lectoria-login-night";
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const rng = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ---------- décor statique (chaînes constantes, générées une fois) ---------- */

const flower = (n: number, cx: number, cy: number, r: number, col: string) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.3}" ry="${r}" fill="${col}" transform="rotate(${(i * 360) / n} ${cx} ${cy})"/>`,
  ).join("");

const prop = (cls: string, body: string) =>
  `<svg class="ls-prop ls-${cls}" viewBox="0 0 60 80" aria-hidden="true">${body}</svg>`;

const STEAM = `<path class="ls-steam" d="M22 42c-4-5 4-8 0-14"/><path class="ls-steam" style="animation-delay:-1.4s" d="M32 42c-4-5 4-8 0-14"/>`;

const PROPS_A = [
  prop("spring", `<path d="M30 79c-11 0-14-14-8-24h16c6 10 3 24-8 24z" fill="#8db8cc"/><path d="M24 56c-2-14-5-24-9-34M30 55V14M36 56c2-14 6-24 10-33" stroke="#5f9b5a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M10 20c-1-8 4-13 9-13 1 8-2 13-9 13z" fill="#f08aa6"/><path d="M24 12c-1-8 3-12 6-12s7 4 6 12c-4 3-8 3-12 0z" fill="#f4a7be"/><path d="M41 21c0-8 5-13 10-12 0 8-3 13-10 12z" fill="#e9728f"/>`),
  prop("summer", `<path d="M20 79l-3-20h26l-3 20z" fill="#c8693f"/><rect x="15" y="55" width="30" height="6" rx="2" fill="#d97b4f"/><path d="M30 56V26" stroke="#4f8f45" stroke-width="3"/><path d="M30 46c-9-1-13-6-14-11 8 0 13 4 14 11z" fill="#5da24d"/>${flower(12, 30, 20, 12, "#f2b91f")}<circle cx="30" cy="20" r="6.5" fill="#6b3f1d"/>`),
  prop("autumn", `<ellipse cx="30" cy="62" rx="24" ry="17" fill="#e07b22"/><ellipse cx="19" cy="62" rx="10" ry="16" fill="#d3681a"/><ellipse cx="41" cy="62" rx="10" ry="16" fill="#d3681a"/><ellipse cx="30" cy="62" rx="9" ry="17" fill="#ec8d33"/><path d="M30 46c0-5 1-8 4-10" stroke="#5a6b2a" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M34 41c6-6 12-4 14 0-6 4-11 4-14 0z" fill="#8a9a3a"/>`),
  prop("winter", `<path d="M30 4L46 30H14z" fill="#2f6b4f"/><path d="M30 20L50 50H10z" fill="#2a6048"/><path d="M30 38L54 70H6z" fill="#265641"/><rect x="26" y="70" width="8" height="9" fill="#6a4a35"/><path d="M30 4l6 9-6-3-6 3zM30 20l8 12-8-4-8 4z" fill="#fff"/><circle class="ls-bulb" style="color:#ffd36a" cx="26" cy="26" r="2.4" fill="#ffd36a"/><circle class="ls-bulb" style="color:#ff7a7a;animation-delay:-.9s" cx="36" cy="42" r="2.4" fill="#ff7a7a"/><circle class="ls-bulb" style="color:#9ad7ff;animation-delay:-1.8s" cx="22" cy="55" r="2.4" fill="#9ad7ff"/><circle class="ls-bulb" style="color:#ffd36a;animation-delay:-.4s" cx="40" cy="60" r="2.4" fill="#ffd36a"/>`),
].join("");

const PROPS_B = [
  prop("spring", `<path d="M22 79l-2-14h20l-2 14z" fill="#d79a6c"/><path d="M30 66C20 56 14 46 12 33c12 8 16 18 18 33z" fill="#6fae60"/><path d="M30 66c10-10 16-20 18-33-12 8-16 18-18 33z" fill="#5f9d54"/><path d="M30 66C26 50 26 38 30 24c4 14 4 26 0 42z" fill="#7cbd6c"/>`),
  prop("summer", `<path d="M16 30h26l-3 47H19z" fill="#f7e27a" fill-opacity=".92" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/><rect x="22" y="40" width="8" height="8" rx="2" fill="#fff" fill-opacity=".7"/><rect x="29" y="52" width="8" height="8" rx="2" fill="#fff" fill-opacity=".6"/><path d="M36 8l-6 36" stroke="#e8735a" stroke-width="3" stroke-linecap="round"/><circle cx="43" cy="30" r="9" fill="#f3d03b"/><circle cx="43" cy="30" r="6" fill="#f9e88d"/>`),
  prop("autumn", `<rect x="14" y="48" width="28" height="30" rx="5" fill="#d49a2a"/><path d="M42 54h5a6 6 0 0 1 0 14h-5" stroke="#d49a2a" stroke-width="4" fill="none"/><ellipse cx="28" cy="50" rx="12" ry="2.5" fill="#6b3a1c"/>${STEAM}`),
  prop("winter", `<rect x="14" y="48" width="28" height="30" rx="5" fill="#b5303f"/><path d="M42 54h5a6 6 0 0 1 0 14h-5" stroke="#b5303f" stroke-width="4" fill="none"/><ellipse cx="28" cy="50" rx="12" ry="3" fill="#5a3322"/><circle cx="22" cy="49" r="3.6" fill="#fff"/><circle cx="31" cy="48" r="3.6" fill="#fff6e6"/>${STEAM}`),
].join("");

const PROPS = { A: PROPS_A, B: PROPS_B };

function buildShelf(seed: number, slotKey: "A" | "B", slotRow: number, slotFirst: boolean) {
  const r = rng(seed);
  let h = "";
  for (let row = 0; row < 6; row++) {
    let books = "";
    const lean = 1 + Math.floor(r() * 12);
    for (let i = 0; i < 20; i++) {
      const w = 11 + Math.floor(r() * 16);
      const ht = 56 + Math.floor(r() * 38);
      const c = 1 + Math.floor(r() * 5);
      books += `<i class="ls-book ls-b${c}${i === lean ? " ls-lean" : ""}" style="--ls-w:${w}px;--ls-h:${ht}"></i>`;
    }
    const slot = row === slotRow ? `<div class="ls-slot">${PROPS[slotKey]}</div>` : "";
    h += `<div class="ls-row">${slotFirst ? slot : ""}<div class="ls-books">${books}</div>${slotFirst ? "" : slot}</div>`;
  }
  return h;
}

const SHELF_L = buildShelf(7, "A", 1, false);
const SHELF_R = buildShelf(23, "B", 2, true);

const WINDOW_HTML = (() => {
  const r = rng(5);
  let stars = "";
  for (let i = 0; i < 34; i++) {
    stars += `<circle cx="${Math.round(r() * 900)}" cy="${Math.round(r() * 380)}" r="${(r() * 1.4 + 0.6).toFixed(1)}"/>`;
  }
  let blossoms = "";
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.283;
    const d = Math.sqrt(r()) * 105;
    blossoms += `<circle cx="${Math.round(Math.cos(a) * d * 1.05)}" cy="${Math.round(-300 + Math.sin(a) * d * 0.95)}" r="${(r() * 3 + 4).toFixed(1)}"/>`;
  }
  return `<svg viewBox="0 0 900 780" preserveAspectRatio="xMidYMax slice">
<defs>
<linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ls-c-sky-top)"/><stop offset="1" style="stop-color:var(--ls-c-sky-bot)"/></linearGradient>
<g id="ls-tree">
<path class="ls-trunk" stroke-width="24" d="M0 0C4 -80 -6 -150 6 -232"/>
<path class="ls-trunk" stroke-width="11" d="M4 -140C-30 -170 -50 -190 -70 -240"/>
<path class="ls-trunk" stroke-width="11" d="M5 -170C40 -200 60 -215 84 -262"/>
<path class="ls-trunk" stroke-width="12" d="M6 -230C4 -270 8 -300 0 -334"/>
<g class="ls-foliage">
<circle class="ls-dk" cx="-74" cy="-250" r="58"/><circle class="ls-dk" cx="78" cy="-258" r="60"/>
<circle cx="0" cy="-300" r="80"/><circle cx="-34" cy="-352" r="52"/><circle cx="42" cy="-348" r="54"/>
<circle class="ls-dk" cx="-6" cy="-250" r="44"/>
</g>
<g class="ls-blossoms">${blossoms}</g>
<g class="ls-snowcap">
<ellipse cx="-52" cy="-213" rx="30" ry="6" transform="rotate(-38 -52 -213)"/>
<ellipse cx="62" cy="-226" rx="32" ry="6" transform="rotate(38 62 -226)"/>
<ellipse cx="3" cy="-300" rx="22" ry="6"/>
</g>
</g>
</defs>
<rect class="ls-sky" width="900" height="780"/>
<g class="ls-stars">${stars}</g>
<g class="ls-sunwrap"><circle class="ls-halo" r="66"/><circle class="ls-sun" r="30"/></g>
<g class="ls-cloud" style="--ls-d:110s;--ls-dl:-20s"><g transform="translate(0 150)"><ellipse rx="64" ry="19"/><ellipse cx="42" cy="-10" rx="40" ry="16"/><ellipse cx="-38" cy="-6" rx="34" ry="14"/></g></g>
<g class="ls-cloud" style="--ls-d:150s;--ls-dl:-90s"><g transform="translate(0 260)"><ellipse rx="52" ry="15"/><ellipse cx="34" cy="-9" rx="32" ry="13"/></g></g>
<g class="ls-cloud" style="--ls-d:130s;--ls-dl:-60s"><g transform="translate(0 70)"><ellipse rx="44" ry="13"/><ellipse cx="-30" cy="-6" rx="28" ry="11"/></g></g>
<path class="ls-hill-far" d="M0 560C200 500 380 540 560 520S800 500 900 540V780H0Z"/>
<use href="#ls-tree" transform="translate(770 640) scale(.78)"/>
<path class="ls-hill-near" d="M0 650C220 600 420 660 640 630S820 610 900 640V780H0Z"/>
<use href="#ls-tree" transform="translate(150 680) scale(1.2)"/>
</svg><i class="ls-transom"></i>`;
})();

/* ---------- guirlande ---------- */

function garlandItem(s: LoginSeason, x: number, y: number, ang: number, i: number): string {
  const t = `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
  if (s === "spring") {
    const c = ["#f4a7be", "#fff", "#f7c96a"][i % 3];
    const petals = Array.from({ length: 5 }, (_, k) => {
      const a = k * 1.2566;
      return `<circle cx="${(Math.cos(a) * 4.6).toFixed(1)}" cy="${(Math.sin(a) * 4.6 + 6).toFixed(1)}" r="3.6" fill="${c}"/>`;
    }).join("");
    return `<g transform="${t}"><ellipse cx="8" cy="4" rx="6" ry="2.6" fill="#7fb36a" transform="rotate(25 8 4)"/>${petals}<circle cy="6" r="2.4" fill="#f2b91f"/></g>`;
  }
  if (s === "summer") {
    const c = ["#e8735a", "#f0c24a", "#2a8793", "#8fd0b4", "#2d4170"][i % 5];
    return `<path d="M-9 0H9L0 24Z" fill="${c}" transform="${t} rotate(${ang.toFixed(1)})"/>`;
  }
  if (s === "autumn") {
    const c = ["#d9742b", "#b84a22", "#e2a21f", "#8f3a1c"][i % 4];
    return `<g transform="${t} rotate(${(ang + (i % 2 ? 14 : -14)).toFixed(1)})"><path d="M0 0V5" stroke="#6a3b1e" stroke-width="1.5"/><path d="M0 4C10 8 11 20 0 30 -11 20 -10 8 0 4Z" fill="${c}"/><path d="M0 6V26" stroke="rgb(0 0 0 / .25)" stroke-width="1"/></g>`;
  }
  const c = ["#ffd36a", "#ff8a7a", "#9ad7ff", "#ffe9a8"][i % 4];
  return `<g transform="${t}"><path d="M0 0v6" stroke="#2c2c2c" stroke-width="1.6"/><circle class="ls-bulb" style="color:${c};animation-delay:${(-((i * 0.37) % 2.6)).toFixed(2)}s" cy="11" r="5" fill="${c}"/></g>`;
}

function buildGarland(el: SVGSVGElement, width: number, season: LoginSeason) {
  if (season === "none") {
    el.innerHTML = "";
    return;
  }
  const W = Math.max(320, width);
  let n = Math.max(2, Math.round(W / 380));
  if (n % 2) n++;
  const seg = W / n;
  const sag = 54;
  const y0 = 6;
  let cord = "";
  let items = "";
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const x0 = k * seg;
    const x1 = (k + 1) * seg;
    const cx = (x0 + x1) / 2;
    const cy = y0 + sag * 2;
    cord += `M${x0.toFixed(1)} ${y0} Q${cx.toFixed(1)} ${cy} ${x1.toFixed(1)} ${y0} `;
    const cnt = Math.max(5, Math.round(seg / 46));
    for (let i = 1; i < cnt; i++) {
      const t = i / cnt;
      const m = 1 - t;
      const x = m * m * x0 + 2 * m * t * cx + t * t * x1;
      const y = m * m * y0 + 2 * m * t * cy + t * t * y0;
      const dx = 2 * m * (cx - x0) + 2 * t * (x1 - cx);
      const dy = 2 * m * (cy - y0) + 2 * t * (y0 - cy);
      items += garlandItem(season, x, y, (Math.atan2(dy, dx) * 180) / Math.PI, idx++);
    }
  }
  el.setAttribute("viewBox", `0 0 ${W} 100`);
  el.innerHTML = `<path d="${cord}" fill="none" stroke="var(--ls-c-wood-dk)" stroke-width="2"/>${items}`;
  el.classList.remove("ls-in");
  void el.getBoundingClientRect();
  el.classList.add("ls-in");
}

/* ---------- particules ---------- */

type Particle = {
  x: number; y: number; ph: number; f: number; rot: number; vr: number; c: string;
  s: number; vy: number; vx: number; amp: number; a?: number;
};

const COLORS: Record<Exclude<LoginSeason, "none">, string[]> = {
  spring: ["#f6b8cb", "#f9d0dc", "#f2a0b8", "#ffffff"],
  autumn: ["#d9742b", "#b84a22", "#e2a21f", "#8f3a1c", "#c4572a"],
  summer: ["#ffe27a", "#fff2b0", "#ffd24d"],
  winter: ["#ffffff"],
};

function makeParticle(t: Exclude<LoginSeason, "none">, W: number, H: number): Particle {
  const R = Math.random;
  const p: Particle = {
    x: R() * W, y: R() * H, ph: R() * 6.28, f: 0.5 + R(), rot: R() * 6.28, vr: (R() - 0.5) * 0.05,
    c: COLORS[t][Math.floor(R() * COLORS[t].length)], s: 0, vy: 0, vx: 0, amp: 0,
  };
  if (t === "spring") { p.s = 4.5 + R() * 4; p.vy = 0.45 + R() * 0.7; p.vx = 0.25; p.amp = 0.45; }
  else if (t === "autumn") { p.s = 8 + R() * 8; p.vy = 0.7 + R() * 0.9; p.vx = 0.1; p.amp = 0.6; p.vr *= 1.6; }
  else if (t === "winter") { p.s = 1.2 + R() * 2.8; p.vy = 0.35 + R(); p.vx = 0; p.amp = 0.3; p.a = 0.55 + R() * 0.4; p.vr = 0; }
  else { p.s = 1.6 + R() * 1.8; p.vy = -(0.12 + R() * 0.3); p.vx = 0.1; p.amp = 0.25; p.vr = 0; }
  return p;
}

/* ---------- composant ---------- */

export function LoginScene({ children }: { children: (ctx: { season: LoginSeason }) => ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const garlandRef = useRef<SVGSVGElement>(null);
  const [season, setSeason] = useState<LoginSeason>("none");
  const [night, setNight] = useState(false);

  // Saison (calendrier de l'app, ou aperçu via ?saison=) et thème du soir
  // (choix mémorisé, sinon préférence du téléphone/ordinateur).
  useIsoLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = PREVIEW_PARAM[params.get("saison") ?? ""];
    const theme = getCurrentSeasonalTheme();
    setSeason(preview ?? (theme ? THEME_TO_SEASON[theme.id] ?? "none" : "none"));

    let dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      const saved = window.localStorage.getItem(NIGHT_KEY);
      if (saved === "1") dark = true;
      else if (saved === "0") dark = false;
    } catch { /* stockage indisponible : on garde la préférence système */ }
    if (params.get("soir") === "1") dark = true;
    setNight(dark);
  }, []);

  const toggleNight = () => {
    setNight((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(NIGHT_KEY, next ? "1" : "0"); } catch { /* ignoré */ }
      return next;
    });
  };

  // Particules + guirlande : relancées à chaque changement de saison.
  useEffect(() => {
    const root = rootRef.current;
    const cv = canvasRef.current;
    const garland = garlandRef.current;
    if (!root || !cv || !garland) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, dpr = 1, fade = 0, night01 = 0, last = 0, frame = 0, raf = 0;
    let parts: Particle[] = [];

    const seed = () => {
      if (season === "none") { parts = []; return; }
      const n = Math.max(22, Math.min(120, Math.round((W * H) / (season === "winter" ? 8500 : 16000))));
      parts = Array.from({ length: n }, () => makeParticle(season, W, H));
    };

    const render = (ts: number, dt: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (dt) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(ts * 0.0012 * p.f + p.ph) * p.amp) * dt;
          p.rot += p.vr * dt;
          if (p.vy > 0 && p.y > H + 30) { p.y = -30; p.x = Math.random() * W; }
          if (p.vy < 0 && p.y < -30) { p.y = H + 30; p.x = Math.random() * W; }
          if (p.x > W + 40) p.x = -40; else if (p.x < -40) p.x = W + 40;
        }
        ctx.globalAlpha = fade;
        if (season === "winter") {
          ctx.globalAlpha = fade * (p.a ?? 0.8);
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        } else if (season === "summer") {
          const tw = 0.5 + 0.5 * Math.sin(ts * 0.002 * p.f + p.ph);
          const r = p.s * (2.2 + night01 * 5.5);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, p.c); g.addColorStop(1, "rgba(255,226,122,0)");
          ctx.globalAlpha = fade * (0.35 + 0.55 * (night01 ? tw : 1));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.beginPath();
          if (season === "spring") ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283);
          else { const s = p.s; ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.95, -s * 0.2, 0, s); ctx.quadraticCurveTo(-s * 0.95, -s * 0.2, 0, -s); }
          ctx.fill();
          if (season === "autumn") {
            ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s); ctx.stroke();
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (ts: number) => {
      const dt = Math.min(2.5, (ts - last) / 16.67 || 1);
      last = ts;
      if (++frame % 15 === 0) night01 = parseFloat(getComputedStyle(root).getPropertyValue("--ls-night")) || 0;
      if (fade < 1) fade = Math.min(1, fade + 0.02);
      render(ts, dt);
      raf = requestAnimationFrame(loop);
    };

    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = root.clientWidth; H = root.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      seed();
      buildGarland(garland, W, season);
      if (reduce) { fade = 1; render(0, 0); }
    };

    const ro = new ResizeObserver(size);
    ro.observe(root);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [season]);

  return (
    <div className="ls-viewport">
      <div ref={rootRef} className="ls-root" data-season={season} data-night={night ? "1" : "0"}>
        <div className="ls-layer ls-wall" />
        <div className="ls-layer ls-window" aria-hidden="true" dangerouslySetInnerHTML={{ __html: WINDOW_HTML }} />
        <div className="ls-layer ls-wainscot" />
        <div className="ls-layer ls-floor" />
        <div className="ls-shelf ls-l" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHELF_L }} />
        <div className="ls-shelf ls-r" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHELF_R }} />
        <svg ref={garlandRef} className="ls-layer ls-garland" aria-hidden="true" />
        <div className="ls-layer ls-lamp ls-l" aria-hidden="true"><i className="ls-glow" /><i className="ls-cord" /><i className="ls-shade" /><i className="ls-bulbl" /></div>
        <div className="ls-layer ls-lamp ls-r" aria-hidden="true"><i className="ls-glow" /><i className="ls-cord" /><i className="ls-shade" /><i className="ls-bulbl" /></div>
        <canvas ref={canvasRef} className="ls-layer ls-fx" aria-hidden="true" />
        <div className="ls-layer ls-vignette" />

        <button type="button" className="ls-nightbtn" aria-pressed={night} onClick={toggleNight}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
          Lecture du soir <span className="ls-track" aria-hidden="true" />
        </button>

        {children({ season })}
      </div>
    </div>
  );
}
