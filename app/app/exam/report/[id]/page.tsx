import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { closedReport } from '@/lib/openbook/closedExam';
import { getAttempt, getMock } from '@/lib/openbook/mocks';
import { obStudent } from '@/lib/openbook/session';

export const metadata = { title: 'Examination report', robots: { index: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const L = 'abcdefgh';

/** Result of a closed-book exam: marks, negative marking, subject / chapter accuracy, time per question, answers, advice. */
export default async function ExamReport({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const a = await getAttempt(me.studentId, params.id).catch(() => null);
  if (!a) notFound();
  const m = await getMock(a.mockId);
  if (!m?.closed) notFound();
  if (a.status !== 'submitted') redirect(`/app/exam/${a.id}`);
  const r = await closedReport(me.studentId, a.id);
  const s = r.summary;
  const neg = Math.round(s.wrong * m.negative * 100) / 100;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <Link href="/app/exams" className="text-sm text-muted underline">← Exams</Link>
      <h1 className="font-display text-2xl text-heading">{m.title}</h1>
      <p className="text-xs text-muted">Submitted {a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}{a.auto ? ' · submitted automatically' : ''}{a.focusLosses ? ` · left the exam window ${a.focusLosses} time${a.focusLosses === 1 ? '' : 's'}` : ''}</p>
      <section className="card grid grid-cols-2 gap-3 p-4 text-center sm:grid-cols-5">
        <div><p className="font-mono text-2xl font-semibold text-heading">{s.score}/{s.max}</p><p className="text-[11px] text-muted">Marks</p></div>
        <div><p className="font-mono text-2xl font-semibold text-emerald-700">{s.correct}</p><p className="text-[11px] text-muted">Correct</p></div>
        <div><p className="font-mono text-2xl font-semibold text-red-700">{s.wrong}</p><p className="text-[11px] text-muted">Incorrect{m.negative ? ` (−${neg})` : ''}</p></div>
        <div><p className="font-mono text-2xl font-semibold">{s.skipped}</p><p className="text-[11px] text-muted">Not answered</p></div>
        <div><p className="font-mono text-2xl font-semibold">{s.accuracy}%</p><p className="text-[11px] text-muted">Accuracy · {Math.round(s.seconds / 60)} min</p></div>
      </section>
      <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Subject-wise</h2>
        <ul className="space-y-1">{r.bySubject.map((x) => <li key={x.subject} className="flex justify-between"><span>{x.subject}</span><span className="font-mono">{x.pct}% · {x.right}✓ {x.wrong}✗ {x.skipped}–</span></li>)}</ul></section>
      <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Chapter-wise accuracy</h2>
        <ul className="space-y-1">{r.chapterRows.map((c) => <li key={c.chapter} className="flex justify-between"><span>{c.chapter}</span><span className={`font-mono ${c.accuracy !== null && c.accuracy < 50 ? 'text-red-700' : ''}`}>{c.accuracy === null ? 'not attempted' : `${c.accuracy}%`} · {c.right}/{c.right + c.wrong}</span></li>)}</ul></section>
      {r.recommendations.length > 0 && <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">How to improve</h2><ul className="list-disc space-y-1 pl-5">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul><p className="mt-2 text-[11px] text-muted">From your answers by fixed rules (not AI-written).</p></section>}
      <section className="space-y-2"><h2 className="font-semibold text-heading">Questions {m.closed.showAnswers ? 'and answers' : '(answers hidden by your teacher)'}</h2>
        {r.questions.map((x, n) => (
          <article key={x.q.id} className="card space-y-1 p-3 text-sm">
            <p className="text-[11px] text-muted">Q{n + 1} · {x.q.subject} · {x.q.chapter} · {x.seconds}s · {x.r ? (x.r.correct === null ? 'not answered' : x.r.correct ? `correct +${x.r.score}` : `incorrect ${x.r.score}`) : 'not answered'}</p>
            <p className="whitespace-pre-line text-heading">{x.q.stem}</p>
            {m.closed!.showAnswers && x.q.options.length > 0 && <ul className="text-xs">{x.q.options.map((o, i) => <li key={i} className={x.q.answer.includes(String(i)) ? 'font-semibold text-emerald-700' : x.given.includes(String(i)) ? 'text-red-700 line-through' : ''}>({L[i]}) {o}</li>)}</ul>}
            {m.closed!.showAnswers && !x.q.options.length && <p className="text-xs">Your answer: {x.given[0] || '—'} · Correct: <b>{x.q.answer.join(', ')}</b></p>}
            {m.closed!.showAnswers && x.q.explanation?.answer && <details className="text-xs"><summary className="cursor-pointer underline">Explanation</summary><p className="mt-1 whitespace-pre-line">{x.q.explanation.explanation ?? x.q.explanation.answer}</p></details>}
          </article>
        ))}
      </section>
    </main>
  );
}
