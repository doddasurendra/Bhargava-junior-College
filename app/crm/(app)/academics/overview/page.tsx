import Link from 'next/link';
import { leaveDecisionAction } from '@/app/crm/school-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { academicOverview } from '@/lib/school/overview';

export const metadata = { title: 'Academic overview' };

export default async function OverviewPage() {
  const user = await requireStaff('academics.view');
  const o = await academicOverview(user);
  const weak = o.batches.filter((b) => b.alerts.length);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Academic overview</h1>
          <p className="text-sm text-muted">Attendance and tests across batches (last 30 days), faculty workload and wellbeing.</p>
        </div>
        <div className="flex gap-2 text-sm">
          {can(user, 'academics.manage') && <Link href="/crm/academics" className="btn-outline py-1.5">Batches & timetable</Link>}
          <Link href="/crm/notices" className="btn-outline py-1.5">Circulars</Link>
          {can(user, 'mentor.notes') && <Link href="/crm/mentor" className="btn-outline py-1.5">Mentoring</Link>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Batches" value={o.batches.length} />
        <Stat label="Weak-batch alerts" value={weak.length} tone={weak.length ? 'warn' : 'good'} />
        <Stat label="Wellbeing alerts (this month)" value={o.wellbeingAlerts} tone={o.wellbeingAlerts ? 'warn' : 'default'} />
        <Stat label="Discipline records (30 days)" value={o.disciplineCount} />
      </div>
      <Panel title="Batches">
        {o.batches.length === 0 ? <Empty>No batches yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px] text-sm">
              <thead><tr><th>Batch</th><th>Program</th><th className="text-right">Students</th><th className="text-right">Attendance</th><th className="text-right">Recent test avg</th><th>Alerts</th></tr></thead>
              <tbody>
                {o.batches.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/crm/academics/batch/${b.id}`} className="font-medium text-heading hover:underline">{b.name}</Link></td>
                    <td>{programShort(b.program)}</td>
                    <td className="text-right font-mono">{b.students}/{b.capacity}</td>
                    <td className="text-right font-mono">{b.attendance === null ? '–' : `${b.attendance}%`}</td>
                    <td className="text-right font-mono">{b.recentAvg === null ? '–' : `${b.recentAvg}%`}</td>
                    <td className="text-maroon dark:text-gold">{b.alerts.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Faculty workload (periods per week)">
          {o.workload.length === 0 ? <Empty>No timetable yet.</Empty> : (
            <ul className="space-y-1 text-sm">{o.workload.map((w) => <li key={w.id} className="flex justify-between"><span>{w.name}</span><span className="font-mono">{w.periods}</span></li>)}</ul>
          )}
        </Panel>
        <Panel title="Leave requests awaiting approval">
          {o.pendingLeave.length === 0 ? <Empty>None.</Empty> : (
            <ul className="-my-2 divide-y divide-line text-sm">
              {o.pendingLeave.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{l.name}: {formatDate(l.from, { day: 'numeric', month: 'short' })} – {formatDate(l.to, { day: 'numeric', month: 'short' })} · {l.reason}</span>
                  {can(user, 'leave.approve') && (
                    <span className="flex gap-2">
                      <ActionButton action={leaveDecisionAction} label="Approve" hidden={{ id: l.id, decision: 'approve' }} />
                      <ActionButton action={leaveDecisionAction} label="Decline" hidden={{ id: l.id, decision: 'reject' }} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
