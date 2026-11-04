import { leaveDecisionAction, leaveRequestAction } from '@/app/crm/school-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDate, todayIST } from '@/lib/dates';
import { leaveRequests } from '@/lib/records/collections';
import { store } from '@/lib/school/common';

export const metadata = { title: 'Leave' };

export default async function LeavePage() {
  const user = await requireStaff();
  const approver = can(user, 'leave.approve');
  const [all, staff] = await Promise.all([leaveRequests.list(store()), getCrmRepo().listStaff()]);
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const mine = all.filter((l) => l.data.staffId === user.id);
  const toDecide = approver ? all.filter((l) => l.data.status === 'pending' && l.data.staffId !== user.id) : [];
  const row = (l: (typeof all)[number], decide: boolean) => (
    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>{decide ? `${names.get(l.data.staffId) ?? 'Staff'}: ` : ''}{formatDate(l.data.from, { day: 'numeric', month: 'short' })} – {formatDate(l.data.to, { day: 'numeric', month: 'short' })} · {l.data.reason} · <span className="font-semibold">{l.data.status}</span></span>
      {decide && (
        <span className="flex gap-2">
          <ActionButton action={leaveDecisionAction} label="Approve" hidden={{ id: l.id, decision: 'approve' }} />
          <ActionButton action={leaveDecisionAction} label="Decline" hidden={{ id: l.id, decision: 'reject' }} />
        </span>
      )}
    </li>
  );
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Leave</h1>
      {approver && <Panel title={`To approve (${toDecide.length})`}>{toDecide.length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="-my-2 divide-y divide-line">{toDecide.map((l) => row(l, true))}</ul>}</Panel>}
      {can(user, 'leave.request') && (
        <Panel title="My leave">
          {mine.length === 0 ? <Empty>No requests.</Empty> : <ul className="-my-2 mb-3 divide-y divide-line">{mine.map((l) => row(l, false))}</ul>}
          <QuickForm action={leaveRequestAction} submit="Request leave" cols={3} fields={[
            { name: 'from', label: 'From', type: 'date', required: true, defaultValue: todayIST() },
            { name: 'to', label: 'To', type: 'date', required: true, defaultValue: todayIST() },
            { name: 'reason', label: 'Reason', type: 'text', required: true },
          ]} />
        </Panel>
      )}
    </div>
  );
}
