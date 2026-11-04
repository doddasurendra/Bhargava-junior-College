import { decideStudentLeaveAction, removeHomeworkAction, setHomeworkAction } from '@/app/crm/backoffice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { SUBJECTS } from '@/lib/records/collections';
import { leaveQueue, listHomework } from '@/lib/school/backoffice';

export const metadata = { title: 'Homework' };
export const dynamic = 'force-dynamic';

export default async function HomeworkPage() {
  const user = await requireStaff();
  if (!can(user, 'homework.assign') && !can(user, 'students.view')) return <Panel title="Homework"><p className="text-sm text-muted">Your role doesn’t use homework.</p></Panel>;
  const { batches, open, past } = await listHomework(user);
  const leave = can(user, 'attendance.mark') || can(user, 'leave.approve') ? await leaveQueue(user) : [];
  const canSet = can(user, 'homework.assign') && batches.length > 0;
  const today = todayIST();

  const Item = ({ h }: { h: (typeof open)[number] }) => (
    <li className="flex flex-wrap items-start justify-between gap-3 py-2 text-sm">
      <div>
        <p className="font-medium text-heading">{h.title}</p>
        <p className="text-xs text-muted">{h.batch} · {h.subject} · due {formatDate(h.dueOn, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        {h.details && <p className="mt-1 whitespace-pre-line">{h.details}</p>}
      </div>
      {(can(user, 'academics.manage') || h.setBy === user.id) && <QuickForm action={removeHomeworkAction} submit="Remove" cols={1} fields={[{ name: 'id', type: 'hidden', value: h.id }]} />}
    </li>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Homework & assignments</h1>
      {leave.length > 0 && (
        <Panel title={`Student leave applications (${leave.filter((l) => l.status === 'pending').length} pending)`}>
          <ul className="divide-y divide-line text-sm">
            {leave.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-medium text-heading">{l.student?.fullName ?? 'Student'} <span className="font-mono text-xs text-muted">{l.student?.collegeId}</span></p>
                  <p className="text-xs text-muted">{formatDate(l.from, { day: 'numeric', month: 'short' })}{l.to !== l.from ? ` – ${formatDate(l.to, { day: 'numeric', month: 'short' })}` : ''} · {l.status}</p>
                  <p className="mt-1">{l.reason}</p>
                </div>
                {l.status === 'pending' && (
                  <div className="flex gap-2">
                    <QuickForm action={decideStudentLeaveAction} submit="Approve" cols={1} fields={[{ name: 'id', type: 'hidden', value: l.id }, { name: 'decision', type: 'hidden', value: 'approve' }]} />
                    <QuickForm action={decideStudentLeaveAction} submit="Reject" cols={1} fields={[{ name: 'id', type: 'hidden', value: l.id }, { name: 'decision', type: 'hidden', value: 'reject' }]} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {canSet ? (
        <Panel title="Set homework">
          <QuickForm action={setHomeworkAction} submit="Set homework" fields={[
            { name: 'batchId', label: 'Batch', type: 'select', required: true, options: batches.map((b) => ({ value: b.id, label: b.data.name })) },
            { name: 'subject', label: 'Subject', type: 'select', options: SUBJECTS.map((x) => ({ value: x, label: x })) },
            { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
            { name: 'dueOn', label: 'Due', type: 'date', required: true, defaultValue: today },
            { name: 'details', label: 'Details', type: 'textarea', rows: 3, wide: true },
          ]} />
        </Panel>
      ) : can(user, 'homework.assign') ? (
        <p className="text-sm text-muted">You have no batches yet. Homework can be set once you teach a batch (timetable) or are its class teacher.</p>
      ) : null}
      <Panel title={`Open (${open.length})`}>{open.length === 0 ? <Empty>No open homework.</Empty> : <ul className="divide-y divide-line">{open.map((h) => <Item key={h.id} h={h} />)}</ul>}</Panel>
      {past.length > 0 && <Panel title="Past"><ul className="divide-y divide-line">{past.map((h) => <Item key={h.id} h={h} />)}</ul></Panel>}
    </div>
  );
}
