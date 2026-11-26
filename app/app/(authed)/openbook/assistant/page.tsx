import Link from 'next/link';
import { Chat } from '@/components/openbook/client';
import { getSession, sessionsOf } from '@/lib/openbook/assistant';
import { aiConfigured } from '@/lib/openbook/llm';
import { obStudent } from '@/lib/openbook/session';
import { DeleteSession } from './DeleteSession';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const TASKS = [
  { id: 'answer', label: 'Answer my question' }, { id: 'explain', label: 'Explain a concept' }, { id: 'summarize', label: 'Summarise a chapter' }, { id: 'notes', label: 'Study notes' },
  { id: 'revision', label: 'Revision notes' }, { id: 'mindmap', label: 'Mind map' }, { id: 'formulas', label: 'Key formulas' }, { id: 'page_questions', label: 'Practice questions' },
];

export default async function AssistantPage({ searchParams }: { searchParams: { s?: string } }) {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'assistant');
  const history = await sessionsOf(me.studentId, 'assistant');
  const open = searchParams.s ? await getSession(me.studentId, searchParams.s).catch(() => null) : null;
  return (
    <div className="space-y-4">
      <H1 sub={pg.sub}>{pg.title}</H1>
      {!aiConfigured() && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">AI answers are not switched on yet. Until then you get the most relevant passages from the library, with their pages.</p>}
      <p className="text-xs text-muted">For flashcards use <Link className="underline" href="/app/openbook/flashcards">Flashcards</Link>; to explain a passage, select it in the <Link className="underline" href="/app/openbook/library">reader</Link>.</p>
      <Chat key={open?.id ?? 'new'} mode="assistant" tasks={TASKS} initialSession={open?.id ?? null} initialTurns={open?.turns ?? []} />
      {history.length > 0 && <section className="card p-3 text-sm"><p className="mb-1 font-semibold text-heading">Earlier conversations</p><ul className="space-y-1">{history.slice(0, 20).map((h) => <li key={h.id} className="flex justify-between gap-2"><Link href={`/app/openbook/assistant?s=${h.id}`} className="truncate underline">{h.title}</Link><DeleteSession id={h.id} /></li>)}</ul></section>}
    </div>
  );
}
