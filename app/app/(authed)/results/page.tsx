import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { studentResults } from '@/lib/school/academics';
import { weakChapters, type Scored } from '@/lib/school/logic';
import { sharedNotes } from '@/lib/school/mentoring';

export const metadata = { title: 'Results & analytics' };

/** Score, batch rank, percentile, subject- and chapter-wise strengths, time per question (§9 student login). */
export default async function ResultsPage() {
  const { p } = await requireEnrolled();
  const [results, notes] = await Promise.all([studentResults(p.studentId), p.kind === 'parent' ? sharedNotes(p.studentId) : Promise.resolve([])]);
  const chapters: Scored['byChapter'] = {};
  for (const r of results) for (const [k, v] of Object.entries(r.byChapter)) {
    const c = (chapters[k] ??= { right: 0, wrong: 0, skipped: 0 });
    c.right += v.right;
    c.wrong += v.wrong;
    c.skipped += v.skipped;
  }
  const weak = weakChapters(chapters);
  const strong = Object.entries(chapters).filter(([, c]) => c.right + c.wrong >= 2 && c.right / (c.right + c.wrong) >= 0.8).map(([k]) => k);
  const max = Math.max(100, ...results.map((r) => r.pct));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Results</h1>
      {results.length === 0 ? <p className="card p-4 text-sm text-muted">No published results yet.</p> : (
        <>
          <section className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Trend</p>
            <ol className="mt-2 space-y-1.5" aria-label="Score trend">
              {results.map((r) => (
                <li key={r.test.id} className="text-xs">
                  <div className="flex justify-between"><span className="truncate">{r.test.title}</span><span className="font-mono">{Math.round(r.pct)}%</span></div>
                  <div className="mt-0.5 h-2 rounded-full bg-bg"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.pct / max) * 100)}%`, background: 'var(--viz-1)' }} /></div>
                </li>
              ))}
            </ol>
          </section>
          <ul className="space-y-2">
            {[...results].reverse().map((r) => (
              <li key={r.test.id} className="card p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2"><span className="font-medium text-heading">{r.test.title}</span><span className="font-mono font-semibold">{r.score}/{r.max}</span></div>
                <p className="text-[11px] text-muted">{formatDate(r.test.date, { day: 'numeric', month: 'short' })} · rank {r.rank} of {r.of} · percentile {r.percentile}</p>
                {Object.keys(r.bySubject).length > 0 && <p className="mt-1 text-xs">{Object.entries(r.bySubject).map(([s, v]) => `${s} ${v}`).join(' · ')}</p>}
                {Object.keys(r.secondsPerQuestion).length > 0 && <p className="text-[11px] text-muted">Average {Math.round(Object.values(r.secondsPerQuestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(r.secondsPerQuestion).length))} s per question</p>}
              </li>
            ))}
          </ul>
          {(weak.length > 0 || strong.length > 0) && (
            <section className="card p-4 text-sm">
              {strong.length > 0 && <p><span className="font-semibold text-emerald-700 dark:text-emerald-300">Strong:</span> {strong.join(', ')}</p>}
              {weak.length > 0 && <p className="mt-1"><span className="font-semibold text-maroon dark:text-gold">Needs revision:</span> {weak.map((w) => `${w.chapter} (${Math.round(w.accuracy * 100)}%)`).join(', ')}</p>}
            </section>
          )}
        </>
      )}
      {notes.length > 0 && (
        <section className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">From the mentor</p>
          <ul className="mt-2 space-y-2 text-sm">{notes.map((n, i) => <li key={i}><span className="text-[11px] text-muted">{formatDate(n.date, { day: 'numeric', month: 'short' })}</span><p>{n.note}</p></li>)}</ul>
        </section>
      )}
    </div>
  );
}
