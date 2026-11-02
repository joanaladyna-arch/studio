"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc, collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDoc, useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { BookCover } from "@/components/book-cover";
import { ADMIN_EMAILS, cleanAuthorName, cleanBookTitle, cn } from "@/lib/utils";
import { GENRES_LIST, TROPES_LIST } from "@/app/library/page";
import { notifyUser, prefillLink, relativeTime, reportContent, RULES_HINT, type RecoAnswer, type RecoRequest } from "@/lib/salon";

const MAX_TAGS = 3;
const ALL_TAGS: string[] = [...(GENRES_LIST as string[]), ...(TROPES_LIST as string[])];

type Found = { id: string; title: string; author: string; cover: string };

async function searchCatalog(db: any, term: string): Promise<Found[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const variants = Array.from(new Set([t, t.charAt(0).toUpperCase() + t.slice(1), t.replace(/\b\w/g, (c) => c.toUpperCase())]));
  const out = new Map<string, Found>();
  for (const v of variants) {
    const snap = await getDocs(query(collection(db, "masterBooks"), orderBy("title"), where("title", ">=", v), where("title", "<=", v + ""), limit(6)));
    snap.docs.forEach((d) => {
      const x: any = d.data();
      out.set(d.id, { id: d.id, title: cleanBookTitle(x.title || ""), author: cleanAuthorName(x.author || ""), cover: x.cover || "" });
    });
    if (out.size >= 6) break;
  }
  return Array.from(out.values()).slice(0, 6);
}

function Who({ name, avatarUrl, when }: { name: string; avatarUrl?: string; when: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10"><AvatarImage src={avatarUrl} className="object-cover" /><AvatarFallback className="font-headline italic">{(name || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
      <div><p className="font-headline italic text-base leading-tight">{name}</p><p className="text-xs text-muted-foreground">{when}</p></div>
    </div>
  );
}

