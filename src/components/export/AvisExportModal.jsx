'use client';
/**
 * AvisExportModal.jsx
 * Modal d'export d'avis stylisé — Lectoria (version gratuite avec filigrane)
 *
 * Placer dans : src/components/export/AvisExportModal.jsx
 *
 * Dépendance à installer :  npm install html-to-image
 *
 * Usage :
 *   import AvisExportModal from '@/components/export/AvisExportModal';
 *   <AvisExportModal isOpen={open} onClose={() => setOpen(false)} book={bookDoc} />
 *
 * Props :
 *   isOpen   {boolean}  — affichage de la modal
 *   onClose  {function} — callback de fermeture
 *   book     {object}   — document Firestore du livre (champs ci-dessous)
 *     title           {string}
 *     author          {string}
 *     plumeRank       {number | 'coup_de_coeur' | 'dnf'}
 *     userNote        {string}   — texte de l'avis
 *     genres          {string[]}
 *     isServicePresse {boolean}
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
  PALETTE, DEFAULT_PALETTE_ENTRY,
  FMTS, TEMPLATES, TEMPLATE_LABELS, NEEDS_PHOTO,
  ELEM_LIST, DEFAULT_ELS,
} from '@/lib/avisExportConstants';

// ─── Helpers ──────────────────────────────────────────────────────────────
function Stars({ count = 4, color }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: 1.5, color }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(count) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-7 h-4 rounded-full relative transition-colors ${on ? 'bg-amber-400' : 'bg-zinc-300 dark:bg-zinc-600'}`}
    >
      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function AvisExportModal({ isOpen, onClose, book = {} }) {

  // ── État ──────────────────────────────────────────────────────────────
  const [fmt, setFmt]           = useState('sq');
  const [tpl, setTpl]           = useState('polaroid');
  const [pal, setPal]           = useState(DEFAULT_PALETTE_ENTRY);
  const [els, setEls]           = useState(DEFAULT_ELS);
  const [items, setItems]       = useState([]);          // stickers & textes
  const [nextId, setNextId]     = useState(1);
  const [photos, setPhotos]     = useState([]);          // photos de fond
  const [phsc, setPhsc]         = useState(100);         // zoom photo
  const [phx, setPhx]           = useState(50);          // position X
  const [phy, setPhy]           = useState(50);          // position Y
  const [phrot, setPhrot]       = useState(0);           // rotation
  const [phflipH, setPhflipH]   = useState(false);
  const [phflipV, setPhflipV]   = useState(false);
  const [stkOutline, setStkOutline] = useState('white');
  const [txtInput, setTxtInput] = useState('');
  const [dragging, setDragging] = useState(null);
  const [exporting, setExporting] = useState(false);

  const cardRef       = useRef(null);
  const photoInputRef = useRef(null);
  const stkInputRef   = useRef(null);

  // ── Données livre ─────────────────────────────────────────────────────
  const bookTitle  = book.title  || 'La Maison des Brumes';
  const bookAuthor = book.author || 'Elara Fontaine';
  const bookRating = book.plumeRank === 'coup_de_coeur' ? 5
                   : typeof book.plumeRank === 'number' ? book.plumeRank : 4;
  const bookFav    = book.plumeRank === 'coup_de_coeur';
  const bookNote   = book.userNote  || '';
  const bookTags   = (book.genres || ['Romance', 'Second Chance', 'Contemporain']).slice(0, 3);
  const bookSP     = !!book.isServicePresse;

  // ── Valeurs dérivées ──────────────────────────────────────────────────
  const fm       = FMTS[fmt];
  const isBold   = tpl === 'bold';
  const p        = pal;
  const sz       = Math.round(fm.w * 0.31);          // taille triangle SP
  const rp       = Math.round(sz * 0.52);             // padding-right anti-overlap
  const effTx    = isBold ? `hsl(${p.h},12%,90%)`    : p.tx;
  const effAc    = isBold ? `hsl(${(p.h+15)%360},70%,72%)` : p.ac;
  const effT1    = isBold ? `hsl(${p.h},25%,30%)`    : p.t1;
  const bgSz     = phsc > 100 ? `${phsc}%` : 'cover';
  const phTransform = [
    `rotate(${phrot}deg)`,
    phrot % 180 !== 0 ? 'scale(1.18)' : '',
    `scaleX(${phflipH ? -1 : 1})`,
    `scaleY(${phflipV ? -1 : 1})`,
  ].filter(Boolean).join(' ');

  const cardBg = tpl === 'polaroid' ? '#ffffff'
               : isBold             ? `hsl(${p.h},50%,22%)`
               : p.bg;

  // ── Drag & drop items ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return;
    const { iid, startMX, startMY, startIX, startIY } = dragging;
    const onMove = (e) => {
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;
      setItems(prev => prev.map(it => it.id !== iid ? it : {
        ...it,
        x: Math.max(0, Math.min(fm.w - 44, startIX + dx)),
        y: Math.max(0, Math.min(fm.h - 44, startIY + dy)),
      }));
    };
    const onUp = () => setDragging(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [dragging, fm.w, fm.h]);

  const startDrag = useCallback((e, item) => {
    e.preventDefault();
    setDragging({ iid: item.id, startMX: e.clientX, startMY: e.clientY, startIX: item.x, startIY: item.y });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────
  const addPhoto = (files) => {
    Array.from(files).forEach(f => {
      const r = new FileReader();
      r.onload = e => setPhotos(prev => [...prev, e.target.result]);
      r.readAsDataURL(f);
    });
  };

  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const addStickerImage = (file) => {
    const r = new FileReader();
    r.onload = e => {
      const id = nextId; setNextId(id + 1);
      setItems(prev => [...prev, {
        id, type: 'img', src: e.target.result,
        outline: stkOutline,
        x: Math.round(20 + Math.random() * (fm.w - 64)),
        y: Math.round(20 + Math.random() * (fm.h - 64)),
        size: 52,
      }]);
    };
    r.readAsDataURL(file);
  };

  const addText = () => {
    const t = txtInput.trim(); if (!t) return;
    const id = nextId; setNextId(id + 1);
    setItems(prev => [...prev, {
      id, type: 'txt', text: t,
      x: Math.round(fm.w * 0.2 + Math.random() * fm.w * 0.3),
      y: Math.round(fm.h * 0.3 + Math.random() * fm.h * 0.2),
    }]);
    setTxtInput('');
  };

  const rotPhoto = (delta) => setPhrot(prev => (prev + delta + 360) % 360);
  const toggleEl = (id)    => setEls(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Export PNG ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const ratio = fm.outW / fm.w;
      const dataUrl = await toPng(cardRef.current, { pixelRatio: ratio });
      const a = document.createElement('a');
      a.download = `lectoria-avis-${(bookTitle || 'avis').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('[AvisExport] Erreur export:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Rendu carte ───────────────────────────────────────────────────────
  const spTriangle = els.sp && bookSP && (
    <svg
      style={{ position: 'absolute', top: 0, right: 0, width: sz, height: sz, zIndex: 6, pointerEvents: 'none' }}
      viewBox={`0 0 ${sz} ${sz}`}
    >
      <polygon points={`${sz},0 0,0 ${sz},${sz}`} fill={p.ac} />
      <text
        x={Math.round(sz * 0.64)} y={Math.round(sz * 0.3)}
        textAnchor="middle" fill={p.isDark ? p.tx : p.bg}
        fontSize={Math.round(sz * 0.21)} fontWeight="900"
        fontFamily="sans-serif" letterSpacing="2"
      >SP</text>
    </svg>
  );

  const watermark = (
    <div style={{
      position: 'absolute', bottom: 8, right: 10, zIndex: 8, pointerEvents: 'none',
      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'sans-serif',
      color: 'rgba(255,255,255,.5)',
      textShadow: '0 0 5px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.4)',
    }}>
      Lectoria
    </div>
  );

  const draggableItems = items.map(item => (
    <div
      key={item.id}
      onMouseDown={e => startDrag(e, item)}
      style={{ position: 'absolute', left: item.x, top: item.y, cursor: 'grab', zIndex: 10, userSelect: 'none', touchAction: 'none' }}
    >
      {item.type === 'img' ? (
        <img
          src={item.src}
          alt=""
          style={{
            width: item.size, height: item.size, objectFit: 'contain', display: 'block',
            filter: item.outline === 'white'
              ? 'drop-shadow(0 0 3px white) drop-shadow(0 0 3px white) drop-shadow(0 0 2px white)'
              : 'drop-shadow(0 0 2.5px black) drop-shadow(0 0 2.5px black)',
          }}
        />
      ) : (
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'white',
          textShadow: '0 1px 4px rgba(0,0,0,.65)',
          whiteSpace: 'nowrap', padding: '2px 5px',
        }}>
          {item.text}
        </span>
      )}
    </div>
  ));

  // ── Templates ─────────────────────────────────────────────────────────
  const renderPolaroid = () => {
    const phH   = Math.round(fm.h * 0.64);
    const photo = photos[0];
    return (
      <>
        {/* Zone photo */}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: phH - 12, overflow: 'hidden', borderRadius: 1 }}>
          {photo ? (
            <div style={{
              width: '100%', height: '100%',
              backgroundImage: `url(${photo})`,
              backgroundPosition: `${phx}% ${phy}%`,
              backgroundSize: bgSz,
              backgroundRepeat: 'no-repeat',
              transform: phTransform,
              transformOrigin: 'center',
            }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: `hsl(${p.h},18%,78%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ fontSize: 22, opacity: 0.3 }}>📷</span>
              <span style={{ fontSize: 9, opacity: 0.3 }}>Ajouter une photo</span>
            </div>
          )}
        </div>

        {/* Bande blanche bas */}
        <div style={{
          position: 'absolute', top: phH, left: 0, right: 0, bottom: 0,
          background: 'white',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4px 14px', gap: 2,
          borderTop: '0.5px solid #e8e8e8',
        }}>
          {els.titre && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'center', lineHeight: 1.2 }}>{bookTitle}</div>
              <div style={{ fontSize: 9.5, color: '#888' }}>{bookAuthor}</div>
            </>
          )}
          {els.note  && <Stars count={bookRating} color="#bbb" />}
          {els.palme && bookFav && <div style={{ fontSize: 9, fontWeight: 600, color: p.ac }}>🏆 Coup de cœur</div>}
          {els.sig   && <div style={{ fontSize: 8, color: '#ccc', letterSpacing: '0.04em', marginTop: 1 }}>@joanaladyna · Lectoria</div>}
        </div>
      </>
    );
  };

  const renderMoodboard = () => {
    const n  = Math.min(photos.length, 4);
    const tw = n > 0 ? 'rgba(255,255,255,.95)' : p.tx;
    const aw = n > 0 ? 'rgba(255,255,255,.9)'  : p.ac;
    const sh = n > 0 ? '0 1px 4px rgba(0,0,0,.5)' : 'none';

    return (
      <>
        {/* Arrière-plan patchwork */}
        {n === 0 && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg,${p.bg} 0%,${p.t1} 42%,${p.bg} 100%)` }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 35% 45%,${p.ac}35 0%,transparent 55%)` }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14 }}>
              <span style={{ fontSize: 9, color: p.tx, opacity: 0.25, textAlign: 'center', padding: '0 20px' }}>Ajoutez des photos<br />pour le patchwork</span>
            </div>
          </>
        )}

        {n === 1 && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${photos[0]})`, backgroundPosition: `${phx}% ${phy}%`, backgroundSize: bgSz, transform: phTransform, transformOrigin: 'center' }} />
          </div>
        )}

        {n === 2 && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {photos.slice(0, 2).map((src, i) => (
              <div key={i} style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ))}
          </div>
        )}

        {n === 3 && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2 }}>
            <div style={{ backgroundImage: `url(${photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', gridRow: '1/3' }} />
            <div style={{ backgroundImage: `url(${photos[1]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ backgroundImage: `url(${photos[2]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          </div>
        )}

        {n >= 4 && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2 }}>
            {photos.slice(0, 4).map((src, i) => (
              <div key={i} style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ))}
          </div>
        )}

        {n > 0 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} />}

        {/* Contenu texte */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: `15px ${rp}px 15px 15px`, zIndex: 2 }}>
          {els.titre && (
            <>
              <div style={{ fontSize: fm.w < 252 ? 13 : 15, fontWeight: 700, lineHeight: 1.2, color: tw, textShadow: sh }}>{bookTitle}</div>
              <div style={{ fontSize: 10, color: tw, opacity: 0.7, marginBottom: 2 }}>{bookAuthor}</div>
            </>
          )}
          {els.note  && <Stars count={bookRating} color={aw} />}
          {els.palme && bookFav && <div style={{ fontSize: 10, fontWeight: 600, color: aw, textShadow: sh }}>🏆 Coup de cœur</div>}
          {els.tags  && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
              {bookTags.map((t, i) => <span key={i} style={{ fontSize: 8.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.2)', color: 'white' }}>{t}</span>)}
            </div>
          )}
          {els.avis && bookNote && (
            <div style={{ fontSize: fm.w < 248 ? 8.5 : 9.5, lineHeight: 1.5, fontStyle: 'italic', color: 'rgba(255,255,255,.85)', marginTop: 5, borderLeft: '2px solid rgba(255,255,255,.5)', paddingLeft: 7 }}>
              &ldquo;{bookNote.slice(0, 100)}{bookNote.length > 100 ? '…' : ''}&rdquo;
            </div>
          )}
          <div style={{ flex: 1 }} />
          {els.sig && <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.42)', textAlign: 'right' }}>@joanaladyna · Lectoria</div>}
        </div>
      </>
    );
  };

  const renderJournal = () => {
    const ml  = 48;
    const txj = '#26200e';
    return (
      <>
        {/* SVG filter interne (nécessaire pour html-to-image) */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="crumple-card">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="12" result="nz" />
              <feDisplacementMap in="SourceGraphic" in2="nz" scale="2.5" />
            </filter>
          </defs>
        </svg>

        {/* Fond papier ligné */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: [
            `linear-gradient(90deg, transparent ${ml - 2}px, #ffb3b3 ${ml - 2}px, #ffb3b3 ${ml}px, transparent ${ml}px)`,
            'repeating-linear-gradient(transparent 0px, transparent 22px, #c5c2ae 22px, #c5c2ae 23px)',
          ].join(','),
          backgroundColor: '#faf8ee',
          filter: 'url(#crumple-card)',
        }} />

        {/* Spirale (points de reliure) */}
        {els.sp && (
          <svg style={{ position: 'absolute', left: 0, top: 0, width: 20, height: fm.h, zIndex: 2 }} viewBox={`0 0 20 ${fm.h}`}>
            {Array.from({ length: 6 }, (_, i) => {
              const y = Math.round(fm.h / 7 * (i + 1));
              return <ellipse key={i} cx="8" cy={y} rx="5" ry="4" fill="#bbb" opacity=".3" />;
            })}
          </svg>
        )}

        {/* Contenu */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: `13px ${rp}px 12px ${ml + 8}px`, zIndex: 3 }}>
          {els.titre && (
            <>
              <div style={{ fontSize: fm.w < 252 ? 13 : 15, fontWeight: 700, lineHeight: 1.25, color: txj, fontFamily: 'Georgia, serif' }}>{bookTitle}</div>
              <div style={{ fontSize: 10, color: txj, opacity: 0.5, marginBottom: 2, fontFamily: 'Georgia, serif' }}>{bookAuthor}</div>
            </>
          )}
          {els.note  && <Stars count={bookRating} color="#b06030" />}
          {els.palme && bookFav && <div style={{ fontSize: 10, fontWeight: 600, color: '#b06030' }}>🏆 Coup de cœur</div>}
          {els.tags  && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
              {bookTags.map((t, i) => <span key={i} style={{ fontSize: 8.5, padding: '2px 6px', borderRadius: 3, background: 'rgba(176,96,48,.1)', color: txj, border: '0.5px solid rgba(176,96,48,.25)' }}>{t}</span>)}
            </div>
          )}
          {els.avis && bookNote && (
            <div style={{ fontSize: fm.w < 248 ? 8.5 : 9.5, lineHeight: 1.7, fontStyle: 'italic', color: txj, opacity: 0.75, marginTop: 4, fontFamily: 'Georgia, serif' }}>
              &ldquo;{bookNote.slice(0, 100)}{bookNote.length > 100 ? '…' : ''}&rdquo;
            </div>
          )}
          <div style={{ flex: 1 }} />
          {els.sig && <div style={{ fontSize: 8.5, color: txj, opacity: 0.35, textAlign: 'right', fontFamily: 'Georgia, serif' }}>@joanaladyna · Lectoria</div>}
        </div>
      </>
    );
  };

  const renderMinimalBold = () => (
    <>
      {isBold && <div style={{ position: 'absolute', right: 8, top: 6, fontSize: 40, fontWeight: 900, opacity: 0.07, color: 'white', lineHeight: 1, pointerEvents: 'none', zIndex: 1 }}>★</div>}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: `16px ${rp}px 16px 16px`, zIndex: 1 }}>
        {els.titre && (
          <>
            <div style={{ fontSize: fm.w < 252 ? 13 : 15, fontWeight: 700, lineHeight: 1.25, color: effTx }}>{bookTitle}</div>
            <div style={{ fontSize: 10, color: effTx, opacity: 0.6, marginBottom: 2 }}>{bookAuthor}</div>
          </>
        )}
        {els.note  && <Stars count={bookRating} color={effAc} />}
        {els.palme && bookFav && <div style={{ fontSize: 10, fontWeight: 600, color: effAc }}>🏆 Coup de cœur</div>}
        {els.tags  && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
            {bookTags.map((t, i) => <span key={i} style={{ fontSize: 8.5, padding: '2px 6px', borderRadius: 20, background: effT1, color: effTx, opacity: 0.9 }}>{t}</span>)}
          </div>
        )}
        {els.avis && bookNote && (
          <div style={{ fontSize: fm.w < 248 ? 8.5 : 9.5, lineHeight: 1.5, fontStyle: 'italic', color: effTx, opacity: 0.8, marginTop: 5, borderLeft: `2px solid ${effAc}`, paddingLeft: 7 }}>
            &ldquo;{bookNote.slice(0, 100)}{bookNote.length > 100 ? '…' : ''}&rdquo;
          </div>
        )}
        <div style={{ flex: 1 }} />
        {els.sig && <div style={{ fontSize: 8.5, color: effTx, opacity: 0.38, textAlign: 'right' }}>@joanaladyna · Lectoria</div>}
      </div>
    </>
  );

  // ── Modal ─────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const borderRadius = { polaroid: 2, moodboard: 12, journal: 2, minimal: 16, bold: 0 }[tpl] || 8;
  const needsPhoto   = NEEDS_PHOTO.includes(tpl);
  const hasPhotos    = photos.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Exporter l'avis — {bookTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-3">

          {/* ── Contrôles ligne 1 : Format + Template ─────────────────── */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 w-14 shrink-0">Format</span>
              <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                {Object.entries(FMTS).map(([key, val]) => (
                  <button key={key} onClick={() => setFmt(key)}
                    className={`px-3 py-1.5 text-xs border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 transition-colors ${fmt === key ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-100' : 'bg-transparent text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400 w-14 shrink-0">Template</span>
              <div className="flex gap-1.5 flex-wrap">
                {TEMPLATES.map(t => (
                  <button key={t} onClick={() => setTpl(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${tpl === t ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300'}`}>
                    {TEMPLATE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Palette couleur ───────────────────────────────────────── */}
          <div className="flex items-start gap-2">
            <span className="text-xs text-zinc-400 w-14 shrink-0 mt-1">Fond</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 20px)', gap: '2px', borderRadius: 4, overflow: 'hidden' }}>
              {PALETTE.map((row, ri) => row.map((entry, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  onClick={() => setPal(entry)}
                  title={`Teinte ${entry.h}° · ${entry.l}% luminosité`}
                  style={{
                    width: 20, height: 18,
                    background: entry.bg,
                    cursor: 'pointer',
                    boxShadow: pal === entry ? 'inset 0 0 0 2.5px white, inset 0 0 0 4.5px rgba(0,0,0,.18)' : 'none',
                    transition: 'transform .1s',
                    zIndex: pal === entry ? 3 : 1,
                  }}
                  className="hover:scale-125 hover:z-10"
                />
              )))}
            </div>
          </div>

          {/* ── Photos (polaroid + moodboard) ────────────────────────── */}
          {needsPhoto && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-400 w-14 shrink-0">Photos</span>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  + Ajouter
                </button>
                <div className="flex gap-1.5">
                  {photos.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt="" className="w-7 h-7 object-cover rounded border border-zinc-200" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center leading-none"
                      >×</button>
                    </div>
                  ))}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhoto(e.target.files); e.target.value = ''; }} />
              </div>

              {hasPhotos && (
                <div className="flex items-center gap-3 flex-wrap pl-16">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">Zoom</span>
                    <input type="range" min="100" max="300" step="5" value={phsc} onChange={e => setPhsc(+e.target.value)} className="w-16 accent-amber-500" style={{ height: 4 }} />
                    <span className="text-xs text-zinc-400 w-8">{phsc}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">X</span>
                    <input type="range" min="0" max="100" value={phx} onChange={e => setPhx(+e.target.value)} className="w-12 accent-amber-500" style={{ height: 4 }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">Y</span>
                    <input type="range" min="0" max="100" value={phy} onChange={e => setPhy(+e.target.value)} className="w-12 accent-amber-500" style={{ height: 4 }} />
                  </div>
                  <div className="flex items-center gap-1">
                    {[[-90, '↺'], [90, '↻']].map(([d, lbl]) => (
                      <button key={d} onClick={() => rotPhoto(d)}
                        className="w-7 h-7 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center transition-colors">
                        {lbl}
                      </button>
                    ))}
                    <button onClick={() => setPhflipH(v => !v)} className={`w-7 h-7 text-sm border rounded-lg flex items-center justify-center transition-colors ${phflipH ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100'}`}>↔</button>
                    <button onClick={() => setPhflipV(v => !v)} className={`w-7 h-7 text-sm border rounded-lg flex items-center justify-center transition-colors ${phflipV ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100'}`}>↕</button>
                    <span className="text-xs text-zinc-400 ml-1">{phrot}°</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Zone principale : carte + panneau ─────────────────────── */}
          <div className="flex gap-4">

            {/* Aperçu carte */}
            <div className="flex-1 flex justify-center items-start">
              <div>
                <div
                  ref={cardRef}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: fm.w,
                    height: fm.h,
                    borderRadius,
                    background: cardBg,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: tpl === 'polaroid'
                      ? '0 4px 22px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.08)'
                      : '0 4px 22px rgba(0,0,0,.18)',
                    flexShrink: 0,
                  }}
                >
                  {tpl === 'polaroid'  && renderPolaroid()}
                  {tpl === 'moodboard' && renderMoodboard()}
                  {tpl === 'journal'   && renderJournal()}
                  {(tpl === 'minimal' || tpl === 'bold') && renderMinimalBold()}
                  {spTriangle}
                  {draggableItems}
                  {watermark}
                </div>
                <p className="text-center text-xs text-zinc-400 mt-2">{fm.label} px</p>
                <p className="text-center text-xs text-zinc-300 dark:text-zinc-600">Glisse les stickers/textes pour les repositionner</p>
              </div>
            </div>

            {/* Panneau latéral */}
            <div className="w-48 shrink-0 space-y-2.5">

              {/* Sticker perso */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sticker perso</p>
                <button
                  onClick={() => stkInputRef.current?.click()}
                  className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-xs text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  + Importer PNG / JPG
                </button>
                <div className="flex gap-1.5 items-center">
                  {['white', 'black'].map(t => (
                    <button key={t} onClick={() => setStkOutline(t)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${stkOutline === t ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>
                      {t === 'white' ? 'Blanc' : 'Noir'}
                    </button>
                  ))}
                  <span className="text-xs text-zinc-300 dark:text-zinc-600">PNG = ✓</span>
                </div>
                <input ref={stkInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files[0]) addStickerImage(e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Texte libre */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Texte libre</p>
                <div className="flex gap-1">
                  <input
                    value={txtInput} onChange={e => setTxtInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addText()}
                    placeholder="Mon texte…" maxLength={50}
                    className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 placeholder-zinc-300 min-w-0 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button onClick={addText} className="px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-medium">+</button>
                </div>
              </div>

              {/* Éléments */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Éléments</p>
                <div className="space-y-1">
                  {ELEM_LIST.filter(({ id }) => id !== 'sp' || bookSP).map(({ id, label }) => (
                    <div key={id} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                      <Toggle on={els[id]} onToggle={() => toggleEl(id)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Supprimer items */}
              {items.length > 0 && (
                <button onClick={() => setItems([])} className="w-full text-xs text-zinc-400 hover:text-red-400 transition-colors py-1">
                  Effacer tous les stickers / textes
                </button>
              )}
            </div>
          </div>

          {/* ── Footer : export ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <p className="text-xs text-zinc-400">Version gratuite · filigrane Lectoria inclus</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                {exporting ? '⏳ Export…' : '↓ Télécharger PNG'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
