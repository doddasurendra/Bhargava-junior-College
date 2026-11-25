import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuestionCard } from '@/components/openbook/client';
import { report } from '@/lib/openbook/mocks';
import { obStudent } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function MockReportPage({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const r = await report(me.studentId, params.id).catch(() => null);
  if (!r || r.attempt.status !== 'submitted') notFound();
  const s = r.summary;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl text-heading">Report · {r.mock.title}</h1>
      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">{s.score}/{s.max}</p><p className="text-[11px] text-muted">score</p></div>
        <div className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">{s.accuracy}%</p><p className="text-[11px] text-muted">accuracy</p></div>
        <div className="card p-3"><p className="font-mono text-2xl font-semibold text-heading">{Math.round(s.seconds / 60)}m</p><p className="text-[11px] text-muted">time used</p></div>
      </section>
      <p className="text-sm">{s.correct} correct · {s.wrong} wrong · {s.skipped} not attempted{r.attempt.auto ? ' · submitted automatically when time ran out' : ''}</p>
      <section className="card p-4 text-sm">
        <h2 className="mb-2 font-semibold text-heading">Topic-wise performance</h2>
        <ul className="space-y-1">{r.topics.map((t) => <li key={t.chapter + t.concept} className="flex items-center gap-2"><span className="w-12 text-right font-mono">{t.pct}%</span><span className="h-2 flex-1 rounded bg-bg"><span className={`block h-2 rounded ${t.pct >= 60 ? 'bg-emerald-600' : 'bg-red-600'}`} style={{ width: `${t.pct}%` }} /></span><span className="w-1/2 truncate text-xs">{t.chapter} › {t.concept} ({t.right}/{t.right + t.wrong + t.skipped})</span></li>)}</ul>
      </section>
      {r.improve.length > 0 && <section className="card p-4 text-sm"><h2 className="mb-1 font-semibold text-heading">Recommended improvement areas</h2><ul className="list-disc space-y-1 pl-5">{r.improve.map((x) => <li key={x}>{x}</li>)}</ul><Link href="/app/openbook/flashcards" className="mt-2 block text-xs underline">Turn your wrong answers into flashcards</Link></section>}
      <h2 className="text-sm font-semibold text-heading">Every question</h2>
      {r.questions.map(({ q, r: res, given, seconds }, i) => (
        <div key={q.id} className="space-y-1">
          <p className="text-xs text-muted">Q{i + 1}: {res?.correct ? '✅ correct' : res?.correct === false ? '❌ wrong' : '— not attempted'} · your answer: {given.length ? given.map((g) => (q.options.length && /^\d$/.test(g) ? `(${'abcd'[Number(g)]})` : g)).join(', ') : '—'} · {seconds}s · {res?.score ?? 0} marks</p>
          {res?.feedback && <p className="whitespace-pre-line rounded bg-bg p-2 text-xs">{res.feedback}</p>}
          <QuestionCard q={{ ...q, similarity: null }} n={i + 1} />
        </div>
      ))}
    </div>
  );
}
