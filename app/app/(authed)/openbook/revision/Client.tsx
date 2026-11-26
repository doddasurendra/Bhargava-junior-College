'use client';
import { useState, useTransition } from 'react';
import { readerAsk } from '../actions';

export function PrintButton() {
  return <button onClick={() => window.print()} className="btn-outline w-full py-2 text-sm">Save as PDF / print</button>;
}

/** AI revision notes for the chapter, grounded in Open Book's books (needs the AI service). */
export function AiRevision({ subject, chapter, enabled }: { subject: string; chapter: string; enabled: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!enabled) return <p className="text-[11px] text-muted print:hidden">AI revision notes appear here once the college switches on the AI service.</p>;
  return (
    <section>
      {!text && <button disabled={pending} onClick={() => start(async () => { const r = await readerAsk({ task: 'revision', question: `${subject}: ${chapter}`, lang: 'en', bookId: null }); if (r.error || !r.data) setErr(r.error ?? 'No answer'); else setText((r.data as { answer: string }).answer); })} className="btn-outline px-3 py-1.5 text-sm print:hidden">{pending ? 'Writing revision notes…' : 'Add AI revision notes'}</button>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {text && <><h3 className="mb-1 text-sm font-semibold text-heading">Revision notes <span className="text-[10px] font-normal text-muted">(AI, from Open Book sources)</span></h3><p className="whitespace-pre-line text-sm">{text}</p></>}
    </section>
  );
}
