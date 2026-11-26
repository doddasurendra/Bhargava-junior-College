import { CardReview, Field, ObForm } from '@/components/openbook/client';
import { cardsForOffline, decksOf, dueCards } from '@/lib/openbook/flashcards';
import { OfflineCardSync } from '@/components/openbook/OfflineCards';
import { OcclusionMaker } from '@/components/openbook/Occlusion';
import { obStudent } from '@/lib/openbook/session';
import { manualCardAction } from '../actions';
import { DeckButtons, GenerateCards } from './DeckButtons';
import { pickerOptions } from '@/lib/openbook/options';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function FlashcardsPage({ searchParams }: { searchParams: { mode?: 'quick' | 'exam' | 'weak'; deck?: string } }) {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'flashcards');
  const [decks, cards, o, offline] = await Promise.all([decksOf(me.studentId, me.batchId), dueCards(me.studentId, { mode: searchParams.mode, deckId: searchParams.deck }), pickerOptions(), cardsForOffline(me.studentId)]);
  const due = decks.filter((d) => d.mine).reduce((s, d) => s + d.due, 0);
  return (
    <div className="space-y-4">
      <H1 sub={pg.sub}>{pg.title}</H1>
      <div className="flex flex-wrap gap-1.5 text-sm">
        <a href="/app/openbook/flashcards" className={!searchParams.mode ? 'chip chip-active' : 'chip'}>Due today ({due})</a>
        <a href="/app/openbook/flashcards?mode=quick" className={searchParams.mode === 'quick' ? 'chip chip-active' : 'chip'}>Quick 10</a>
        <a href="/app/openbook/flashcards?mode=exam" className={searchParams.mode === 'exam' ? 'chip chip-active' : 'chip'}>Before-exam rapid revision</a>
        <a href="/app/openbook/flashcards?mode=weak" className={searchParams.mode === 'weak' ? 'chip chip-active' : 'chip'}>Only my weak cards</a>
      </div>
      <OfflineCardSync cards={offline} studentKey={me.studentId.slice(0, 8)} />
      {cards.length ? <CardReview cards={cards} lang={me.profile.lang} /> : <p className="card p-4 text-sm text-muted">Nothing due right now.</p>}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-heading">Decks</h2>
        {decks.length === 0 && <p className="text-sm text-muted">No decks yet.</p>}
        {decks.map((d) => <div key={d.id} className="card flex items-center justify-between gap-2 p-3 text-sm"><a className="underline" href={`/app/openbook/flashcards?deck=${d.id}&mode=exam`}>{d.name}</a><span className="text-xs text-muted">{d.mine ? `${d.cards} cards · ${d.due} due` : 'shared by your batch'}{d.mine && d.shared ? (d.approved ? ' · shared' : ' · waiting for teacher') : ''}</span><DeckButtons deckId={d.id} mine={d.mine} shared={d.shared} /></div>)}
      </section>
      <OcclusionMaker />
      <GenerateCards exams={o.exams} chapters={o.chapters} initialExam={me.defaultExam} aiReady={o.aiReady} />
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-heading">Make a card yourself</h2>
        <ObForm action={manualCardAction} submit="Add card">
          <Field label="Deck"><input name="deck" className="input w-full" defaultValue="My cards" /></Field>
          <Field label="Type"><select name="kind" className="input w-full"><option value="qa">Question / answer</option><option value="formula">Formula</option><option value="definition">Definition</option><option value="cloze">Fill in the blank</option></select></Field>
          <Field label="Front"><textarea name="front" required rows={2} className="input w-full" /></Field>
          <Field label="Back"><textarea name="back" required rows={2} className="input w-full" /></Field>
        </ObForm>
      </section>
    </div>
  );
}
