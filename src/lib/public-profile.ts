import { doc, setDoc, deleteDoc, type Firestore } from "firebase/firestore";
import { cleanBookTitle, cleanAuthorName, getBookQuotes, sortBySaga, toArray } from "@/lib/utils";

/**
 * "Profil visible" : la lectrice choisit ce qu'elle montre sur une page de
 * profil en lecture seule, accessible sans compte via un lien privé.
 *
 * Deux endroits, volontairement séparés :
 *  - users/{uid}.visibleProfile : ses réglages (privé, jamais lu par d'autres) ;
 *  - profileShares/{token} : la copie publique, lisible UNIQUEMENT par
 *    jeton exact (get), jamais listable. On n'y met que ce qu'elle a coché,
 *    et le document est supprimé dès qu'elle désactive ou renouvelle le
 *    lien. Elle n'est jamais mélangée à publicProfiles (annuaire communauté).
 *
 * Règle Firestore à ajouter dans la console (voir README de la fonctionnalité) :
 *   match /profileShares/{token} {
 *     allow get: if true;
 *     allow list: if false;
 *     allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
 *     allow update: if request.auth != null && resource.data.uid == request.auth.uid
 *                   && request.resource.data.uid == request.auth.uid;
 *     allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
 *   }
 */

export type ProfileTheme = "creme" | "nuit" | "saison";

export type ShowFlags = {
  review: boolean;
  pepites: boolean;
  quotes: boolean;
  medals: boolean;
  wishlist: boolean;
  pal: boolean;
};

export type VisibleSettings = {
  shareActive: boolean;
  shareToken: string;
  theme: ProfileTheme;
  show: ShowFlags;
  reviewBookId: string | null;
  quoteKeys: (string | null)[];
};

export const DEFAULT_SETTINGS: VisibleSettings = {
  shareActive: false,
  shareToken: "",
  theme: "creme",
  show: { review: true, pepites: true, quotes: true, medals: true, wishlist: true, pal: true },
  reviewBookId: null,
  quoteKeys: [null, null],
};

export type ShowcaseBook = { id: string; t: string; a: string; c: string };
export type ShareReview = { id: string; t: string; a: string; c: string; r: number; x: string; d: string };
export type ShareQuote = { x: string; s: string };
export type ShareMedal = { l: string; lv: string; n: number };

export type ShareDoc = {
  uid: string;
  name: string;
  avatarUrl: string;
  bio: string;
  favoriteGenres: string[];
  theme: ProfileTheme;
  show: ShowFlags;
  review: ShareReview | null;
  pepites: ShowcaseBook[];
  quotes: ShareQuote[];
  medals: ShareMedal[];
  wishlist: ShowcaseBook[];
  pal: ShowcaseBook[];
};

export function mergeSettings(raw: Partial<VisibleSettings> | undefined | null): VisibleSettings {
  const r = raw || {};
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    show: { ...DEFAULT_SETTINGS.show, ...(r.show || {}) },
    quoteKeys: [r.quoteKeys?.[0] ?? null, r.quoteKeys?.[1] ?? null],
  };
}

export function newShareToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const LIST_CAP = 500;

const toShowcase = (b: any): ShowcaseBook => ({
  id: String(b.id),
  t: cleanBookTitle(b.title || "").slice(0, 120),
  a: cleanAuthorName(b.author || "").slice(0, 80),
  c: typeof b.cover === "string" ? b.cover : "",
});

export type QuoteCandidate = { key: string; text: string; source: string };

export function listQuoteCandidates(books: any[], saved: any[]): QuoteCandidate[] {
  const out: QuoteCandidate[] = [];
  books.forEach((b) => {
    getBookQuotes(b).forEach((q, i) => {
      if (q && q.trim()) out.push({ key: `b:${b.id}:${i}`, text: q.trim(), source: `${cleanBookTitle(b.title || "")} · ${cleanAuthorName(b.author || "")}` });
    });
  });
  saved.forEach((q) => {
    if (q?.text) out.push({ key: `s:${q.id}`, text: String(q.text), source: String(q.author || "") });
  });
  return out;
}

export type ReviewCandidate = { id: string; title: string; rating: number; date: string };

function bookDate(b: any): string {
  const raw = b.readEndDate || b.readStartDate || b.dateRead;
  const d = raw ? (raw.toDate ? raw.toDate() : new Date(raw)) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString() : "";
}

