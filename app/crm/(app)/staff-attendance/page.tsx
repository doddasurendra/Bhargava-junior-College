import { markStaffAction } from '@/app/crm/staff-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { ROLE_LABELS } from '@/lib/crm/types';
import { formatDate, todayIST } from '@/lib/dates';
import { STAFF_ATTENDANCE } from '@/lib/records/collections';
import { staffDay } from '@/lib/school/staffAttendance';

export const metadata = { title: 'Staff attendance' };
const LABEL: Record<string, string> = { present: 'Present', absent: 'Absent', half_day: 'Half day', leave: 'Leave', not_marked: 'Not marked' };

/** Principal, admin office, management and Super Admin: everyone's day, with corrections (reason required). */
export default async function StaffAttendancePage({ searchParams }: { searchParams: { date?: string } }) {
  const user = await requireStaff('staff.attendance');
  const today = todayIST();
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) && searchParams.date <= today ? searchParams.date : today;
  const rows = await staffDay(user, date);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Staff attendance</h1>
          <p className="text-sm text-muted">{formatDate(date)} · {count('present')} present · {count('half_day')} half day · {count('absent')} absent · {count('leave')} on leave · {count('not_marked')} not marked</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} max={today} className="input py-1.5 text-sm" aria-label="Date" />
          <button className="btn-outline py-1.5 text-sm">Show</button>
        </form>
      </div>
      <Panel title="Everyone">
        <div className="overflow-x-auto">
          <table className="table-base min-w-[640px] text-sm">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-heading">{r.name}</td>
                  <td className="text-xs text-muted">{r.roles.map((x) => ROLE_LABELS[x]).join(', ')}</td>
                  <td className={r.status === 'absent' ? 'font-semibold text-maroon dark:text-gold' : r.status === 'not_marked' ? 'text-muted' : ''}>{LABEL[r.status]}{r.corrections ? ` · ${r.corrections} correction${r.corrections === 1 ? '' : 's'}` : ''}</td>
                  <td className="font-mono">{r.checkIn ?? ''}</td>
                  <td className="font-mono">{r.checkOut ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Mark or correct">
        <QuickForm action={markStaffAction} submit="Save" cols={4} fields={[
          { name: 'staffId', label: 'Staff member', type: 'select', required: true, options: rows.map((r) => ({ value: r.id, label: r.name })) },
          { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: date },
          { name: 'status', label: 'Status', type: 'select', options: STAFF_ATTENDANCE.map((s) => ({ value: s, label: LABEL[s] })) },
          { name: 'reason', label: 'Reason (kept on record)', type: 'text', required: true },
        ]} />
      </Panel>
    </div>
  );
}
