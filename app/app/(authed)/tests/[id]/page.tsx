import Link from 'next/link';
import { notFound } from 'next/navigation';
import { startTestAction } from '@/app/app/portal-actions';
import { requireStudent } from '@/lib/app/portal';
import { todayIST } from '@/lib/dates';
import { testResults, tests } from '@/lib/records/collections';
import { batchOf, store } from '@/lib/school/common';
import { weakChapters } from '@/lib/school/logic';
import { TestRunner } from './TestRunner';

export const metadata = { title: 'Test' };

export default async function TakeTestPage({ params, searchParams }: { params: { id: string }; searchParams: { done?: string; error?: string } }) {
  const { p } = await requireStudent();
  const t = await tests.get(store(), params.id);
  const b = await batchOf(p.studentId);
  if (!t || t.data.mode !== 'online' || !b || b.id !== t.data.batchId) notFound();
  const r = (await testResults.list(store(), { k1: t.id, k2: p.studentId }))[0]?.data;

  if (r?.submittedAt) {
    const weak = weakChapters(r.byChapter);
    return (
      <div className="space-y-3">
        <Link href="/app/tests" className="text-sm text-muted underline">← Tests</Link>
        <h1 className="font-display text-2xl text-heading">{t.data.title}</h1>
        {searchParams.done === 'late' && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">Submitted after the time limit, so the answers could not be counted.</p>}
        {t.data.published ? (
          <section className="card p-4">
            <p className="font-mono text-3xl font-semibold text-heading">{r.score}<span className="text-lg text-muted">/{r.max}</span></p>
            <ul className="mt-2 text-sm">{Object.entries(r.bySubject).map(([s, v]) => <li key={s} className="flex justify-between"><span>{s}</span><span className="font-mono">{v}</span></li>)}</ul>
            {weak.length > 0 && <p className="mt-3 text-sm"><span className="font-semibold">Revise:</span> {weak.map((w) => w.chapter).join(', ')}</p>}
            <Link href="/app/results" className="mt-3 inline-block text-sm underline">Full analytics</Link>
          </section>
        ) : (
          <p className="card p-4 text-sm">Submitted. Your score, rank and analysis appear here when the exam cell publishes the results.</p>
        )}
      </div>
    );
  }

  if (!r?.startedAt) {
    return (
      <div className="space-y-3">
        <Link href="/app/tests" className="text-sm text-muted underline">← Tests</Link>
        <h1 className="font-display text-2xl text-heading">{t.data.title}</h1>
        {searchParams.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{searchParams.error}</p>}
        <section className="card space-y-2 p-4 text-sm">
          <p>{t.data.questions.length} questions · {t.data.durationMin} minutes · max {t.data.maxMarks} marks</p>
          <p className="text-muted">Correct answers earn marks; wrong answers lose the negative marks shown on each question; skipped questions score zero. The timer keeps running if you leave the page.</p>
          {t.data.date > todayIST() ? <p className="font-semibold">This test opens on its date.</p> : (
            <form action={startTestAction}><input type="hidden" name="testId" value={t.id} /><button className="btn-primary w-full py-3">Start the test</button></form>
          )}
        </section>
      </div>
    );
  }

  // in progress: questions without the answer key
  const questions = t.data.questions.map((q) => ({ id: q.id, subject: q.subject, text: q.text, options: q.options, marks: q.marks, negative: q.negative }));
  const endsAt = new Date(r.startedAt).getTime() + t.data.durationMin * 60_000;
  return <TestRunner testId={t.id} title={t.data.title} questions={questions} endsAt={endsAt} />;
}
