import Link from 'next/link';
import { decideCorrectionAction, notifyLowAttendanceAction } from '@/app/crm/analytics-actions';
import { BarList, Donut, MixBars, TableView, TrendChart } from '@/components/crm/charts';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { addDays, formatDate, todayIST } from '@/lib/dates';
import { EXAM_TYPE_LABEL } from '@/lib/records/collections';
import { analysableBatches, attendanceAnalytics, pendingCorrections } from '@/lib/school/attendanceTools';
import { studentsById } from '@/lib/school/common';
import { classPerformance, RULES, subjectComparison } from '@/lib/school/performance';
import { extraTabs } from './tabs';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Q = { tab?: string; from?: string; to?: string; batch?: string; subject?: string; threshold?: string; preset?: string };
const iso = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** Academic year terms (Telangana Intermediate): June–November and December–March. */
function range(q: Q, today: string) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const ay = m >= 6 ? y : y - 1;
  if (q.preset === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (q.preset === 'term1') return { from: `${ay}-06-01`, to: `${ay}-11-30` < today ? `${ay}-11-30` : today };
  if (q.preset === 'term2') return { from: `${ay}-12-01`, to: today };
  if (q.preset === 'year') return { from: `${ay}-06-01`, to: today };
  return { from: iso(q.from) ?? addDays(today, -29), to: iso(q.to) && iso(q.to)! <= today ? iso(q.to)! : today };
}