function ProposeBook({ requestId, ownerUid, onDone }: { requestId: string; ownerUid: string; onDone: () => void }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!db || picked || term.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => searchCatalog(db, term).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [term, db, picked]);

  const submit = async () => {
    if (!db || !user || !picked) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "recoRequests", requestId, "answers"), {
        uid: user.uid,
        name: (profile as any)?.name || "Lectrice Lisoria",
        avatarUrl: (profile as any)?.avatarUrl || "",
        title: picked.title, author: picked.author, cover: picked.cover, masterBookId: picked.id,
        note: note.trim().slice(0, 120),
        createdAt: serverTimestamp(),
      });
      notifyUser(db, user, ownerUid, {
        type: "reco_answer",
        title: "Une lectrice a répondu à ta demande",
        body: `${(profile as any)?.name || "Une lectrice"} te conseille « ${picked.title} ».`,
        link: "/community",
      });
      setPicked(null); setTerm(""); setNote("");
      onDone();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Proposition impossible", description: err?.code === "permission-denied" ? RULES_HINT : "Réessaie dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      {picked ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white/70 p-2">
          <div className="relative h-14 w-10 rounded-md overflow-hidden shrink-0"><BookCover src={picked.cover} alt={picked.title} className="object-cover" /></div>
          <div className="min-w-0 flex-1"><p className="font-headline italic leading-tight truncate">{picked.title}</p><p className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">{picked.author}</p></div>
          <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setPicked(null)}>Changer</button>
        </div>
      ) : (
        <>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Proposer un livre du catalogue…" aria-label="Proposer un livre" className="h-11 rounded-full bg-white/70 border-none px-5" />
          {results.length > 0 && (
            <div className="rounded-2xl bg-white/80 divide-y divide-primary/10 overflow-hidden">
              {results.map((r) => (
                <button key={r.id} type="button" onClick={() => setPicked(r)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-primary/5">
                  <div className="relative h-12 w-8 rounded-sm overflow-hidden shrink-0"><BookCover src={r.cover} alt={r.title} className="object-cover" /></div>
                  <div className="min-w-0"><p className="font-headline italic text-sm leading-tight truncate">{r.title}</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{r.author}</p></div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {picked && (
        <>
          <Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Un petit mot (facultatif)" aria-label="Petit mot" className="h-11 rounded-full bg-white/70 border-none px-5" />
          <Button type="button" onClick={submit} disabled={busy} className="rounded-full">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Proposer ce livre</Button>
        </>
      )}
    </div>
  );
}

function RequestCard({ req, isAdmin, onDeleted }: { req: RecoRequest; isAdmin: boolean; onDeleted: () => void }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<RecoAnswer[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const loadCount = () => {
    if (!db) return;
    getCountFromServer(collection(db, "recoRequests", req.id, "answers")).then((s) => setCount(s.data().count)).catch(() => setCount(0));
  };
  const loadAnswers = () => {
    if (!db) return;
    getDocs(query(collection(db, "recoRequests", req.id, "answers"), orderBy("createdAt", "asc")))
      .then((snap) => { const l = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecoAnswer)); setAnswers(l); setCount(l.length); })
      .catch(() => setAnswers([]));
  };
  useEffect(loadCount, [db, req.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && answers === null) loadAnswers(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = async (path: string) => {
    if (!db || !user) return;
    try {
      await reportContent(db, user.uid, path.includes("/answers/") ? "answer" : "request", path);
      setReported((s) => new Set(s).add(path));
      toast({ title: "Signalement envoyé", description: "Merci, on regarde ça." });
    } catch {
      toast({ variant: "destructive", title: "Signalement impossible" });
    }
  };
  const removeAnswer = async (a: RecoAnswer) => {
    if (!db) return;
    try { await deleteDoc(doc(db, "recoRequests", req.id, "answers", a.id)); loadAnswers(); } catch { toast({ variant: "destructive", title: "Suppression impossible" }); }
  };
  const removeRequest = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, "recoRequests", req.id, "answers"));
      await Promise.all(snap.docs.filter((d) => isAdmin || (d.data() as any).uid === user?.uid).map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "recoRequests", req.id));
      onDeleted();
    } catch { toast({ variant: "destructive", title: "Suppression impossible" }); }
  };

  const canDelete = isAdmin || req.uid === user?.uid;
  const reqPath = `recoRequests/${req.id}`;

  return (
    <article className="glass-card bg-white/60 border-none p-5 space-y-3">
      <Who name={req.name} avatarUrl={req.avatarUrl} when={relativeTime(req.createdAt)} />
      <p className="font-headline italic text-xl leading-snug">{req.text}</p>
      {req.tags?.length > 0 && <div className="flex flex-wrap gap-1.5">{req.tags.map((t) => <span key={t} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium">{t}</span>)}</div>}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-rose">
          {open ? "Masquer" : "Voir"} les {count === null ? "" : count} réponse{(count || 0) > 1 ? "s" : ""}
        </button>
        <div className="flex items-center gap-3">
          {canDelete && <button type="button" onClick={removeRequest} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>}
          {req.uid !== user?.uid && (
            <button type="button" disabled={reported.has(reqPath)} onClick={() => report(reqPath)} className="text-xs text-muted-foreground underline underline-offset-4 disabled:no-underline">
              {reported.has(reqPath) ? "Signalée, merci" : "Signaler"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 pt-3 border-t border-dashed border-primary/15">
          {answers === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" /> : answers.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-primary/[0.04] p-2.5">
              <div className="relative h-16 w-11 shrink-0 rounded-md overflow-hidden bg-primary/5"><BookCover src={a.cover} alt={a.title} className="object-cover" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-headline italic text-base leading-tight">{a.title}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{a.author}</p>
                {a.note && <p className="text-xs italic text-muted-foreground mt-1">« {a.note} » <span className="not-italic">· {a.name}</span></p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Link href={prefillLink({ title: a.title, author: a.author, cover: a.cover, masterBookId: a.masterBookId })} className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/10 bg-white px-3 py-1.5 text-xs font-semibold hover:border-rose/50 transition-colors">
                  <Heart className="h-3.5 w-3.5" /> Ajouter
                </Link>
                {(isAdmin || a.uid === user?.uid) ? (
                  <button type="button" onClick={() => removeAnswer(a)} className="text-[11px] text-muted-foreground hover:text-destructive">Supprimer</button>
                ) : (
                  <button type="button" disabled={reported.has(`${reqPath}/answers/${a.id}`)} onClick={() => report(`${reqPath}/answers/${a.id}`)} className="text-[11px] text-muted-foreground underline underline-offset-4 disabled:no-underline">
                    {reported.has(`${reqPath}/answers/${a.id}`) ? "Signalée" : "Signaler"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {answers?.length === 0 && <p className="text-sm italic text-muted-foreground">Pas encore de réponse : sois la première à proposer un livre.</p>}
          <ProposeBook requestId={req.id} ownerUid={req.uid} onDone={() => { loadAnswers(); }} />
        </div>
      )}
    </article>
  );
}

export function RecoTab() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RecoRequest[] | null>(null);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [busy, setBusy] = useState(false);
  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  const load = () => {
    if (!db) return;
    getDocs(query(collection(db, "recoRequests"), orderBy("createdAt", "desc"), limit(30)))
      .then((snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecoRequest))))
      .catch((err) => {
        console.error("Load reco:", err);
        setRequests([]);
        if (err?.code === "permission-denied") toast({ variant: "destructive", title: "Demandes indisponibles", description: RULES_HINT });
      });
  };
  useEffect(load, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= MAX_TAGS ? cur : [...cur, t]));

  const publish = async () => {
    if (!db || !user || !text.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "recoRequests"), {
        uid: user.uid,
        name: (profile as any)?.name || "Lectrice Lisoria",
        avatarUrl: (profile as any)?.avatarUrl || "",
        text: text.trim().slice(0, 140),
        tags,
        createdAt: serverTimestamp(),
      });
      setText(""); setTags([]); setShowTags(false);
      load();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publication impossible", description: err?.code === "permission-denied" ? RULES_HINT : "Réessaie dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card bg-white/60 border-none p-5 space-y-3">
        <p className="font-headline italic text-xl">Poser une demande</p>
        <Textarea value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Que cherches-tu ? Ex. : un thriller psychologique avec une fin surprenante" aria-label="Ta demande" className="rounded-2xl bg-white/70 border-none min-h-[72px] resize-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
          <button type="button" className="underline underline-offset-4" onClick={() => setShowTags((v) => !v)}>
            {showTags ? "Masquer les genres et tropes" : `Ajouter des genres ou tropes (${tags.length}/${MAX_TAGS})`}
          </button>
          <span>{text.length}/140 · Les réponses sont des livres du catalogue.</span>
        </div>
        {tags.length > 0 && !showTags && <div className="flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-full bg-rose/15 px-3 py-1 text-xs font-medium">{t}</span>)}</div>}
        {showTags && (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto" role="group" aria-label="Genres et tropes">
            {ALL_TAGS.map((t) => (
              <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}
                className={cn("rounded-full border-2 px-3 py-1 text-xs font-medium transition-colors", tags.includes(t) ? "border-rose bg-rose/15" : "border-primary/10 bg-white/70 hover:border-rose/50")}>
                {t}
              </button>
            ))}
          </div>
        )}
        <Button type="button" onClick={publish} disabled={busy || !text.trim()} className="rounded-full h-11 px-6">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Publier ma demande</Button>
      </div>

      {requests === null ? (
        <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40" /></div>
      ) : requests.length === 0 ? (
        <div className="glass-card p-10 text-center bg-white/60 border-none"><p className="italic text-muted-foreground">Aucune demande pour l'instant : pose la première !</p></div>
      ) : (
        requests.map((r) => <RequestCard key={r.id} req={r} isAdmin={isAdmin} onDeleted={load} />)
      )}
    </div>
  );
}
