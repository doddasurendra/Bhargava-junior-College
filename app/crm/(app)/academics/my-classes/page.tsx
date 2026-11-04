import Link from 'next/link';
import { answerDoubtAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDateTime, todayIST, weekday } from '@/lib/dates';
import { doubtInbox, myTimetable } from '@/lib/school/academics';
import { allBatches, myBatchIds } from '@/lib/school/common';

export const metadata = { title: 'My classes' };
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function MyClassesPage() {
  const user = await requireStaff('attendance.mark');
  const [tt, mine, all, doubts] = await Promise.all([myTimetable(user), myBatchIds(user), allBatches(), can(user, 'doubts.answer') ? doubtInbox(user) : Promise.resolve([])]);
  const today = weekday(todayIST());
  const batchName = new Map(all.map((b) => [b.id, b.data.name]));
  const todays = tt.filter((p) => p.day === today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">My classes</h1>
        <p className="text-sm text-muted">Today’s periods, your batches and open doubts.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Today">
          {todays.length === 0 ? <Empty>No periods today.</Empty> : (
            <ul className="space-y-2 text-sm">
              {todays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2">
                  <span><span className="font-mono">{p.start}–{p.end}</span> · {p.subject} · {batchName.get(p.batchId)}</span>
                  <Link href={`/crm/academics/batch/${p.batchId}`} className="text-xs font-semibold text-maroon underline dark:text-gold">Take attendance</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="My batches">
          {mine.size === 0 ? <Empty>You are not on any timetable yet. The academic coordinator adds you.</Empty> : (
            <ul className="space-y-1 text-sm">
              {[...mine].map((id) => <li key={id}><Link href={`/crm/academics/batch/${id}`} className="font-medium text-heading underline">{batchName.get(id) ?? 'Batch'}</Link></li>)}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Weekly timetable">
        {tt.length === 0 ? <Empty>No periods.</Empty> : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {tt.map((p) => <li key={p.id} className="rounded-lg bg-bg px-3 py-1.5"><span className="font-mono">{DAYS[p.day]} {p.start}</span> · {p.subject} · {batchName.get(p.batchId)}</li>)}
          </ul>
        )}
      </Panel>

      {can(user, 'doubts.answer') && (
        <Panel title={`Doubt inbox (${doubts.length})`}>
          {doubts.length === 0 ? <Empty>No open doubts.</Empty> : (
            <ul className="space-y-4">
              {doubts.map((d) => (
                <li key={d.id} className="rounded-xl border border-line p-3">
                  <p className="text-xs text-muted">{d.studentName} · {d.subject} · {batchName.get(d.batchId)} · {formatDateTime(d.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink">{d.text}</p>
                  {d.imageUrl && <a href={d.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Photo</a>}
                  <div className="mt-2">
                    <QuickForm action={answerDoubtAction} submit="Send answer" cols={1} fields={[{ name: 'doubtId', type: 'hidden', value: d.id }, { name: 'answer', label: 'Answer', type: 'textarea', required: true, maxLength: 4000 }]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      <p className="text-sm"><Link href="/crm/leave" className="underline">Leave requests</Link> · <Link href="/crm/notices" className="underline">Notices</Link></p>
    </div>
  );
}
