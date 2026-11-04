import { complaintAction, outpassRequestAction, parentOutpassAction } from '@/app/app/portal-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { getAppStore } from '@/lib/app/service';
import { formatDateTime } from '@/lib/dates';
import { outpassesFor } from '@/lib/school/operations';

export const metadata = { title: 'Out-pass' };

const STATUS: Record<string, string> = { requested: 'Waiting for parent', parent_approved: 'Parent approved · waiting for warden', approved: 'Approved', rejected: 'Declined', returned: 'Returned' };

/** Student requests → parent approves in the app → warden approves (§9A rows 13, 17, 18). */
export default async function OutpassPage() {
  const { p } = await requireEnrolled();
  const student = await getAppStore().getStudent(p.studentId);
  if (student?.stay !== 'hostel') return <p className="card p-4 text-sm text-muted">Out-passes are for hostellers.</p>;
  const list = (await outpassesFor(p.studentId)).sort((a, b) => b.from.localeCompare(a.from));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Hostel out-pass</h1>
      {p.kind === 'student' && (
        <section className="card p-4">
          <QuickForm action={outpassRequestAction} submit="Request out-pass" cols={1} fields={[
            { name: 'from', label: 'Leaving', type: 'datetime-local', required: true },
            { name: 'to', label: 'Returning', type: 'datetime-local', required: true },
            { name: 'reason', label: 'Reason', type: 'text', required: true },
          ]} />
        </section>
      )}
      <ul className="space-y-2">
        {list.map((o) => (
          <li key={o.id} className="card p-3 text-sm">
            <p className="font-medium text-heading">{formatDateTime(o.from)} → {formatDateTime(o.to)}</p>
            <p className="text-[11px] text-muted">{o.reason} · {STATUS[o.status]}{o.note ? ` · ${o.note}` : ''}</p>
            {p.kind === 'parent' && o.status === 'requested' && (
              <div className="mt-2 flex gap-2">
                <ActionButton action={parentOutpassAction} label="Approve" hidden={{ id: o.id, decision: 'approve' }} className="btn-primary py-1.5 text-sm" />
                <ActionButton action={parentOutpassAction} label="Decline" hidden={{ id: o.id, decision: 'reject' }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {p.kind === 'student' && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold text-heading">Hostel complaint</p>
          <QuickForm action={complaintAction} submit="Send to the warden" cols={1} fields={[
            { name: 'category', label: 'About', type: 'select', options: [{ value: 'food', label: 'Food' }, { value: 'room', label: 'Room' }, { value: 'cleanliness', label: 'Cleanliness' }, { value: 'safety', label: 'Safety' }, { value: 'other', label: 'Other' }] },
            { name: 'text', label: 'What’s wrong?', type: 'textarea', required: true },
          ]} />
        </section>
      )}
    </div>
  );
}
