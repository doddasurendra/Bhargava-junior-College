import { applyLeaveAction } from '@/app/app/practice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate, todayIST } from '@/lib/dates';
import { leaveForStudent } from '@/lib/school/backoffice';

export const metadata = { title: 'Leave' };
export const dynamic = 'force-dynamic';

const day = (d: string) => formatDate(d, { day: 'numeric', month: 'short' });

export default async function AppLeavePage() {
  const { p } = await requireEnrolled();
  const list = await leaveForStudent(p.studentId);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Leave application</h1>
      {p.kind === 'parent' ? (
        <section className="card p-4">
          <p className="mb-2 text-xs text-muted">For day scholars. Hostel students use the out-pass.</p>
          <QuickForm action={applyLeaveAction} submit="Apply for leave" fields={[
            { name: 'from', label: 'From', type: 'date', required: true, defaultValue: todayIST() },
            { name: 'to', label: 'To', type: 'date' },
            { name: 'reason', label: 'Reason', type: 'textarea', required: true, rows: 2, wide: true },
          ]} />
        </section>
      ) : <p className="card p-4 text-sm text-muted">Your parent applies for leave from their login.</p>}
      {list.length > 0 && list.map((l) => (
        <article key={l.id} className="card p-4 text-sm">
          <p className="font-semibold text-heading">{day(l.from)}{l.to !== l.from ? ` – ${day(l.to)}` : ''} · <span className={l.status === 'approved' ? 'text-emerald-700 dark:text-emerald-300' : l.status === 'rejected' ? 'text-maroon' : 'text-muted'}>{l.status}</span></p>
          <p className="mt-1">{l.reason}</p>
          {l.note && <p className="mt-1 text-xs text-muted">Teacher: {l.note}</p>}
        </article>
      ))}
    </div>
  );
}
