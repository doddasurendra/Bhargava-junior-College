import Link from 'next/link';
import { notFound } from 'next/navigation';
import { aiSummaryAction } from '@/app/crm/analytics-actions';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { BarList, TrendChart } from '@/components/crm/charts';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { addDays, formatDate, todayIST } from '@/lib/dates';
import { aiConfigured } from '@/lib/openbook/llm';
import { studentAttendanceHistory } from '@/lib/school/attendanceTools';
import { studentsById } from '@/lib/school/common';
import { canReadStudent, RULES, studentPerformance } from '@/lib/school/performance';

export const metadata = { title: 'Student report' };
export const dynamic = 'force-dynamic';

/** Individual student report: attendance history + chapter-wise performance, from saved records only. Printable. */
export default async function StudentReport({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  if (!(await canReadStudent(user, params.id))) notFound();
  const s = (await studentsById()).get(params.id);
  if (!s) notFound();
  const p = await studentPerformance(s.id);
  const today = todayIST();
  const from = `${Number(today.slice(5, 7)) >= 6 ? today.slice(0, 4) : Number(today.slice(0, 4)) - 1}-06-01`;
  const h = p ? await studentAttendanceHistory(s.id, p.batchId, from, today) : null;
  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <Link href="/crm/analytics?tab=academics" className="text-sm text-muted underline">← Analytics</Link>
        <PrintButton />
      </div>
      <div>
        <h1 className="font-display text-3xl text-heading">{s.fullName}</h1>
        <p className="text-sm text-muted"><span className="font-mono">{s.collegeId}</span> · {p?.batchName ?? 'no batch'} · report generated {formatDate(today)}</p>
      </div>
      {!p ? <Empty>This student is not in a batch yet.</Empty> : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Attendance this academic year" value={h?.overall.pct === null || !h ? '–' : `${h.overall.pct}%`} tone={h?.overall.pct !== null && h && h.overall.pct! < 75 ? 'warn' : 'default'} />
            <Stat label="Exams taken" value={p.exams.length} />
            <Stat label="Average" value={p.average === null ? '–' : `${p.average}%`} />
            <Stat label="Trend (last 3 vs 3 before)" value={p.trend === null ? '–' : `${p.trend > 0 ? '+' : ''}${p.trend}`} tone={p.trend !== null && p.trend <= RULES.declining ? 'warn' : p.trend !== null && p.trend > 0 ? 'good' : 'default'} />
          </div>
          {p.needsAttention.length > 0 && <p role="status" className="rounded-xl bg-gold-100/70 px-4 py-3 text-sm dark:bg-gold/10"><b>Needs attention:</b> {p.needsAttention.join(' · ')}</p>}
          {p.latest && <p className="text-sm">Latest: <b>{p.latest.title}</b> {p.latest.pct}%{p.latest.rank ? ` (rank ${p.latest.rank}/${p.latest.of})` : ''}{p.previous && p.change !== null ? ` · ${p.change >= 0 ? 'up' : 'down'} ${Math.abs(p.change)} points vs ${p.previous.title} (${p.previous.pct}%)` : ''}</p>}
          {p.exams.length === 0 ? <Empty>No published results yet.</Empty> : (
            <>
              <Panel title="Improvement graph: score % by exam"><TrendChart rows={p.exams.map((e) => ({ date: e.date, pct: e.pct }))} series={[{ key: 'pct', label: 'Score %', color: 'var(--viz-1)' }]} /></Panel>
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Subject-wise performance">{p.bySubject.length ? <BarList rows={p.bySubject.map((x) => ({ label: x.subject, value: x.pct ?? 0, note: `${x.score}/${x.max}` }))} unit="%" /> : <Empty>Subject % needs online tests or single-subject tests.</Empty>}</Panel>
                <Panel title="By examination type"><BarList rows={p.byExamType.map((x) => ({ label: x.label, value: x.avg ?? 0, note: `${x.exams} exam${x.exams === 1 ? '' : 's'}` }))} unit="%" color="var(--viz-2)" /></Panel>
              </div>
              <Panel title="Chapter-wise accuracy (online tests)">{p.chapters.length ? <BarList rows={p.chapters.map((c) => ({ label: c.chapter, value: c.accuracy ?? 0, note: `${c.attempted} tried${c.skipped ? `, ${c.skipped} skipped` : ''}`, hint: c.subject }))} unit="%" color="var(--viz-3)" /> : <Empty>No online-test answers yet, so no chapter breakdown.</Empty>}</Panel>
              <div className="grid gap-5 lg:grid-cols-3">
                <Panel title={`Strong chapters (${p.strong.length})`}>{p.strong.length ? <ul className="space-y-1 text-sm">{p.strong.map((c) => <li key={c.chapter}>{c.chapter} · {c.accuracy}%</li>)}</ul> : <Empty>None yet.</Empty>}</Panel>
                <Panel title={`Weak chapters (${p.weak.length})`}>{p.weak.length ? <ul className="space-y-1 text-sm">{p.weak.map((c) => <li key={c.chapter}>{c.chapter} · {c.accuracy ?? 0}%{c.skipped ? ` · ${c.skipped} skipped` : ''}</li>)}</ul> : <Empty>None.</Empty>}</Panel>
                <Panel title={`Weak concepts (${p.weakTopics.length})`}>{p.weakTopics.length ? <ul className="space-y-1 text-sm">{p.weakTopics.map((t) => <li key={t.topic}>{t.topic} · {t.accuracy}%</li>)}</ul> : <Empty>Topic-wise analysis appears when questions carry a topic.</Empty>}</Panel>
              </div>
              <Panel title="Revision and study recommendations">
                {p.recommendations.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{p.recommendations.map((r) => <li key={r}>{r}</li>)}</ul> : <Empty>No weak areas found yet.</Empty>}
                <p className="mt-2 text-xs text-muted">Built from the figures above by fixed rules (strong ≥ {RULES.strong}%, weak &lt; {RULES.weak}% over ≥ {RULES.minAttempts} questions).</p>
                <div className="mt-3 border-t border-line pt-3 print:hidden">
                  {aiConfigured()
                    ? <QuickForm action={aiSummaryAction} submit="Write an AI summary of these figures" reset={false} fields={[{ name: 'studentId', type: 'hidden', value: s.id }]} />
                    : <p className="text-xs text-muted">AI-written summary: not available until ANTHROPIC_API_KEY is added on the server. The analysis above does not need it.</p>}
                </div>
              </Panel>
              <Panel title="All exams">
                <table className="table-base text-sm"><thead><tr><th>Date</th><th>Exam</th><th className="text-right">Score</th><th className="text-right">%</th><th className="text-right">Rank</th></tr></thead>
                  <tbody>{[...p.exams].reverse().map((e) => <tr key={e.testId}><td>{formatDate(e.date)}</td><td>{e.title}</td><td className="text-right font-mono">{e.score}/{e.max}</td><td className="text-right font-mono">{e.pct}%</td><td className="text-right font-mono">{e.rank ? `${e.rank}/${e.of}` : '–'}</td></tr>)}</tbody></table>
              </Panel>
            </>
          )}
          {h && (
            <>
              <Panel title={`Attendance history since ${formatDate(from)}`}>
                {h.monthly.length ? <TrendChart rows={h.monthly.map((m) => ({ date: `${m.month}-01`, pct: m.pct ?? 0 }))} series={[{ key: 'pct', label: 'Attendance %', color: 'var(--viz-4)' }]} /> : <Empty>No registers yet.</Empty>}
                {h.monthly.length > 0 && <table className="table-base mt-3 text-sm"><thead><tr><th>Month</th><th className="text-right">Days</th><th className="text-right">P</th><th className="text-right">L</th><th className="text-right">A</th><th className="text-right">Lv</th><th className="text-right">%</th></tr></thead>
                  <tbody>{h.monthly.map((m) => <tr key={m.month}><td>{m.month}</td><td className="text-right">{m.days}</td><td className="text-right">{m.present}</td><td className="text-right">{m.late}</td><td className="text-right">{m.absent}</td><td className="text-right">{m.leave}</td><td className="text-right font-mono">{m.pct ?? '–'}</td></tr>)}</tbody></table>}
              </Panel>
              {h.bySubject.length > 0 && <Panel title="Subject-wise attendance"><BarList rows={h.bySubject.map((x) => ({ label: x.subject, value: x.pct ?? 0, note: `${x.absent} abs` }))} unit="%" color="var(--viz-2)" /></Panel>}
              {h.days.some((d) => d.mark !== 'present') && <Panel title="Absent, late and leave days"><ul className="text-sm">{h.days.filter((d) => d.mark !== 'present' && d.date >= addDays(today, -120)).reverse().map((d) => <li key={d.date}>{formatDate(d.date)} · {d.mark}{d.remark ? ` · ${d.remark}` : ''}</li>)}</ul></Panel>}
            </>
          )}
        </>
      )}
    </div>
  );
}
