import Link from 'next/link';
import { Chat } from '@/components/openbook/client';
import { getSession, sessionsOf } from '@/lib/openbook/assistant';
import { aiConfigured } from '@/lib/openbook/llm';
import { obStudent } from '@/lib/openbook/session';
import { DeleteSession } from '../assistant/DeleteSession';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
const MODES = [{ id: 'tutor_explain', label: 'Explain a concept' }, { id: 'tutor_quiz', label: 'Quiz me' }, { id: 'tutor_socratic', label: 'Socratic (guide me)' }, { id: 'tutor_page', label: 'Discuss a page' }];

export default async function TutorPage({ searchParams }: { searchParams: { s?: string } }) {
  const me = await obStudent();
  const history = await sessionsOf(me.studentId, 'tutor');
  const open = searchParams.s ? await getSession(me.studentId, searchParams.s).catch(() => null) : null;
  return (
    <div className="space-y-4">
      <H1 sub="Talk to your tutor in English, Telugu or Hindi. Tap 🎤, speak, and it answers aloud (tap again to interrupt).">Voice Tutor</H1>
      {!aiConfigured() && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">The voice tutor needs the AI service, which the college hasn’t switched on yet.</p>}
      <Chat key={open?.id ?? 'new'} mode="tutor" tasks={MODES} voice initialSession={open?.id ?? null} initialTurns={open?.turns ?? []} />
      <p className="text-[11px] text-muted">The tutor teaches; it won’t do graded work during a live test. If you feel low or unsafe, it will point you to the college counsellor and helplines. There is a daily limit on tutor turns.</p>
      {history.length > 0 && <section className="card p-3 text-sm"><p className="mb-1 font-semibold text-heading">Transcripts (only you can see them)</p><ul className="space-y-1">{history.slice(0, 20).map((h) => <li key={h.id} className="flex justify-between gap-2"><Link href={`/app/openbook/tutor?s=${h.id}`} className="truncate underline">{h.title}</Link><DeleteSession id={h.id} /></li>)}</ul></section>}
    </div>
  );
}
