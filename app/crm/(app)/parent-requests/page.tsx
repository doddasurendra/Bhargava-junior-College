import Link from 'next/link';
import { decideParentRequestAction } from '@/app/crm/parent-request-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { pendingParentRequests } from '@/lib/app/registration';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';

export const metadata = { title: 'Parent access requests' };

/**
 * Parents who registered with a number the college doesn't have for that child. Check the number against
 * the admission file (or call the guardian on record) before approving.
 */
export default async function ParentRequestsPage() {
  const user = await requireStaff('guardians.manage');
  const rows = await pendingParentRequests(user);
  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Parent access requests</h1>
        <p className="text-sm text-muted">{rows.length} waiting. Each phone was verified with a WhatsApp code and knew the child’s College ID and date of birth. Confirm with a parent already on record before approving.</p>
      </div>
      <Panel title="Waiting">
        {rows.length === 0 ? <Empty>No requests waiting.</Empty> : (
          <ul className="-my-3 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <p className="font-semibold text-heading">
                  {r.name} <span className="text-sm font-normal capitalize text-muted">({r.relation})</span> · <span className="font-mono text-sm">{phoneFor(user, r.phone)}</span>
                </p>
                <p className="text-sm">
                  For {r.student ? <Link href={`/crm/students/${r.student.id}`} className="underline">{r.student.fullName}</Link> : 'a student'} {r.student?.collegeId && <span className="font-mono text-xs text-muted">{r.student.collegeId}</span>} · asked {new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
                <p className="text-xs text-muted">Parents on record: {r.guardians.length ? r.guardians.map((g) => `${g.name} (${g.relation}) ${phoneFor(user, g.phone)}`).join(' · ') : 'none'}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <QuickForm action={decideParentRequestAction} submit="Approve access" cols={1} reset={false} fields={[{ name: 'id', type: 'hidden', value: r.id }, { name: 'decision', type: 'hidden', value: 'approve' }, { name: 'note', label: 'Note (optional, e.g. “confirmed with father on call”)', type: 'text' }]} />
                  <QuickForm action={decideParentRequestAction} submit="Decline" cols={1} reset={false} fields={[{ name: 'id', type: 'hidden', value: r.id }, { name: 'decision', type: 'hidden', value: 'reject' }, { name: 'note', label: 'Reason (required)', type: 'text', required: true }]} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
