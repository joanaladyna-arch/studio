'use client';
/**
 * AvisExportModal.jsx — version simplifiée
 * Supprimé : photos, stickers image, moodboard, zoom/rotation/flip
 * Conservé  : texte libre draggable, palette couleurs, 4 templates, formats, éléments
 * Ajouté    : export PDF simple
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
  PALETTE, DEFAULT_PALETTE_ENTRY,
  FMTS, TEMPLATES, TEMPLATE_LABELS,
  ELEM_LIST, DEFAULT_ELS,
} from '@/lib/avisExportConstants';

// ─── Templates disponibles (sans Moodboard) ──────────────────────────────
const SIMPLE_TEMPLATES = TEMPLATES.filter(t => t !== 'moodboard');
const SIMPLE_TEMPLATE_LABELS = { polaroid: 'Polaroid', journal: 'Journal', minimal: 'Minimal', bold: 'Bold' };

// ─── Helpers ──────────────────────────────────────────────────────────────
function Stars({ count = 4, color }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: 1.5, color }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ opacity: i <= Math.round(count) ? 1 : 0.25 }}>★</span>)}
    </span>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button onClick={onToggle} className={`w-7 h-4 rounded-full relative transition-colors ${on ? 'bg-amber-400' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function AvisExportModal({ isOpen, onClose, book = {} }) {

  const [fmt, setFmt]         = useState('sq');
  const [tpl, setTpl]         = useState('polaroid');
  const [pal, setPal]         = useState(DEFAULT_PALETTE_ENTRY);
  const [els, setEls]         = useState(DEFAULT_ELS);
  const [items, setItems]     = useState([]);
  const [nextId, setNextId]   = useState(1);
  const [txtInput, setTxtInput] = useState('');
  const [dragging, setDragging] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const cardRef = useRef(null);

  // ── Données livre ────────────────────────────────────────────────────
  const bookTitle  = book.title  || 'La Maison des Brumes';
  const bookAuthor = book.author || 'Elara Fontaine';
  const bookRating = book.plumeRank === 'coup_de_coeur' ? 5 : typeof book.plumeRank === 'number' ? book.plumeRank : 4;
  const bookFav    = book.plumeRank === 'coup_de_coeur';
  const bookNote   = book.userNote || '';
  const bookTags   = (book.genres || ['Romance', 'Second Chance', 'Contemporain']).slice(0, 3);
  const bookSP     = !!book.isServicePresse;

  // ── Valeurs dérivées ─────────────────────────────────────────────────
  const fm     = FMTS[fmt];
  const isBold = tpl === 'bold';
  const p      = pal;
  const sz     = Math.round(fm.w * 0.31);
  const rp     = Math.round(sz * 0.52);
  const effTx  = isBold ? `hsl(${p.h},12%,90%)`                    : p.tx;
  const effAc  = isBold ? `hsl(${(p.h+15)%360},70%,72%)`           : p.ac;
  const effT1  = isBold ? `hsl(${p.h},25%,30%)`                    : p.t1;
  const cardBg = tpl === 'polaroid' ? '#ffffff' : isBold ? `hsl(${p.h},50%,22%)` : p.bg;

  // ── Drag ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return;
    const { iid, startMX, startMY, startIX, startIY } = dragging;
    const onMove = e => {
      const dx = e.clientX - startMX, dy = e.clientY - startMY;
      setItems(prev => prev.map(it => it.id !== iid ? it : {
        ...it,
        x: Math.max(0, Math.min(fm.w - 44, startIX + dx)),
        y: Math.max(0, Math.min(fm.h - 44, startIY + dy)),
      }));
    };
    const onUp = () => setDragging(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, fm.w, fm.h]);

  const startDrag = useCallback((e, item) => {
    e.preventDefault();
    setDragging({ iid: item.id, startMX: e.clientX, startMY: e.clientY, startIX: item.x, startIY: item.y });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────
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

  const toggleEl = id => setEls(prev => ({ ...prev, [id]: !prev[id] }));

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
    } catch (err) { console.error('[AvisExport] PNG:', err); }
    finally { setExporting(false); }
  };

  // ── Export PDF ────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!cardRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      const ratio   = fm.outW / fm.w;
      const imgData = await toPng(cardRef.current, { pixelRatio: ratio });
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'px', format: [fm.outW, fm.outH], orientation: fm.outW > fm.outH ? 'landscape' : 'portrait' });
      doc.addImage(imgData, 'PNG', 0, 0, fm.outW, fm.outH);
      doc.save(`lectoria-avis-${(bookTitle || 'avis').replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (err) { console.error('[AvisExport] PDF:', err); }
    finally { setExportingPdf(false); }
  };

  // ── Éléments communs carte ────────────────────────────────────────────
  const spTriangle = els.sp && bookSP && (
    <svg style={{ position:'absolute', top:0, right:0, width:sz, height:sz, zIndex:6, pointerEvents:'none' }} viewBox={`0 0 ${sz} ${sz}`}>
      <polygon points={`${sz},0 0,0 ${sz},${sz}`} fill={p.ac} />
      <text x={Math.round(sz*.64)} y={Math.round(sz*.3)} textAnchor="middle" fill={p.isDark?p.tx:p.bg} fontSize={Math.round(sz*.21)} fontWeight="900" fontFamily="sans-serif" letterSpacing="2">SP</text>
    </svg>
  );

  const watermark = (
    <div style={{ position:'absolute', bottom:8, right:10, zIndex:8, pointerEvents:'none', fontSize:9, fontWeight:800, letterSpacing:'0.1em', fontFamily:'sans-serif', color:'rgba(255,255,255,.5)', textShadow:'0 0 5px rgba(0,0,0,.6)' }}>
      Lectoria
    </div>
  );

  const draggableItems = items.map(item => (
    <div key={item.id} onMouseDown={e => startDrag(e, item)}
      style={{ position:'absolute', left:item.x, top:item.y, cursor:'grab', zIndex:10, userSelect:'none', touchAction:'none' }}>
      <span style={{ fontSize:13, fontWeight:700, color:'white', textShadow:'0 1px 4px rgba(0,0,0,.65)', whiteSpace:'nowrap', padding:'2px 5px' }}>
        {item.text}
      </span>
    </div>
  ));

  // ── Templates ─────────────────────────────────────────────────────────
  const renderPolaroid = () => {
    const phH = Math.round(fm.h * 0.64);
    return (
      <>
        {/* Zone colorée en haut (sans photo) */}
        <div style={{ position:'absolute', top:10, left:10, right:10, height:phH-12, background:`hsl(${p.h},${Math.min(p.s+5,100)}%,${Math.max(p.l-15,20)}%)`, borderRadius:1, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:32, opacity:0.2, filter:'blur(1px)' }}>📖</div>
        </div>
        {/* Bande blanche */}
        <div style={{ position:'absolute', top:phH, left:0, right:0, bottom:0, background:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4px 14px', gap:2, borderTop:'0.5px solid #e8e8e8' }}>
          {els.titre && <><div style={{ fontSize:12, fontWeight:700, color:'#111', textAlign:'center', lineHeight:1.2 }}>{bookTitle}</div><div style={{ fontSize:9.5, color:'#888' }}>{bookAuthor}</div></>}
          {els.note  && <Stars count={bookRating} color="#bbb" />}
          {els.palme && bookFav && <div style={{ fontSize:9, fontWeight:600, color:p.ac }}>🏆 Coup de cœur</div>}
          {els.sig   && <div style={{ fontSize:8, color:'#ccc', letterSpacing:'0.04em', marginTop:1 }}>@joanaladyna · Lectoria</div>}
        </div>
      </>
    );
  };

  const renderJournal = () => {
    const ml = 48;
    return (
      <>
        <svg width="0" height="0" style={{ position:'absolute' }}>
          <defs>
            <filter id="crumple-card">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="12" result="nz" />
              <feDisplacementMap in="SourceGraphic" in2="nz" scale="2.5" />
            </filter>
          </defs>
        </svg>
        <div style={{ position:'absolute', inset:0, backgroundImage:[`linear-gradient(90deg,transparent ${ml-2}px,#ffb3b3 ${ml-2}px,#ffb3b3 ${ml}px,transparent ${ml}px)`,'repeating-linear-gradient(transparent 0px,transparent 22px,#c5c2ae 22px,#c5c2ae 23px)'].join(','), backgroundColor:'#faf8ee', filter:'url(#crumple-card)' }} />
        {els.sp && (<svg style={{ position:'absolute', left:0, top:0, width:20, height:fm.h, zIndex:2 }} viewBox={`0 0 20 ${fm.h}`}>{Array.from({length:6},(_,i)=><ellipse key={i} cx="8" cy={Math.round(fm.h/7*(i+1))} rx="5" ry="4" fill="#bbb" opacity=".3"/>)}</svg>)}
        <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', gap:4, padding:`13px ${rp}px 12px ${ml+8}px`, zIndex:3 }}>
          {els.titre && <><div style={{ fontSize:fm.w<252?13:15, fontWeight:700, lineHeight:1.25, color:'#26200e', fontFamily:'Georgia,serif' }}>{bookTitle}</div><div style={{ fontSize:10, color:'#26200e', opacity:.5, marginBottom:2, fontFamily:'Georgia,serif' }}>{bookAuthor}</div></>}
          {els.note  && <Stars count={bookRating} color="#b06030" />}
          {els.palme && bookFav && <div style={{ fontSize:10, fontWeight:600, color:'#b06030' }}>🏆 Coup de cœur</div>}
          {els.tags  && <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>{bookTags.map((t,i)=><span key={i} style={{ fontSize:8.5, padding:'2px 6px', borderRadius:3, background:'rgba(176,96,48,.1)', color:'#26200e', border:'0.5px solid rgba(176,96,48,.25)' }}>{t}</span>)}</div>}
          {els.avis  && bookNote && <div style={{ fontSize:fm.w<248?8.5:9.5, lineHeight:1.7, fontStyle:'italic', color:'#26200e', opacity:.75, marginTop:4, fontFamily:'Georgia,serif' }}>"{bookNote.slice(0,100)}{bookNote.length>100?'…':''}"</div>}
          <div style={{ flex:1 }} />
          {els.sig   && <div style={{ fontSize:8.5, color:'#26200e', opacity:.35, textAlign:'right', fontFamily:'Georgia,serif' }}>@joanaladyna · Lectoria</div>}
        </div>
      </>
    );
  };

  const renderMinimalBold = () => (
    <>
      {isBold && <div style={{ position:'absolute', right:8, top:6, fontSize:40, fontWeight:900, opacity:.07, color:'white', lineHeight:1, pointerEvents:'none', zIndex:1 }}>★</div>}
      <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', gap:3, padding:`16px ${rp}px 16px 16px`, zIndex:1 }}>
        {els.titre && <><div style={{ fontSize:fm.w<252?13:15, fontWeight:700, lineHeight:1.25, color:effTx }}>{bookTitle}</div><div style={{ fontSize:10, color:effTx, opacity:.6, marginBottom:2 }}>{bookAuthor}</div></>}
        {els.note  && <Stars count={bookRating} color={effAc} />}
        {els.palme && bookFav && <div style={{ fontSize:10, fontWeight:600, color:effAc }}>🏆 Coup de cœur</div>}
        {els.tags  && <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:4 }}>{bookTags.map((t,i)=><span key={i} style={{ fontSize:8.5, padding:'2px 6px', borderRadius:20, background:effT1, color:effTx, opacity:.9 }}>{t}</span>)}</div>}
        {els.avis  && bookNote && <div style={{ fontSize:fm.w<248?8.5:9.5, lineHeight:1.5, fontStyle:'italic', color:effTx, opacity:.8, marginTop:5, borderLeft:`2px solid ${effAc}`, paddingLeft:7 }}>"{bookNote.slice(0,100)}{bookNote.length>100?'…':''}"</div>}
        <div style={{ flex:1 }} />
        {els.sig   && <div style={{ fontSize:8.5, color:effTx, opacity:.38, textAlign:'right' }}>@joanaladyna · Lectoria</div>}
      </div>
    </>
  );

  const brs = { polaroid:'2px', journal:'2px', minimal:'16px', bold:'0px' };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[96vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Exporter l'avis — {bookTitle}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-3">

          {/* Format + Template */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 w-14 shrink-0">Format</span>
              <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                {Object.entries(FMTS).map(([key, val]) => (
                  <button key={key} onClick={() => setFmt(key)}
                    className={`px-3 py-1.5 text-xs border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 transition-colors ${fmt===key?'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-100':'bg-transparent text-zinc-400 hover:bg-zinc-50'}`}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400 w-14 shrink-0">Template</span>
              <div className="flex gap-1.5 flex-wrap">
                {SIMPLE_TEMPLATES.map(t => (
                  <button key={t} onClick={() => setTpl(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${tpl===t?'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 font-medium':'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300'}`}>
                    {SIMPLE_TEMPLATE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Palette */}
          <div className="flex items-start gap-2">
            <span className="text-xs text-zinc-400 w-14 shrink-0 mt-1">Fond</span>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(9,20px)', gap:'2px', borderRadius:4, overflow:'hidden' }}>
              {PALETTE.map((row, ri) => row.map((entry, ci) => (
                <div key={`${ri}-${ci}`} onClick={() => setPal(entry)}
                  style={{ width:20, height:18, background:entry.bg, cursor:'pointer',
                    boxShadow: pal===entry ? 'inset 0 0 0 2.5px white,inset 0 0 0 4.5px rgba(0,0,0,.18)' : 'none' }}
                  className="hover:scale-125 hover:z-10 transition-transform"
                />
              )))}
            </div>
          </div>

          {/* Carte + Panneau */}
          <div className="flex gap-4">
            {/* Aperçu carte */}
            <div className="flex-1 flex justify-center items-start">
              <div>
                <div ref={cardRef} style={{
                  position:'relative', overflow:'hidden', width:fm.w, height:fm.h,
                  borderRadius:brs[tpl]||'8px', background:cardBg, display:'flex', flexDirection:'column',
                  boxShadow: tpl==='polaroid' ? '0 4px 22px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.08)' : '0 4px 22px rgba(0,0,0,.18)',
                  flexShrink:0,
                }}>
                  {tpl==='polaroid'  && renderPolaroid()}
                  {tpl==='journal'   && renderJournal()}
                  {(tpl==='minimal' || tpl==='bold') && renderMinimalBold()}
                  {spTriangle}
                  {draggableItems}
                  {watermark}
                </div>
                <p className="text-center text-xs text-zinc-400 mt-2">{fm.label} px</p>
              </div>
            </div>

            {/* Panneau */}
            <div className="w-48 shrink-0 space-y-2.5">
              {/* Texte libre */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Texte libre</p>
                <div className="flex gap-1">
                  <input value={txtInput} onChange={e => setTxtInput(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && addText()}
                    placeholder="Mon texte…" maxLength={50}
                    className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 placeholder-zinc-300 min-w-0 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button onClick={addText} className="px-3 py-1.5 text-xs bg-amber-100 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-200 font-medium">+</button>
                </div>
                {items.length > 0 && (
                  <button onClick={() => setItems([])} className="text-xs text-zinc-400 hover:text-red-400 w-full text-left transition-colors">
                    Effacer les textes
                  </button>
                )}
              </div>

              {/* Éléments */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Éléments</p>
                <div className="space-y-1">
                  {ELEM_LIST.filter(({id}) => id !== 'sp' || bookSP).map(({id, label}) => (
                    <div key={id} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                      <Toggle on={els[id]} onToggle={() => toggleEl(id)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer export */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <p className="text-xs text-zinc-400">Glisse les textes pour les repositionner · Filigrane Lectoria inclus</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-600 transition-colors">Annuler</button>
              <button onClick={handleExportPdf} disabled={exportingPdf}
                className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {exportingPdf ? '⏳' : '↓'} PDF
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-2 shadow-sm">
                {exporting ? '⏳ Export…' : '↓ PNG'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
