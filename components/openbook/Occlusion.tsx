'use client';
import { useRef, useState, useTransition } from 'react';
import { occlusionAction, type R } from '@/app/app/(authed)/openbook/actions';

type Box = { x: number; y: number; w: number; h: number; label: string };

/** Diagram-label card maker: upload a diagram, drag boxes over the labels, type each answer. */
export function OcclusionMaker() {
  const [img, setImg] = useState<{ url: string; file: File } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const [deck, setDeck] = useState('Diagrams');
  const [r, setR] = useState<R | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const start0 = useRef<{ x: number; y: number } | null>(null);
  // the box being drawn, also kept in a ref: a quick release can arrive before React re-renders the last move
  const drawing = useRef<Box | null>(null);
  const pos = (e: React.PointerEvent) => { const b = ref.current!.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
  const down = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start0.current = pos(e); drawing.current = { ...start0.current, w: 0, h: 0, label: '' }; setDraft(drawing.current); };
  const move = (e: React.PointerEvent) => { if (!start0.current) return; const p = pos(e), s = start0.current; drawing.current = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y), label: '' }; setDraft(drawing.current); };
  const up = (e: React.PointerEvent) => { if (start0.current) move(e); const d = drawing.current; if (d && d.w > 0.01 && d.h > 0.01) setBoxes((b) => [...b, d]); drawing.current = null; setDraft(null); start0.current = null; };
  const save = () => start(async () => {
    const fd = new FormData();
    fd.set('image', img!.file); fd.set('deck', deck); fd.set('boxes', JSON.stringify(boxes));
    const x = await occlusionAction({}, fd);
    setR(x.ok ? { message: `${(x.data as { added: number }).added} diagram cards added to “${deck}”.` } : x);
    if (x.ok) { setBoxes([]); setImg(null); }
  });
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-heading">Diagram cards (hide the labels)</h2>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImg({ url: URL.createObjectURL(f), file: f }); setBoxes([]); } }} className="block w-full text-sm" aria-label="Diagram image" />
      {img && (
        <>
          <p className="text-xs text-muted">Drag a box over each label you want to learn, then type what it is.</p>
          <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} className="relative touch-none select-none overflow-hidden rounded-lg border border-line">
            <img src={img.url} alt="Diagram" className="block w-full" draggable={false} />
            {[...boxes, ...(draft ? [draft] : [])].map((b, i) => <div key={i} className="absolute border-2 border-maroon bg-maroon/30 text-[10px] font-bold text-white" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>{i < boxes.length ? i + 1 : ''}</div>)}
          </div>
          <ol className="space-y-1">{boxes.map((b, i) => <li key={i} className="flex items-center gap-2 text-sm"><span className="w-5 text-xs">{i + 1}.</span><input className="input flex-1 py-1" placeholder="What is under this box?" value={b.label} onChange={(e) => setBoxes((bs) => bs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /><button onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== i))} className="text-xs underline">Remove</button></li>)}</ol>
          <input className="input w-full" value={deck} onChange={(e) => setDeck(e.target.value)} aria-label="Deck name" />
          <button disabled={pending || !boxes.some((b) => b.label.trim())} onClick={save} className="btn-primary w-full py-2 disabled:opacity-50">{pending ? 'Saving…' : `Make ${boxes.filter((b) => b.label.trim()).length} cards`}</button>
        </>
      )}
      {r && <p role={r.error ? 'alert' : 'status'} className={`text-sm ${r.error ? 'text-red-700' : 'text-emerald-700'}`}>{r.error ?? r.message}</p>}
    </section>
  );
}

/** The diagram with every label hidden; the asked one highlighted (front) or revealed (back). */
export function OcclusionView({ cardId, masks, target, revealed }: { cardId: string; masks: { x: number; y: number; w: number; h: number }[]; target: number | null; revealed: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line">
      <img src={`/api/openbook/file?k=card&id=${cardId}`} alt="Diagram" className="block w-full" />
      {masks.map((m, i) => (i === target && revealed ? <div key={i} className="absolute border-2 border-emerald-600" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} /> : <div key={i} className={`absolute ${i === target ? 'bg-maroon' : 'bg-slate-500'} flex items-center justify-center text-xs font-bold text-white`} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}>{i === target ? '?' : ''}</div>))}
    </div>
  );
}
