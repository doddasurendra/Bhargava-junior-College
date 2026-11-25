'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import * as act from '@/app/app/(authed)/openbook/actions';
import { QuestionCard, type QView } from './client';

type Pdf = import('pdfjs-dist').PDFDocumentProxy;
interface NoteV { id: string; page: number; text: string; color: string | null; note: string | null }
const COLORS = { yellow: '#fde68a', green: '#bbf7d0', blue: '#bfdbfe', pink: '#fbcfe8' } as const;
const LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' } as const;

/**
 * Smart PDF Reader (§17). pdf.js renders each page to a canvas with a selectable text layer. Progress (page,
 * pages read, time) is saved every 20 s and on page change, so "continue reading" works on any device.
 */
export function Reader({ bookId, title, initialPage, examId, notes: initialNotes, canDownload, textReady }: { bookId: string; title: string; initialPage: number; examId: string; notes: NoteV[]; canDownload: boolean; textReady: boolean }) {
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [page, setPage] = useState(initialPage);
  const [scale, setScale] = useState(1.1);
  const [theme, setTheme] = useState<'day' | 'night' | 'sepia'>('day');
  const [notes, setNotes] = useState(initialNotes);
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [panel, setPanel] = useState<{ title: string; body: string; sources?: { label: string }[] } | null>(null);
  const [qs, setQs] = useState<QView[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en');
  const [rate, setRate] = useState(1);
  const [find, setFind] = useState('');
  const [hits, setHits] = useState<{ page: number; snippet: string }[]>([]);
  const [thumbs, setThumbs] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const seconds = useRef(0);
  const pageText = useRef('');

  // load the document
  useEffect(() => {
    let dead = false;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      try {
        const doc = await pdfjs.getDocument({ url: `/api/openbook/file?k=book&id=${bookId}`, withCredentials: true }).promise;
        if (!dead) { setPdf(doc); setPage((p) => Math.min(Math.max(1, p), doc.numPages)); }
      } catch (e) {
        if (!dead) setErr(`This book could not be opened (${(e as Error).message}).`);
      }
    })();
    return () => { dead = true; };
  }, [bookId]);

  // render the page + text layer, mark this student's highlights
  const render = useCallback(async () => {
    if (!pdf || !canvas.current || !textLayer.current) return;
    const pdfjs = await import('pdfjs-dist');
    const p = await pdf.getPage(page);
    const vp = p.getViewport({ scale });
    const c = canvas.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = vp.width * ratio; c.height = vp.height * ratio;
    c.style.width = `${vp.width}px`; c.style.height = `${vp.height}px`;
    await p.render({ canvasContext: c.getContext('2d')!, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined }).promise;
    const tl = textLayer.current;
    tl.innerHTML = '';
    tl.style.width = `${vp.width}px`; tl.style.height = `${vp.height}px`;
    tl.style.setProperty('--scale-factor', String(scale));
    const content = await p.getTextContent();
    pageText.current = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    await new pdfjs.TextLayer({ textContentSource: content, container: tl, viewport: vp }).render();
    const mine = notes.filter((n) => n.page === page && n.text && n.color);
    if (mine.length) for (const span of Array.from(tl.querySelectorAll('span'))) {
      const t = span.textContent ?? '';
      const hit = mine.find((n) => t.trim().length > 3 && (n.text.includes(t.trim()) || t.includes(n.text)));
      if (hit) span.style.background = `${COLORS[hit.color as keyof typeof COLORS]}99`;
    }
  }, [pdf, page, scale, notes]);
  useEffect(() => { void render(); }, [render]);

  // progress: every 20 s and on page change
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') seconds.current += 1; }, 1000);
    const s = setInterval(() => { const n = seconds.current; seconds.current = 0; if (n) void act.readerProgress(bookId, page, n); }, 20_000);
    return () => { clearInterval(t); clearInterval(s); };
  }, [bookId, page]);
  useEffect(() => { const n = seconds.current; seconds.current = 0; void act.readerProgress(bookId, page, n); }, [bookId, page]);

  const go = (n: number) => { if (pdf) setPage(Math.min(Math.max(1, n), pdf.numPages)); setSel(null); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return; if (e.key === 'ArrowRight') go(page + 1); if (e.key === 'ArrowLeft') go(page - 1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const onMouseUp = () => {
    const s = window.getSelection();
    const text = s?.toString().trim() ?? '';
    if (text.length < 3 || !wrap.current) { setSel(null); return; }
    const r = s!.getRangeAt(0).getBoundingClientRect(), w = wrap.current.getBoundingClientRect();
    setSel({ text: text.slice(0, 4000), x: Math.max(0, r.left - w.left), y: r.bottom - w.top + wrap.current.scrollTop + 6 });
  };

  const highlight = (color: keyof typeof COLORS | null, note: string | null = null, revision = false) => start(async () => {
    if (!sel) return;
    const r = await act.readerNote(bookId, page, sel.text, color, note, revision);
    if (r.error) setErr(r.error); else setNotes((n) => [...n, { id: String(r.data), page, text: sel.text, color, note }]);
    setSel(null);
  });
  const ask = (task: 'explain' | 'simplify' | 'translate' | 'summarize' | 'formulas' | 'page_questions', label: string, selection: string | null) => start(async () => {
    setErr(null);
    const r = await act.readerAsk({ task, question: task === 'translate' ? `Translate into ${lang === 'te' ? 'Telugu' : lang === 'hi' ? 'Hindi' : 'English'}` : '', lang: task === 'translate' && lang === 'en' ? 'te' : lang, bookId, pages: selection ? [page] : [page], selection });
    if (r.error || !r.data) setErr(r.error ?? 'No answer.');
    else { const d = r.data as { answer: string; sources: { label: string }[] }; setPanel({ title: label, body: d.answer, sources: d.sources }); }
    setSel(null);
  });
  const genQs = (passage: string) => start(async () => {
    const r = await act.readerQuestions(bookId, passage, examId);
    if (r.error) setErr(r.error); else setQs((r.data as { questions: QView[] }).questions);
    setSel(null);
  });
  const cards = (passage: string) => start(async () => { const r = await act.readerCards(passage, examId, title); setErr(r.error ?? null); if (!r.error) setPanel({ title: 'Flashcards', body: `${(r.data as { added: number }).added} cards added to your deck "From ${title}". Review them in Flashcards.` }); setSel(null); });
  const readAloud = (text: string) => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.slice(0, 4000)); u.lang = LOCALE[lang]; u.rate = rate; window.speechSynthesis.speak(u); };
  const search = async () => {
    if (!pdf || !find.trim()) return;
    const w = find.toLowerCase();
    const out: { page: number; snippet: string }[] = [];
    for (let i = 1; i <= pdf.numPages && out.length < 50; i++) {
      const t = (await (await pdf.getPage(i)).getTextContent()).items.map((x) => ('str' in x ? x.str : '')).join(' ');
      const at = t.toLowerCase().indexOf(w);
      if (at >= 0) out.push({ page: i, snippet: t.slice(Math.max(0, at - 50), at + 90) });
    }
    setHits(out);
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.parentElement?.requestFullscreen());
  const filter = theme === 'night' ? 'invert(0.92) hue-rotate(180deg)' : theme === 'sepia' ? 'sepia(0.55) brightness(0.97)' : 'none';

  return (
    <div className="space-y-3 bg-bg">
      <div className="sticky top-[60px] z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-2 text-sm">
        <button onClick={() => go(page - 1)} className="btn-outline px-2 py-1" aria-label="Previous page">‹</button>
        <input aria-label="Page" className="input w-14 py-1 text-center" value={page} onChange={(e) => go(Number(e.target.value) || 1)} />
        <span className="text-muted">/ {pdf?.numPages ?? '…'}</span>
        <button onClick={() => go(page + 1)} className="btn-outline px-2 py-1" aria-label="Next page">›</button>
        <button onClick={() => setScale((s) => Math.max(0.5, s - 0.15))} className="btn-outline px-2 py-1" aria-label="Zoom out">−</button>
        <button onClick={() => setScale((s) => Math.min(3, s + 0.15))} className="btn-outline px-2 py-1" aria-label="Zoom in">+</button>
        <select aria-label="Reading mode" className="input w-auto py-1" value={theme} onChange={(e) => setTheme(e.target.value as 'day')}><option value="day">Day</option><option value="night">Night</option><option value="sepia">Sepia</option></select>
        <button onClick={fullscreen} className="btn-outline px-2 py-1" aria-label="Fullscreen">⛶</button>
        <button onClick={() => setThumbs((t) => !t)} className="btn-outline px-2 py-1">Pages</button>
        <button onClick={() => start(async () => { await act.readerBookmark(bookId, page, null); setPanel({ title: 'Bookmark', body: `Page ${page} bookmarked.` }); })} className="btn-outline px-2 py-1">🔖</button>
        {canDownload && <a href={`/api/openbook/file?k=book&id=${bookId}&download=1`} className="btn-outline px-2 py-1">Download</a>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <input aria-label="Search in this book" className="input flex-1 py-1" placeholder="Search inside this book" value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button onClick={search} className="btn-outline px-3 py-1">Find</button>
        <select aria-label="Language" className="input w-auto py-1" value={lang} onChange={(e) => setLang(e.target.value as 'en')}><option value="en">EN</option><option value="te">తె</option><option value="hi">हि</option></select>
        <button onClick={() => readAloud(pageText.current)} className="btn-outline px-2 py-1" aria-label="Read aloud">🔊</button>
        <button onClick={() => window.speechSynthesis.cancel()} className="btn-outline px-2 py-1" aria-label="Stop reading">⏹</button>
        <input aria-label="Reading speed" type="range" min={0.6} max={1.6} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-20" />
      </div>
      {hits.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-lg border border-line text-xs">{hits.map((h) => <li key={h.page}><button onClick={() => go(h.page)} className="w-full px-2 py-1 text-left hover:bg-bg"><b>p. {h.page}</b> …{h.snippet}…</button></li>)}</ul>}
      {thumbs && pdf && <Thumbs pdf={pdf} current={page} onPick={go} />}
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{err}</p>}
      <div ref={wrap} onMouseUp={(e) => { if (!(e.target as HTMLElement).closest('[data-obmenu]')) onMouseUp(); }} onTouchEnd={(e) => { if (!(e.target as HTMLElement).closest('[data-obmenu]')) setTimeout(onMouseUp, 50); }} className="relative overflow-auto rounded-xl border border-line bg-white" style={{ maxHeight: '75vh' }}>
        <div className="relative mx-auto w-fit" style={{ filter }}>
          <canvas ref={canvas} />
          <div ref={textLayer} className="ob-text-layer absolute left-0 top-0" />
        </div>
        {sel && (
          <div data-obmenu className="absolute z-30 flex max-w-[95%] flex-wrap gap-1 rounded-xl border border-line bg-surface p-1.5 text-xs shadow-lg" style={{ left: Math.min(sel.x, 120), top: sel.y }}>
            {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((c) => <button key={c} onClick={() => highlight(c)} aria-label={`Highlight ${c}`} className="h-6 w-6 rounded-full border border-line" style={{ background: COLORS[c] }} />)}
            {draft === null ? <button onClick={() => setDraft('')} className="btn-outline px-2 py-1">Note</button> : <span className="flex gap-1"><input autoFocus aria-label="Your note" className="input w-40 py-1 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} /><button onClick={() => { if (draft.trim()) highlight('yellow', draft.trim()); setDraft(null); }} className="btn-primary px-2 py-1">Save</button></span>}
            <button onClick={() => ask('explain', 'Explain this', sel.text)} className="btn-outline px-2 py-1">Explain</button>
            <button onClick={() => ask('simplify', 'In simpler words', sel.text)} className="btn-outline px-2 py-1">Simplify</button>
            <button onClick={() => ask('translate', 'Translation', sel.text)} className="btn-outline px-2 py-1">Translate</button>
            <button onClick={() => genQs(sel.text)} className="btn-outline px-2 py-1">Questions</button>
            <button onClick={() => cards(sel.text)} className="btn-outline px-2 py-1">Flashcards</button>
            <button onClick={() => highlight(null, null, true)} className="btn-outline px-2 py-1">+ Revision</button>
            <button onClick={() => readAloud(sel.text)} className="btn-outline px-2 py-1">🔊</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 text-sm">
        <span className="self-center text-xs font-semibold uppercase tracking-wider text-muted">AI panel</span>
        <button disabled={pending || !textReady} onClick={() => ask('summarize', `Summary of page ${page}`, null)} className="btn-outline px-2 py-1">Summary</button>
        <button disabled={pending || !textReady} onClick={() => ask('formulas', `Formulas and definitions, p. ${page}`, null)} className="btn-outline px-2 py-1">Formulas & definitions</button>
        <button disabled={pending || !textReady} onClick={() => ask('page_questions', `Questions from page ${page}`, null)} className="btn-outline px-2 py-1">Questions from this page</button>
        {pending && <span className="self-center text-xs text-muted">Working…</span>}
      </div>
      {!textReady && <p className="text-xs text-muted">The AI panel needs this book’s text, which hasn’t been extracted yet (scanned book awaiting OCR).</p>}
      {panel && <section className="card space-y-2 p-4 text-sm"><div className="flex items-center justify-between"><p className="font-semibold text-heading">{panel.title}</p><button onClick={() => setPanel(null)} className="text-xs underline">Close</button></div><p className="whitespace-pre-line">{panel.body}</p>{panel.sources?.length ? <p className="text-[11px] text-muted">Sources: {panel.sources.map((s) => s.label).join('; ')}</p> : null}<button onClick={() => readAloud(panel.body)} className="text-xs underline">Read aloud</button></section>}
      {qs.map((q, i) => <QuestionCard key={q.id} q={q} n={i + 1} />)}
      {notes.filter((n) => n.page === page).length > 0 && <section className="card p-3 text-sm"><p className="mb-1 font-semibold text-heading">My notes on this page</p><ul className="space-y-1">{notes.filter((n) => n.page === page).map((n) => <li key={n.id} className="rounded px-2 py-1" style={{ background: n.color ? `${COLORS[n.color as keyof typeof COLORS]}66` : undefined }}>{n.text && <span>“{n.text.slice(0, 200)}”</span>}{n.note && <span className="block text-xs">✎ {n.note}</span>}</li>)}</ul><Link href="/app/openbook/notes" className="mt-2 block text-xs underline">All my notes · export</Link></section>}
      <style>{`.ob-text-layer{overflow:hidden;line-height:1;text-align:initial;opacity:1}.ob-text-layer span,.ob-text-layer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0}.ob-text-layer ::selection{background:rgba(37,99,235,.35)}`}</style>
    </div>
  );
}

function Thumbs({ pdf, current, onPick }: { pdf: Pdf; current: number; onPick: (n: number) => void }) {
  const from = Math.max(1, current - 4), to = Math.min(pdf.numPages, current + 5);
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return <div className="flex gap-2 overflow-x-auto pb-1">{pages.map((n) => <Thumb key={n} pdf={pdf} n={n} active={n === current} onPick={onPick} />)}</div>;
}
function Thumb({ pdf, n, active, onPick }: { pdf: Pdf; n: number; active: boolean; onPick: (n: number) => void }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => { (async () => { const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 0.18 }); if (!c.current) return; c.current.width = vp.width; c.current.height = vp.height; await p.render({ canvasContext: c.current.getContext('2d')!, viewport: vp }).promise; })(); }, [pdf, n]);
  return <button onClick={() => onPick(n)} className={`shrink-0 rounded border-2 ${active ? 'border-navy dark:border-gold' : 'border-transparent'}`}><canvas ref={c} /><span className="block text-center text-[10px]">{n}</span></button>;
}
