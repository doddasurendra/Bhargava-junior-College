'use client';
import { useState, useTransition } from 'react';
import { addGoogleBookAction, googleSearchAction } from '@/app/crm/openbook-actions';
import type { GoogleField, GoogleHit } from '@/lib/openbook/library';

const CATS = [['intermediate', 'Intermediate'], ['engineering', 'JEE & engineering'], ['medical', 'NEET & medical'], ['higher', 'Higher & competitive']];

/** Google Books search for administrators: title / author / subject / ISBN, details, preview, add to the library. */
export function GoogleSearch({ exams }: { exams: { id: string; name: string }[] }) {
  const [field, setField] = useState<GoogleField>('any');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<{ total: number; hits: GoogleHit[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState({ category: 'intermediate', examIds: [] as string[], subjects: '', cls: 'na' as '11' | '12' | 'both' | 'na', language: 'en', docType: 'reference' });
  const [pending, start] = useTransition();
  const search = (p = 1) => start(async () => {
    setErr(null); setPage(p);
    const r = await googleSearchAction(field, q, p);
    if (r.ok) setRes(r.data); else { setRes(null); setErr(r.error); }
  });
  const add = (id: string) => start(async () => {
    const r = await addGoogleBookAction(id, { ...meta, subjects: meta.subjects.split(',').map((s) => s.trim()).filter(Boolean) });
    setAdded((a) => ({ ...a, [id]: r.error ?? r.message ?? 'Added.' }));
  });
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); search(1); }} className="flex flex-wrap gap-2">
        <select aria-label="Search by" className="input w-auto" value={field} onChange={(e) => setField(e.target.value as GoogleField)}>
          <option value="any">Anything</option><option value="title">Title</option><option value="author">Author</option><option value="subject">Subject</option><option value="isbn">ISBN</option>
        </select>
        <input aria-label="Search Google Books" className="input min-w-[12rem] flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={field === 'isbn' ? '9788174505071' : 'e.g. NCERT Physics Class 11'} />
        <button disabled={pending || q.trim().length < 2} className="btn-primary px-4 disabled:opacity-50">{pending ? 'Searching…' : 'Search'}</button>
      </form>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{err}</p>}
      {res && (
        <>
          <p className="text-xs text-muted">{res.total.toLocaleString('en-IN')} results from Google Books · page {page}</p>
          <details className="rounded-lg border border-line p-2 text-sm">
            <summary className="cursor-pointer font-semibold">Details used when adding a book</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs">Category<select className="input mt-1 w-full" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="text-xs">Subjects (comma)<input className="input mt-1 w-full" value={meta.subjects} onChange={(e) => setMeta({ ...meta, subjects: e.target.value })} /></label>
              <label className="text-xs">Year (Inter)<select className="input mt-1 w-full" value={meta.cls} onChange={(e) => setMeta({ ...meta, cls: e.target.value as 'na' })}><option value="na">—</option><option value="11">1st year</option><option value="12">2nd year</option><option value="both">Both</option></select></label>
              <label className="text-xs">Language<select className="input mt-1 w-full" value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value })}><option value="en">English</option><option value="te">Telugu</option><option value="hi">Hindi</option><option value="other">Other</option></select></label>
              <label className="text-xs">Type<select className="input mt-1 w-full" value={meta.docType} onChange={(e) => setMeta({ ...meta, docType: e.target.value })}><option value="reference">Reference book</option><option value="textbook">Textbook</option><option value="question_bank">Question bank</option><option value="notes">Notes</option></select></label>
            </div>
            <fieldset className="mt-2 grid max-h-32 grid-cols-2 gap-1 overflow-y-auto text-xs">{exams.map((e) => <label key={e.id} className="flex gap-1"><input type="checkbox" checked={meta.examIds.includes(e.id)} onChange={() => setMeta((m) => ({ ...m, examIds: m.examIds.includes(e.id) ? m.examIds.filter((x) => x !== e.id) : [...m.examIds, e.id] }))} />{e.name}</label>)}</fieldset>
          </details>
          <ul className="divide-y divide-line">
            {res.hits.map((h) => (
              <li key={h.id} className="flex gap-3 py-3 text-sm">
                {h.cover ? <img src={h.cover} alt="" className="h-20 w-14 shrink-0 rounded object-cover" /> : <div className="h-20 w-14 shrink-0 rounded bg-bg" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-heading">{h.title}</p>
                  <p className="text-xs text-muted">{h.authors.join(', ') || '—'}{h.publisher ? ` · ${h.publisher}` : ''}{h.year ? ` · ${h.year}` : ''}{h.isbn ? ` · ISBN ${h.isbn}` : ''}</p>
                  <p className="text-[11px] text-muted">{h.publicDomain ? 'Public domain' : 'Copyrighted: details and links only'} · preview: {h.viewability === 'ALL_PAGES' ? 'full' : h.viewability === 'PARTIAL' ? 'partial' : 'none'}{h.categories.length ? ` · ${h.categories.join(', ')}` : ''}</p>
                  {open === h.id && h.description && <p className="text-xs">{h.description.replace(/<[^>]+>/g, '')}</p>}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {h.description && <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} className="underline">{open === h.id ? 'Hide details' : 'Details'}</button>}
                    {h.previewUrl && <a className="underline" href={h.previewUrl} target="_blank" rel="noopener noreferrer">Preview</a>}
                    {h.buyUrl && <a className="underline" href={h.buyUrl} target="_blank" rel="noopener noreferrer">Publisher / buy</a>}
                    {h.inLibrary ? <span className="font-semibold text-emerald-700">Already in the library</span> : added[h.id] ? <span>{added[h.id]}</span> : <button type="button" disabled={pending} onClick={() => add(h.id)} className="btn-outline px-2 py-0.5">Add to library</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">{page > 1 ? <button onClick={() => search(page - 1)} className="btn-outline px-3 py-1 text-sm">Previous</button> : <span />}{res.total > page * 20 && <button onClick={() => search(page + 1)} className="btn-outline px-3 py-1 text-sm">Next</button>}</div>
        </>
      )}
    </div>
  );
}