export function listReviewCandidates(books: any[]): ReviewCandidate[] {
  return books
    .filter((b) => (b.status === "read" || b.status === "reread") && typeof b.review === "string" && b.review.trim().length > 0)
    .map((b) => ({ id: String(b.id), title: cleanBookTitle(b.title || ""), rating: Number(b.rating) || 0, date: bookDate(b) }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

const LEVELS = [
  { label: "Bronze", min: 5 },
  { label: "Argent", min: 15 },
  { label: "Or", min: 50 },
  { label: "Diamant", min: 100 },
];

async function computeMedals(readBooks: any[]): Promise<ShareMedal[]> {
  // Mêmes paliers et mêmes listes que la page Badges & Médailles ; import
  // différé pour ne pas alourdir le chargement de l'app.
  const lib = await import("@/app/library/page");
  const all: ShareMedal[] = [];
  const count = (names: string[], field: "genres" | "tropes") => {
    const stats: Record<string, number> = {};
    names.forEach((n) => (stats[n] = 0));
    readBooks.forEach((b) => toArray<string>(b[field]).forEach((g) => { if (stats[g] !== undefined) stats[g]++; }));
    Object.entries(stats).forEach(([name, n]) => {
      const level = [...LEVELS].reverse().find((l) => n >= l.min);
      if (level) all.push({ l: name, lv: level.label, n });
    });
  };
  count(lib.GENRES_LIST as string[], "genres");
  count(lib.TROPES_LIST as string[], "tropes");
  const rank = (lv: string) => LEVELS.findIndex((l) => l.label === lv);
  return all.sort((a, b) => rank(b.lv) - rank(a.lv) || b.n - a.n).slice(0, 8);
}

export async function buildShareDoc(args: {
  uid: string;
  profile: any;
  books: any[];
  saved: any[];
  settings: VisibleSettings;
}): Promise<ShareDoc> {
  const { uid, profile, books, saved, settings } = args;
  const s = settings.show;
  const readBooks = books.filter((b) => b.status === "read" || b.status === "reread");

  let review: ShareReview | null = null;
  if (s.review) {
    const cands = listReviewCandidates(books);
    const pick = cands.find((c) => c.id === settings.reviewBookId) || cands[0];
    const b = pick && books.find((x) => String(x.id) === pick.id);
    if (b) {
      review = {
        id: pick.id,
        t: pick.title,
        a: cleanAuthorName(b.author || ""),
        c: typeof b.cover === "string" ? b.cover : "",
        r: pick.rating,
        x: String(b.review).trim().slice(0, 420),
        d: pick.date,
      };
    }
  }

  const quotes: ShareQuote[] = [];
  if (s.quotes) {
    const cands = listQuoteCandidates(books, saved);
    settings.quoteKeys.forEach((k) => {
      const c = k && cands.find((x) => x.key === k);
      if (c) quotes.push({ x: c.text.slice(0, 300), s: c.source });
    });
  }

  return {
    uid,
    name: String(profile?.name || "Lectrice Lectoria").slice(0, 60),
    avatarUrl: String(profile?.avatarUrl || ""),
    bio: String(profile?.bio || "").slice(0, 300),
    favoriteGenres: toArray<string>(profile?.favoriteGenres).slice(0, 12),
    theme: settings.theme,
    show: settings.show,
    review,
    pepites: s.pepites ? sortBySaga(books.filter((b) => b.isRecommended)).slice(0, 12).map(toShowcase) : [],
    quotes,
    medals: s.medals ? await computeMedals(readBooks) : [],
    wishlist: s.wishlist ? sortBySaga(books.filter((b) => b.status === "envie")).slice(0, LIST_CAP).map(toShowcase) : [],
    pal: s.pal ? sortBySaga(books.filter((b) => b.status === "pal")).slice(0, LIST_CAP).map(toShowcase) : [],
  };
}

export async function persistVisibleProfile(args: {
  db: Firestore;
  uid: string;
  profile: any;
  books: any[];
  saved: any[];
  settings: VisibleSettings;
  previousToken?: string;
}): Promise<void> {
  const { db, uid, profile, books, saved, settings, previousToken } = args;
  await setDoc(doc(db, "users", uid), { visibleProfile: settings }, { merge: true });
  const tokenChanged = previousToken && previousToken !== settings.shareToken;
  if (previousToken && (tokenChanged || !settings.shareActive)) {
    try {
      await deleteDoc(doc(db, "profileShares", previousToken));
    } catch {
      /* le document n'existait peut-être pas */
    }
  }
  if (settings.shareActive && settings.shareToken) {
    const data = await buildShareDoc({ uid, profile, books, saved, settings });
    await setDoc(doc(db, "profileShares", settings.shareToken), { ...data, updatedAt: Date.now() });
  }
}
