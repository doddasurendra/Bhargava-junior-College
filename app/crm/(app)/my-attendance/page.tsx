import Link from 'next/link';
import { checkInAction, checkOutAction } from '@/app/crm/staff-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { myAttendance, myLeave } from '@/lib/school/staffAttendance';

export const metadata = { title: 'My attendance' };

const LABEL: Record<string, string> = { present: 'Present', absent: 'Absent', half_day: 'Half day', leave: 'Leave', holiday: 'Sunday', not_marked: 'Not marked' };
const TONE: Record<string, string> = { absent: 'text-maroon dark:text-gold font-semibold', leave: 'text-navy dark:text-white', not_marked: 'text-muted', holiday: 'text-muted' };

/** The signed-in staff member's own attendance only (master prompt §4.H, Example 3). */
export default async function MyAttendancePage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireStaff();
  const today = todayIST();
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) && searchParams.month <= today.slice(0, 7) ? searchParams.month : today.slice(0, 7);
  const [m, leave] = await Promise.all([myAttendance(user, month), myLeave(user)]);
  const todayRow = month === today.slice(0, 7) ? m.days.find((d) => d.date === today) : undefined;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">My attendance</h1>
          <p className="text-sm text-muted">{user.fullName} · only you (and the principal’s office) can see this.</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} className="input py-1.5 text-sm" aria-label="Month" />
          <button className="btn-outline py-1.5 text-sm">Show</button>
        </form>
      </div>

      <Panel title={`Today · ${formatDate(today)}`}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{todayRow?.checkIn ? `Checked in ${todayRow.checkIn}` : 'Not checked in yet'}{todayRow?.checkOut ? ` · checked out ${todayRow.checkOut}` : ''}</span>
          {!todayRow?.checkIn && <ActionButton action={checkInAction} label="Check in" className="btn-primary py-1.5 text-sm" />}
          {todayRow?.checkIn && !todayRow.checkOut && <ActionButton action={checkOutAction} label="Check out" className="btn-outline py-1.5 text-sm" />}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ['Attendance', m.pct === null ? '–' : `${m.pct}%`],
          ['Present', String(m.present)],
          ['Half days', String(m.halfDay)],
          ['Absent', String(m.absent)],
          ['Leave', String(m.leave)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{k}</p>
            <p className="font-display text-2xl text-heading">{v}</p>
          </div>
        ))}
      </div>

      <Panel title={`Daily · ${month}`} actions={<a href={`/crm/my-attendance/export?month=${month}`} className="btn-outline py-1 text-xs">Download CSV</a>}>
        {m.days.length === 0 ? <Empty>No days yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[480px] text-sm">
              <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Note</th></tr></thead>
              <tbody>
                {[...m.days].reverse().map((d) => (
                  <tr key={d.date}>
                    <td>{formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className={TONE[d.status] ?? ''}>{LABEL[d.status]}</td>
                    <td className="font-mono">{d.checkIn ?? ''}</td>
                    <td className="font-mono">{d.checkOut ?? ''}</td>
                    <td className="text-xs text-muted">{d.source === 'admin' ? `Corrected by the office: ${d.history.at(-1)?.reason ?? ''}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="My leave requests" actions={can(user, 'leave.request') ? <Link href="/crm/leave" className="btn-outline py-1 text-xs">Apply for leave</Link> : undefined}>
        {leave.length === 0 ? <Empty>No leave requests.</Empty> : (
          <ul className="-my-2 divide-y divide-line text-sm">
            {leave.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{formatDate(l.from, { day: 'numeric', month: 'short' })} – {formatDate(l.to, { day: 'numeric', month: 'short' })} · {l.reason}</span>
                <span className={l.status === 'approved' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : l.status === 'rejected' ? 'font-semibold text-maroon dark:text-gold' : 'text-muted'}>{l.status === 'pending' ? 'Waiting for approval' : l.status === 'approved' ? 'Approved' : 'Declined'}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
