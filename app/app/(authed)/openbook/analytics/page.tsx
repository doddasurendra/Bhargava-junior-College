import Link from 'next/link';
import { dashboard } from '@/lib/openbook/analytics';
import { obStudent } from '@/lib/openbook/session';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AnalyticsPage() {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'analytics');
  const d = await dashboard(me.studentId, me.examIds);
  const T = d.totals;
  const max = Math.max(1, ...d.trend.map((x) => x.questions));
  const tile = (v: string | number, l: string) => <div className="card p-3 text-center"><p className="font-mono text-xl font-semibold text-heading">{v}</p><p className="text-[11px] text-muted">{l}</p></div>;
  return (
    <div className="space-y-4">
      <H1 sub={pg.sub}>{pg.title}</H1>
      <section className="grid grid-cols-3 gap-2">{tile(T.booksRead, 'books read')}{tile(T.pagesRead, 'pages read')}{tile(`${T.minutesRead}m`, 'reading time')}{tile(T.generated, 'questions generated')}{tile(T.attempted, 'questions attempted')}{tile(T.mocks, 'mock tests')}{tile(T.accuracy === null ? '—' : `${T.accuracy}%`, 'average accuracy')}{tile(`${d.mastered}/${d.conceptCount}`, 'concepts mastered')}{tile(d.path ? `${d.path.progress}%` : '—', 'exam preparation')}</section>
      <section className="card p-4"><h2 className="mb-2 text-sm font-semibold text-heading">Questions practised (14 days)</h2><div className="flex h-24 items-end gap-1">{d.trend.map((x) => <div key={x.date} className="flex-1 rounded-t bg-navy dark:bg-gold" style={{ height: `${(x.questions / max) * 100}%`, minHeight: x.questions ? 3 : 1 }} title={`${x.date}: ${x.questions}`} />)}</div></section>
      <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Subject-wise performance</h2>{d.subjects.length ? <ul className="space-y-1">{d.subjects.map((s) => <li key={s.subject} className="flex items-center gap-2"><span className="w-24">{s.subject}</span><span className="h-2 flex-1 rounded bg-bg"><span className="block h-2 rounded bg-emerald-600" style={{ width: `${s.accuracy}%` }} /></span><span className="w-20 text-right text-xs">{s.accuracy}% · {s.attempts}</span></li>)}</ul> : <p className="text-muted">Practise some questions to see this.</p>}</section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Strong concepts</h2>{d.strong.length ? <ul className="space-y-1">{d.strong.map((c) => <li key={c.conceptKey}>✅ {c.concept} <span className="text-xs text-muted">{Math.round(c.score)}%</span></li>)}</ul> : <p className="text-muted">A concept counts as mastered at 80% over 10+ questions.</p>}</section>
        <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Needs work</h2>{d.weak.length ? <ul className="space-y-1">{d.weak.map((c) => <li key={c.conceptKey}>⚠️ {c.concept} <span className="text-xs text-muted">{Math.round(c.score)}% · {c.chapter}</span></li>)}</ul> : <p className="text-muted">Nothing flagged yet.</p>}</section>
      </div>
      {(d.recommendedBooks.length > 0 || d.practice.length > 0) && <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Recommended next</h2><ul className="space-y-1">{d.practice.map((p) => <li key={p.concept}><Link className="underline" href="/app/openbook/generate">Practise {p.concept}</Link> <span className="text-xs text-muted">({p.reason})</span></li>)}{d.recommendedBooks.map((r) => <li key={r.book.id}><Link className="underline" href={`/app/openbook/book/${r.book.id}`}>Read {r.book.title}</Link> <span className="text-xs text-muted">({r.reason})</span></li>)}</ul></section>}
    </div>
  );
}
