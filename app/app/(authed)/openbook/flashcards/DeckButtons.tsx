'use client';
import { useState, useTransition } from 'react';
import { Note, TaxonomyPickers, useTaxonomy, type ChapterOpt, type ExamOpt } from '@/components/openbook/client';
import { aiCardsAction, copyDeckAction, shareDeckAction, wrongAnswerCardsAction, type R } from '../actions';

export function DeckButtons({ deckId, mine, shared }: { deckId: string; mine: boolean; shared: boolean }) {
  const [r, setR] = useState<R | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {mine && !shared && <button disabled={pending} onClick={() => start(async () => setR(await shareDeckAction(deckId)))} className="text-xs underline">Share with batch</button>}
      {!mine && <button disabled={pending} onClick={() => start(async () => setR(await copyDeckAction(deckId)))} className="text-xs underline">Copy to my decks</button>}
      {r && <span className="text-[11px] text-muted">{r.error ?? r.message}</span>}
    </span>
  );
}

export function GenerateCards({ exams, chapters, initialExam, aiReady }: { exams: ExamOpt[]; chapters: ChapterOpt[]; initialExam: string; aiReady: boolean }) {
  const t = useTaxonomy(exams, chapters, initialExam);
  const [r, setR] = useState<R | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-heading">Make cards automatically</h2>
      <button disabled={pending} onClick={() => start(async () => { const x = await wrongAnswerCardsAction(); setR(x.ok ? { message: `${(x.data as { added: number }).added} cards made from your wrong answers.` } : x); })} className="btn-outline w-full py-2 text-sm">From my wrong answers (no AI needed)</button>
      <TaxonomyPickers t={t} exams={exams} />
      <div className="grid grid-cols-2 gap-2">
        <button disabled={pending || !aiReady} onClick={() => start(async () => { const x = await aiCardsAction({ source: 'concept', subject: t.subject, chapter: t.chapter, concept: t.concept, count: 10 }); setR(x.ok ? { message: `${(x.data as { added: number }).added} cards added.` } : x); })} className="btn-outline py-2 text-sm disabled:opacity-50">AI: this concept</button>
        <button disabled={pending || !aiReady} onClick={() => start(async () => { const x = await aiCardsAction({ source: 'chapter', subject: t.subject, chapter: t.chapter, count: 20 }); setR(x.ok ? { message: `${(x.data as { added: number }).added} cards added.` } : x); })} className="btn-outline py-2 text-sm disabled:opacity-50">AI: whole chapter</button>
      </div>
      {!aiReady && <p className="text-xs text-muted">AI flashcards appear once the college switches on the AI service.</p>}
      <Note r={r} />
    </section>
  );
}
