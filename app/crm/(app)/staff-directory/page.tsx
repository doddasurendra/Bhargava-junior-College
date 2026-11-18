import Link from 'next/link';
import { Empty } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { ROLE_LABELS } from '@/lib/crm/types';
import { staffDirectory } from '@/lib/school/staffAttendance';

export const metadata = { title: 'Staff records' };

/** Admin office and leadership (master prompt §10 “Staff records”). Read-only; accounts are changed in Staff accounts. */
export default async function StaffDirectoryPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireStaff('staff.records');
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 60);
  const rows = (await staffDirectory(user)).filter((s) => !q || [s.name, s.email ?? '', s.profile?.employeeId ?? '', s.profile?.department ?? '', ...s.roles.map((r) => ROLE_LABELS[r])].some((v) => v.toLowerCase().includes(q)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Staff records</h1>
          <p className="text-sm text-muted">{rows.filter((r) => r.active).length} active · read-only{user.roles.includes('super_admin') ? ' · change accounts in ' : ''}{user.roles.includes('super_admin') && <Link href="/crm/staff" className="underline">Staff accounts</Link>}</p>
        </div>
        <form method="get" role="search"><input name="q" defaultValue={q} placeholder="Name, employee ID, department, role" aria-label="Search staff" className="input w-72 py-2 text-sm" /></form>
      </div>
      {rows.length === 0 ? <Empty>No staff match.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="table-base min-w-[860px] text-[13px]">
            <thead><tr><th>Name</th><th>Employee ID</th><th>Department · designation</th><th>Roles</th><th>Teaches</th><th>Contact</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'opacity-60'}>
                  <td className="font-semibold text-heading">{s.name}</td>
                  <td className="font-mono">{s.profile?.employeeId ?? '—'}</td>
                  <td>{s.profile ? `${s.profile.department} · ${s.profile.designation}` : '—'}</td>
                  <td className="text-xs">{s.roles.map((r) => ROLE_LABELS[r]).join(', ')}</td>
                  <td className="text-xs">{s.subjects.length ? `${s.subjects.join(', ')} · ${s.classes.join(', ')}` : '—'}</td>
                  <td className="text-xs">{s.email ?? '—'}<br /><span className="font-mono">{s.phone ? phoneFor(user, s.phone) : ''}</span></td>
                  <td>{s.active ? 'Active' : 'Deactivated'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">Attendance for each person is under <Link href="/crm/staff-attendance" className="underline">Staff attendance</Link>. Employee ID, department and designation come from the approved registration.</p>
    </div>
  );
}
