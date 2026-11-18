import Link from 'next/link';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { ROLE_LABELS } from '@/lib/crm/types';
import { todayIST } from '@/lib/dates';
import { myTimetable } from '@/lib/school/academics';
import { allBatches } from '@/lib/school/common';
import { myAttendance, myLeave, myProfile } from '@/lib/school/staffAttendance';

export const metadata = { title: 'My profile' };
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The signed-in staff member's own profile: never anyone else's (there is no id in the URL). */
export default async function MePage() {
  const user = await requireStaff();
  const month = todayIST().slice(0, 7);
  const [p, tt, all, att, leave] = await Promise.all([myProfile(user), myTimetable(user), allBatches(), myAttendance(user, month), myLeave(user)]);
  const batchName = new Map(all.map((b) => [b.id, b.data.name]));
  const roles = user.allRoles ?? user.roles;
  const field = (k: string, v: string | null | undefined) => (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
      <dd className="text-sm text-heading [overflow-wrap:anywhere]">{v || '—'}</dd>
    </div>
  );
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-navy font-display text-2xl text-white dark:bg-gold dark:text-navy-950">{user.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>
        <div>
          <h1 className="font-display text-3xl text-heading">{user.fullName}</h1>
          <p className="text-sm text-muted">{p.profile?.designation ?? roles.map((r) => ROLE_LABELS[r]).join(', ')}{p.profile ? ` · ${p.profile.department}` : ''}</p>
        </div>
      </div>
      <Panel title="Profile">
        <dl className="grid gap-4 sm:grid-cols-3">
          {field('Employee ID', p.profile?.employeeId)}
          {field('Department', p.profile?.department)}
          {field('Designation', p.profile?.designation)}
          {field('Work email', user.email)}
          {field('Mobile', user.phone)}
          {field('Roles', roles.map((r) => ROLE_LABELS[r]).join(', '))}
        </dl>
        {!p.profile && <p className="mt-3 text-xs text-muted">Employee ID, department and designation are added when a registration request is approved. Ask the admin office to update them.</p>}
        <p className="mt-3 text-xs"><Link href="/crm/account" className="underline">Password, two-step verification and devices</Link></p>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="My subjects and classes">
          {p.subjects.length === 0 && p.classTeacherOf.length === 0 ? <Empty>No classes assigned on the timetable.</Empty> : (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs uppercase tracking-wider text-muted">Subjects</dt><dd>{p.subjects.join(', ') || '—'}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted">Classes</dt><dd>{p.classes.join(', ') || '—'} {p.periodsPerWeek ? <span className="text-muted">({p.periodsPerWeek} periods a week)</span> : null}</dd></div>
              {p.classTeacherOf.length > 0 && <div><dt className="text-xs uppercase tracking-wider text-muted">Class teacher of</dt><dd>{p.classTeacherOf.join(', ')}</dd></div>}
            </dl>
          )}
        </Panel>
        <Panel title="This month" actions={<Link href="/crm/my-attendance" className="btn-outline py-1 text-xs">My attendance</Link>}>
          <p className="text-sm">{att.pct === null ? 'No attendance recorded yet.' : `${att.pct}% · ${att.present} present · ${att.absent} absent · ${att.leave} leave`}</p>
          <p className="mt-1 text-sm text-muted">{leave.filter((l) => l.status === 'pending').length} leave request(s) waiting · {leave.filter((l) => l.status === 'approved').length} approved this year</p>
          {can(user, 'leave.request') && <p className="mt-2 text-xs"><Link href="/crm/leave" className="underline">Apply for leave</Link></p>}
        </Panel>
      </div>
      <Panel title="My timetable">
        {tt.length === 0 ? <Empty>No periods.</Empty> : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {tt.map((x) => <li key={x.id} className="rounded-lg bg-bg px-3 py-1.5"><span className="font-mono">{DAYS[x.day]} {x.start}–{x.end}</span> · {x.subject} · {batchName.get(x.batchId)}{x.room ? ` · ${x.room}` : ''}</li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}
