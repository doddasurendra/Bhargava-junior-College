import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarList, Donut } from '@/components/crm/charts';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { examDashboard } from '@/lib/openbook/closedExam';
import { OpenBookError } from '@/lib/openbook/core';

export const metadata = { title: 'Exam results' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EV: Record<string, string> = { start: 'started', resume: 'reopened', blur: 'left the window', hidden: 'switched tab / app', fullscreen_exit: 'left full screen', other_device: 'tried another device', auto_submit: 'auto-submitted', submit: 'submitted' };
const t = (s: string) => new Date(s).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit' });

/** One exam: results, score distribution, chapter accuracy and the suspicious-activity log. */
export default async function ExamDashboardPage({ params }: { params: { id: string } }) {
  const u = await requireStaff();
  let d;
  try { d = await examDashboard(u, params.id); } catch (e) { if (e instanceof OpenBookError) notFound(); throw e; }
  const done = d.rows.filter((r) => r.status === 'submitted');
  const band = (lo: number, hi: number) => done.filter((r) => (r.pct ?? 0) >= lo && (r.pct ?? 0) < hi).length;
  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/crm/exams" className="text-sm text-muted underline">← Exams</Link>
      <div>
        <h1 className="font-display text-3xl text-heading">{d.exam.title}</h1>
        <p className="text-sm text-muted">{d.pattern} · {d.questions} questions · {d.exam.minutes} min · +{d.exam.marks}{d.exam.negative ? ` / −${d.exam.negative}` : ''} · {d.exam.closed?.fullscreen ? 'full screen' : 'windowed'} · {d.exam.closed?.maxFocusLoss ? `auto-submit after ${d.exam.closed.maxFocusLoss} window changes` : 'window changes recorded only'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Submitted" value={`${done.length}/${d.batchSize}`} />
        <Stat label="In progress" value={d.rows.filter((r) => r.status === 'in_progress').length} />
        <Stat label="Average" value={d.average === null ? '–' : `${d.average}%`} />
        <Stat label="Flagged attempts" value={d.suspicious.length} tone={d.suspicious.length ? 'warn' : 'good'} />
      </div>
      {done.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Score distribution"><Donut label="students" slices={[{ label: '75% and above', value: band(75, 101), color: 'var(--viz-4)' }, { label: '50–74%', value: band(50, 75), color: 'var(--viz-1)' }, { label: '25–49%', value: band(25, 50), color: 'var(--viz-2)' }, { label: 'Below 25%', value: band(-1000, 25), color: 'var(--viz-3)' }]} /></Panel>
          <Panel title="Chapter-wise accuracy (all students)">{d.chapters.length ? <BarList rows={d.chapters.map((c) => ({ label: c.chapter, value: c.accuracy ?? 0, note: c.right + c.wrong ? `${c.right}/${c.right + c.wrong} right${c.skipped ? `, ${c.skipped} skipped` : ''}` : `not attempted (${c.skipped} skipped)` }))} unit="%" color="var(--viz-3)" /> : <Empty>No answers yet.</Empty>}</Panel>
        </div>
      )}
      <Panel title="Results">
        {d.rows.length === 0 ? <Empty>Nobody has started yet.</Empty> : (
          <div className="overflow-x-auto"><table className="table-base min-w-[640px] text-sm"><thead><tr><th>Student</th><th>Status</th><th className="text-right">Marks</th><th className="text-right">%</th><th className="text-right">Minutes</th><th className="text-right">Window changes</th></tr></thead>
            <tbody>{d.rows.map((r) => <tr key={r.attemptId}><td><Link className="underline" href={`/crm/analytics/student/${r.studentId}`}>{r.name}</Link> <span className="font-mono text-xs text-muted">{r.collegeId}</span></td><td>{r.status === 'submitted' ? (r.auto ? 'auto-submitted' : 'submitted') : 'in progress'}</td><td className="text-right font-mono">{r.score ?? '–'}{r.max ? `/${r.max}` : ''}</td><td className="text-right font-mono">{r.pct ?? '–'}</td><td className="text-right font-mono">{r.minutes ?? '–'}</td><td className={`text-right font-mono ${r.focusLosses ? 'font-semibold text-maroon' : ''}`}>{r.focusLosses}{r.otherDevice ? ` + ${r.otherDevice} device` : ''}</td></tr>)}</tbody></table></div>
        )}
      </Panel>
      <Panel title={`Suspicious activity (${d.suspicious.length})`}>
        {d.suspicious.length === 0 ? <Empty>No window changes or second devices recorded.</Empty> : (
          <ul className="space-y-2 text-sm">{d.suspicious.map((r) => (
            <li key={r.attemptId}><b>{r.name}</b>: {r.events.filter((e) => !['start', 'submit'].includes(e.kind)).map((e) => `${t(e.at)} ${EV[e.kind] ?? e.kind}${e.detail ? ` (${e.detail})` : ''}`).join(' · ')}</li>
          ))}</ul>
        )}
        <p className="mt-2 text-xs text-muted">These are signals, not proof: a notification can take focus, and a second phone is never visible to the browser. Talk to the student before acting.</p>
      </Panel>
    </div>
  );
}
