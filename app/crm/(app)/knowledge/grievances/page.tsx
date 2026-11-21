import { grievanceReplyAction } from '@/app/crm/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDateTime } from '@/lib/dates';
import { kbGrievances } from '@/lib/kb/collections';
import { getRecordStore } from '@/lib/records';
import { studentsById } from '@/lib/school/common';

export const metadata = { title: 'Grievances' };

/** Student and parent grievances raised from the app (§3, §5, §8). */
export default async function GrievancesPage() {
  await requireStaff('grievance.handle');
  const [rows, byId] = await Promise.all([kbGrievances.list(getRecordStore()), studentsById()]);
  const sorted = rows.sort((a, b) => (a.data.status === 'resolved' ? 1 : 0) - (b.data.status === 'resolved' ? 1 : 0) || b.data.at.localeCompare(a.data.at));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Grievances</h1>
      <Panel title={`${rows.filter((r) => r.data.status !== 'resolved').length} open of ${rows.length}`}>
        {rows.length === 0 ? <Empty>No grievances raised.</Empty> : (
          <ul className="space-y-3">
            {sorted.map((g) => {
              const s = g.data.studentId ? byId.get(g.data.studentId) : null;
              return (
                <li key={g.id} className="rounded-xl border border-line p-3 text-sm">
                  <p className="text-xs text-muted">{formatDateTime(g.data.at)} · {g.data.fromKind} · {g.data.category}{s ? ` · ${s.fullName} (${s.collegeId ?? ''})` : ''} · <b>{g.data.status.replace('_', ' ')}</b></p>
                  <p className="mt-1 whitespace-pre-line">{g.data.text}</p>
                  {g.data.reply && <p className="mt-1 rounded-lg bg-bg p-2 text-xs">Reply: {g.data.reply}</p>}
                  <div className="mt-2"><QuickForm action={grievanceReplyAction} submit="Update" cols={3} reset={false} fields={[{ name: 'id', type: 'hidden', value: g.id }, { name: 'status', label: 'Status', type: 'select', defaultValue: g.data.status, options: [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }] }, { name: 'reply', label: 'Reply (the family sees this in the app)', type: 'text', defaultValue: g.data.reply ?? '', wide: true }]} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