export default async function AnalyticsPage({ searchParams: q }: { searchParams: Q }) {
  const user = await requireStaff();
  const canAtt = can(user, 'academics.view') || can(user, 'attendance.mark');
  const tabs = [
    ...(canAtt ? [['attendance', 'Attendance']] : []),
    ...(canAtt || can(user, 'tests.manage') ? [['academics', 'Academic performance']] : []),
    ...extraTabs(user),
  ] as [string, string][];
  if (!tabs.length) return <Panel title="Analytics"><p className="text-sm text-muted">Your role has no analytics.</p></Panel>;
  const tab = tabs.some(([k]) => k === q.tab) ? q.tab! : tabs[0][0];
  const today = todayIST();
  const r = range(q, today);
  const bs = await analysableBatches(user);
  const qs = (o: Record<string, string | undefined>) => `/crm/analytics?${new URLSearchParams(Object.entries({ tab, from: r.from, to: r.to, batch: q.batch, subject: q.subject, threshold: q.threshold, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Analytics</h1>
        <p className="text-sm text-muted">Every chart is computed from saved records in the college database. Nothing is estimated unless it says so.</p>
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Analytics sections">{tabs.map(([k, l]) => <Link key={k} href={`/crm/analytics?tab=${k}`} className={k === tab ? 'chip chip-active' : 'chip'}>{l}</Link>)}</nav>
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'academics' && <AcademicsTab />}
      {!['attendance', 'academics'].includes(tab) && (await import('./extra')).ExtraTab({ tab, user, from: r.from, to: r.to, q })}
    </div>
  );

  function Filters({ subjects, extra }: { subjects?: string[]; extra?: React.ReactNode }) {
    return (
      <form method="get" action="/crm/analytics" className="card flex flex-wrap items-end gap-2 p-3 text-sm">
        <input type="hidden" name="tab" value={tab} />
        <label className="text-xs">From<input type="date" name="from" defaultValue={r.from} max={today} className="input mt-1 py-1" /></label>
        <label className="text-xs">To<input type="date" name="to" defaultValue={r.to} max={today} className="input mt-1 py-1" /></label>
        <label className="text-xs">Period<select name="preset" defaultValue={q.preset ?? ''} className="input mt-1 w-auto py-1"><option value="">Dates above</option><option value="month">This month</option><option value="term1">Term 1 (Jun–Nov)</option><option value="term2">Term 2 (Dec–Mar)</option><option value="year">Academic year</option></select></label>
        <label className="text-xs">Class · section<select name="batch" defaultValue={q.batch ?? ''} className="input mt-1 w-auto py-1"><option value="">All I can see</option>{bs.map((b) => <option key={b.id} value={b.id}>{b.data.name} (year {b.data.year} · {b.data.section})</option>)}</select></label>
        {subjects && <label className="text-xs">Subject<select name="subject" defaultValue={q.subject ?? ''} className="input mt-1 w-auto py-1"><option value="">Whole-day register</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}
        {extra}
        <button className="btn-primary px-4 py-1.5">Apply</button>
      </form>
    );
  }

  async function AttendanceTab() {
    const threshold = Math.min(100, Math.max(1, Number(q.threshold) || 75));
    const a = await attendanceAnalytics(user, { from: r.from, to: r.to, batchId: q.batch || null, subject: q.subject || null, threshold });
    const subjects = [...new Set([...a.subjectWise.map((s) => s.subject), ...(q.subject ? [q.subject] : [])])].sort();
    const corrections = await pendingCorrections(user);
    const byId = corrections.length ? await studentsById() : new Map();
    const staff = corrections.length ? new Map((await getCrmRepo().listStaff()).map((s) => [s.id, s.fullName])) : new Map<string, string>();
    const byYear = [1, 2].map((y) => { const rows = a.byBatch.filter((b) => bs.find((x) => x.id === b.id)?.data.year === y); const att = rows.reduce((s, b) => s + b.present + b.late, 0), cnt = rows.reduce((s, b) => s + b.present + b.late + b.absent, 0); return { label: `Year ${y}`, value: cnt ? Math.round((att / cnt) * 1000) / 10 : 0, note: cnt ? null : 'no registers' }; });
    const exp = (fmt: string) => `/api/crm/attendance-report?${new URLSearchParams(Object.entries({ format: fmt, from: r.from, to: r.to, batch: q.batch, subject: q.subject, threshold: String(threshold) }).filter(([, v]) => v) as [string, string][])}`;
    return (
      <>
        <Filters subjects={subjects} extra={<label className="text-xs">Required %<input type="number" name="threshold" min={1} max={100} defaultValue={threshold} className="input mt-1 w-20 py-1" /></label>} />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total students" value={a.totalStudents} />
          <Stat label="Present today" value={a.today_.present + a.today_.late} tone="good" />
          <Stat label="Absent today" value={a.today_.absent} tone={a.today_.absent ? 'warn' : 'default'} />
          <Stat label="Not marked today" value={a.today_.unmarked} tone={a.today_.unmarked ? 'warn' : 'default'} />
          <Stat label="Attendance today" value={a.today_.pct === null ? '–' : `${a.today_.pct}%`} />
          <Stat label={`Attendance ${formatDate(r.from, { day: 'numeric', month: 'short' })}–${formatDate(r.to, { day: 'numeric', month: 'short' })}`} value={a.overall.pct === null ? '–' : `${a.overall.pct}%`} />
        </div>
        <p className="flex flex-wrap gap-3 text-sm">
          <a className="btn-outline py-1.5" href={exp('csv')}>Export to Excel (CSV)</a>
          <a className="btn-outline py-1.5" href={exp('pdf')}>Export PDF</a>
          <span className="self-center text-xs text-muted">{a.registers} register{a.registers === 1 ? '' : 's'} in range · late counts as present; approved leave is left out of the percentage.</span>
        </p>
        {a.registers === 0 ? <Empty>No attendance registers in this range yet.</Empty> : (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Status mix (all marks in range)">
                <Donut label="marks" slices={[{ label: 'Present', value: a.overall.present, color: 'var(--viz-4)' }, { label: 'Late', value: a.overall.late, color: 'var(--viz-2)' }, { label: 'Absent', value: a.overall.absent, color: 'var(--viz-3)' }, { label: 'Leave', value: a.overall.leave, color: 'var(--viz-1)' }]} />
              </Panel>
              <Panel title="Class-wise comparison (year 1 vs year 2)"><BarList rows={byYear} unit="%" color="var(--viz-1)" /></Panel>
            </div>
            <Panel title="Section-wise attendance %"><BarList rows={a.byBatch.map((b) => ({ label: b.name, value: b.pct ?? 0, note: b.pct === null ? 'no registers' : `${b.absent} abs`, hint: `${b.students} students` }))} unit="%" /></Panel>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Monthly attendance trend"><TrendChart rows={a.monthly.map((m) => ({ date: `${m.month}-01`, pct: m.pct ?? 0, absent: m.absent }))} series={[{ key: 'pct', label: 'Attendance %', color: 'var(--viz-1)' }]} max={100} /></Panel>
              <Panel title="Daily attendance %"><TrendChart rows={a.daily.map((d) => ({ date: d.date, pct: d.pct ?? 0 }))} series={[{ key: 'pct', label: 'Attendance %', color: 'var(--viz-4)' }]} max={100} /></Panel>
            </div>
            <Panel title="Status mix by section"><MixBars rows={a.byBatch.map((b) => ({ key: b.name, total: b.present + b.late + b.absent + b.leave, present: b.present, late: b.late, absent: b.absent, leave: b.leave }))} segments={[{ key: 'present', label: 'Present', color: 'var(--viz-4)' }, { key: 'late', label: 'Late', color: 'var(--viz-2)' }, { key: 'absent', label: 'Absent', color: 'var(--viz-3)' }, { key: 'leave', label: 'Leave', color: 'var(--viz-1)' }]} /></Panel>
          </>
        )}
        <Panel title={`Subject-wise attendance (${a.subjectWise.length ? 'subject registers in range' : 'none yet'})`}>
          {a.subjectWise.length ? <BarList rows={a.subjectWise.map((s) => ({ label: s.subject, value: s.pct ?? 0, note: `${s.absent} abs` }))} unit="%" color="var(--viz-2)" /> : <Empty>No subject registers yet. Teachers choose a subject on the batch’s attendance page to take one.</Empty>}
        </Panel>
        <Panel title={`Low-attendance alert: below ${threshold}% (${a.below.length})`}>
          {a.below.length === 0 ? <Empty>Nobody is below {threshold}% in this range.</Empty> : (
            <div className="overflow-x-auto"><table className="table-base min-w-[560px] text-sm">
              <thead><tr><th>Student</th><th>Section</th><th className="text-right">%</th><th className="text-right">Absent</th><th className="text-right">Late</th><th className="text-right">Leave</th><th /></tr></thead>
              <tbody>{a.below.map((s) => <tr key={s.id}><td>{s.name} <span className="font-mono text-xs text-muted">{s.collegeId}</span></td><td>{s.batch}</td><td className="text-right font-mono font-semibold text-maroon dark:text-gold">{s.pct}%</td><td className="text-right font-mono">{s.absent}</td><td className="text-right font-mono">{s.late}</td><td className="text-right font-mono">{s.leave}</td><td><Link className="text-xs underline" href={`/crm/analytics/student/${s.id}`}>Report</Link></td></tr>)}</tbody>
            </table></div>
          )}
          {a.below.length > 0 && (can(user, 'attendance.mark') || can(user, 'academics.manage')) && <div className="mt-3"><QuickForm action={notifyLowAttendanceAction} submit={`Notify these ${a.below.length} famil${a.below.length === 1 ? 'y' : 'ies'}`} cols={1} fields={[{ name: 'from', type: 'hidden', value: r.from }, { name: 'to', type: 'hidden', value: r.to }, { name: 'batch', type: 'hidden', value: q.batch ?? '' }, { name: 'subject', type: 'hidden', value: q.subject ?? '' }, { name: 'threshold', type: 'hidden', value: String(threshold) }]} /></div>}
          <p className="mt-2 text-xs text-muted">The same students appear as early warnings for their mentor. Parents already get the same-day absence alert for every absence; the button sends each family one message in the app (once a day at most).</p>
        </Panel>
        <Panel title={`Attendance correction requests (${corrections.length})`}>
          {corrections.length === 0 ? <Empty>No pending requests.</Empty> : (
            <ul className="divide-y divide-line text-sm">{corrections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{bs.find((b) => b.id === c.batchId)?.data.name ?? 'Batch'} · {c.kind === 'subject' ? c.subject : 'whole day'} · {formatDate(c.date)} · by {staff.get(c.requestedBy) ?? 'teacher'}: <i>{c.reason}</i><br /><span className="text-xs text-muted">{c.changes.map((x) => `${byId.get(x.studentId)?.fullName ?? 'Student'} ${x.from} → ${x.to}`).join(', ')}</span></span>
                {can(user, 'academics.manage') && c.requestedBy !== user.id && <span className="flex gap-1"><ActionButton action={decideCorrectionAction} label="Approve" hidden={{ id: c.id, decision: 'approve' }} /><ActionButton action={decideCorrectionAction} label="Reject" hidden={{ id: c.id, decision: 'reject' }} /></span>}
              </li>))}</ul>
          )}
        </Panel>
        <Panel title="Every student in range">
          <TableView summary={`Show all ${a.students.length} students`}>
            <table className="table-base text-xs"><thead><tr><th>Student</th><th>Section</th><th className="text-right">Days</th><th className="text-right">P</th><th className="text-right">L</th><th className="text-right">A</th><th className="text-right">Lv</th><th className="text-right">%</th></tr></thead>
              <tbody>{a.students.map((s) => <tr key={s.id}><td><Link className="underline" href={`/crm/analytics/student/${s.id}`}>{s.name}</Link></td><td>{s.batch}</td><td className="text-right">{s.days}</td><td className="text-right">{s.present}</td><td className="text-right">{s.late}</td><td className="text-right">{s.absent}</td><td className="text-right">{s.leave}</td><td className="text-right">{s.pct ?? '–'}</td></tr>)}</tbody></table>
          </TableView>
        </Panel>
      </>
    );
  }

  async function AcademicsTab() {
    const batchId = q.batch && bs.some((b) => b.id === q.batch) ? q.batch : bs[0]?.id;
    if (!batchId) return <Empty>No batches you can see yet.</Empty>;
    const c = await classPerformance(user, batchId);
    const cmp = await subjectComparison(user);
    const cmpSubjects = [...new Set(cmp.map((x) => x.subject))].sort();
    const cmpBatches = [...new Set(cmp.map((x) => x.batch))];
    return (
      <>
        <Filters />
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label={`${c.batch.name} · students`} value={c.batch.students} />
          <Stat label="Published exams" value={c.examTrend.length} />
          <Stat label="Class average" value={c.average === null ? '–' : `${c.average}%`} />
          <Stat label="Students needing support" value={c.support.length} tone={c.support.length ? 'warn' : 'good'} />
        </div>
        {c.examTrend.length === 0 ? <Empty>No published results for this batch yet. Analysis starts when the exam cell publishes a test.</Empty> : (
          <>
            <Panel title="Class average by exam (improvement over time)"><TrendChart rows={c.examTrend.map((e) => ({ date: e.date, avg: e.avg }))} series={[{ key: 'avg', label: 'Class average %', color: 'var(--viz-1)' }]} max={100} /></Panel>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Subject-wise average"><BarList rows={c.bySubject.map((s) => ({ label: s.subject, value: s.avg ?? 0, note: `${s.students} st.` }))} unit="%" /></Panel>
              <Panel title="Chapter-wise accuracy (weakest first)">{c.chapters.length ? <BarList rows={c.chapters.slice(0, 12).map((ch) => ({ label: ch.chapter, value: ch.accuracy ?? 0, note: `${ch.attempted} q`, hint: ch.subject }))} unit="%" color="var(--viz-3)" /> : <Empty>Chapter accuracy comes from online tests (offline marks have no per-question data).</Empty>}</Panel>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Top performers">{c.top.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{c.top.map((s) => <li key={s.id}><Link className="underline" href={`/crm/analytics/student/${s.id}`}>{s.name}</Link> · {s.average}%{s.trend !== null ? ` · trend ${s.trend > 0 ? '+' : ''}${s.trend}` : ''}</li>)}</ol> : <Empty>None yet.</Empty>}</Panel>
              <Panel title="Students requiring support">{c.support.length ? <ul className="space-y-1 text-sm">{c.support.map((s) => <li key={s.id}><Link className="underline" href={`/crm/analytics/student/${s.id}`}>{s.name}</Link>: {s.needs.join(', ')}</li>)}</ul> : <Empty>Nobody is flagged.</Empty>}</Panel>
            </div>
            <Panel title="Exams in this batch">
              <table className="table-base text-sm"><thead><tr><th>Date</th><th>Exam</th><th>Type</th><th className="text-right">Avg</th><th className="text-right">Took it</th></tr></thead>
                <tbody>{[...c.examTrend].reverse().map((e) => <tr key={e.date + e.title}><td>{formatDate(e.date)}</td><td>{e.title}</td><td>{EXAM_TYPE_LABEL[e.examType as keyof typeof EXAM_TYPE_LABEL] ?? e.examType}</td><td className="text-right font-mono">{e.avg}%</td><td className="text-right font-mono">{e.takers}</td></tr>)}</tbody></table>
            </Panel>
          </>
        )}
        {cmp.length > 0 && (
          <Panel title="Subject comparison across sections">
            <div className="overflow-x-auto"><table className="table-base text-sm"><thead><tr><th>Section</th>{cmpSubjects.map((s) => <th key={s} className="text-right">{s}</th>)}</tr></thead>
              <tbody>{cmpBatches.map((b) => <tr key={b}><td>{b}</td>{cmpSubjects.map((s) => { const v = cmp.find((x) => x.batch === b && x.subject === s)?.avg; return <td key={s} className="text-right font-mono">{v === undefined || v === null ? '–' : `${v}%`}</td>; })}</tr>)}</tbody></table></div>
          </Panel>
        )}
        <p className="text-xs text-muted">Rules: strong chapter ≥ {RULES.strong}% over ≥ {RULES.minAttempts} questions; weak &lt; {RULES.weak}%; needs support = average &lt; {RULES.lowAvg}%, a fall of {Math.abs(RULES.declining)}+ points (last 3 exams vs the 3 before), or 3+ weak chapters.</p>
      </>
    );
  }
}
