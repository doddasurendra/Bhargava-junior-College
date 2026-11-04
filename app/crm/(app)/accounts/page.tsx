import Link from 'next/link';
import { feeDecisionAction, feeRequestAction, remindersAction, scheduleAction } from '@/app/crm/school-actions';
import { ActionButton, QuickForm, type QField } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { addDays, formatDate, todayIST } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { dailyCollection, duesList, feeRequestsFor } from '@/lib/school/accounts';
import { allStudents } from '@/lib/school/common';

export const metadata = { title: 'Accounts' };

export default async function AccountsPage({ searchParams }: { searchParams: { date?: string } }) {
  const user = await requireStaff();
  const canDues = can(user, 'fees.dues');
  const today = todayIST();
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : today;
  const [dues, requests, students, collection] = await Promise.all([canDues ? duesList(user) : Promise.resolve([]), feeRequestsFor(user), allStudents(), can(user, 'fees.export') ? dailyCollection(user, date) : Promise.resolve([])]);
  const pending = requests.filter((r) => r.status === 'pending');
  const name = new Map(students.map((s) => [s.leadId, s.fullName]));
  const scheduleFields: QField[] = [
    { name: 'studentId', label: 'Student', type: 'select', required: true, wide: true, options: students.map((s) => ({ value: s.id, label: `${s.fullName} · ${s.collegeId}` })) },
    ...[0, 1, 2].flatMap((i) => [
      { name: `due${i}`, label: `Instalment ${i + 1} due`, type: 'date' as const, defaultValue: i === 0 ? today : addDays(today, 90 * i) },
      { name: `amount${i}`, label: `Amount (₹)`, type: 'number' as const, min: 0 },
    ]),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Accounts</h1>
          <p className="text-sm text-muted">Dues, reminders, concessions and refunds, daily collection and Tally export. Offline payments are approved in <Link href="/crm/verification" className="underline">Verification</Link>.</p>
        </div>
        {canDues && <ActionButton action={remindersAction} label="Send due reminders" className="btn-primary py-2" />}
      </div>

      {canDues && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Outstanding" value={formatINR(dues.reduce((s, d) => s + d.outstanding, 0))} />
          <Stat label="Overdue" value={formatINR(dues.reduce((s, d) => s + d.overdue, 0))} tone={dues.some((d) => d.overdue) ? 'alert' : 'good'} />
          <Stat label="Requests awaiting approval" value={pending.length} tone={pending.length ? 'warn' : 'default'} />
        </div>
      )}

      {canDues && (
        <Panel title="Dues">
          {dues.length === 0 ? <Empty>No instalment plans yet. Add one below.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[640px] text-[13px]">
                <thead><tr><th>Student</th><th className="text-right">Outstanding</th><th className="text-right">Overdue</th><th>Next instalment</th></tr></thead>
                <tbody>
                  {dues.map((d) => (
                    <tr key={d.scheduleId}>
                      <td><Link href={`/crm/students/${d.student.id}`} className="font-medium text-heading hover:underline">{d.student.fullName}</Link></td>
                      <td className="text-right font-mono">{formatINR(d.outstanding)}</td>
                      <td className={`text-right font-mono ${d.overdue ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{formatINR(d.overdue)}</td>
                      <td>{d.next ? `${formatINR(d.next.outstanding)} on ${formatDate(d.next.due, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Paid up'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-semibold text-heading">Instalment plan</p>
            <QuickForm action={scheduleAction} submit="Save plan" cols={2} fields={scheduleFields} />
          </div>
        </Panel>
      )}

      <Panel title="Concessions & refunds">
        {requests.length === 0 ? <Empty>No requests.</Empty> : (
          <ul className="-my-2 mb-3 divide-y divide-line text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-semibold capitalize">{r.kind}</span> {formatINR(r.amount)}{r.percentOfTuition !== null ? ` (${r.percentOfTuition}% of tuition)` : ''} · {name.get(r.leadId) ?? 'Applicant'} · {r.reason} · <span className={r.status === 'pending' ? 'text-maroon dark:text-gold' : 'text-muted'}>{r.status}{r.status === 'pending' ? ` · needs ${r.kind === 'refund' || r.level === 'above' ? 'Management' : 'Admission Manager'}` : ''}</span></span>
                {r.canDecide && (
                  <span className="flex gap-2">
                    <ActionButton action={feeDecisionAction} label="Approve" hidden={{ id: r.id, decision: 'approve' }} />
                    <ActionButton action={feeDecisionAction} label="Reject" hidden={{ id: r.id, decision: 'reject' }} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {(can(user, 'concession.request') || can(user, 'refund.request')) && (
          <QuickForm action={feeRequestAction} submit="Request" cols={2} fields={[
            { name: 'kind', label: 'Kind', type: 'select', options: [...(can(user, 'concession.request') ? [{ value: 'concession', label: 'Concession' }] : []), ...(can(user, 'refund.request') ? [{ value: 'refund', label: 'Refund' }] : [])] },
            { name: 'leadId', label: 'Student', type: 'select', required: true, options: students.map((s) => ({ value: s.leadId, label: s.fullName })) },
            { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 1 },
            { name: 'reason', label: 'Reason', type: 'text', required: true },
          ]} />
        )}
      </Panel>

      {can(user, 'fees.export') && (
        <Panel title={`Daily collection · ${formatDate(date)}`} actions={<form method="get" className="flex gap-2"><input type="date" name="date" defaultValue={date} className="input py-1 text-xs" /><button className="btn-outline py-1 text-xs">Show</button></form>}>
          {collection.length === 0 ? <Empty>No approved payments on this day.</Empty> : (
            <table className="table-base text-sm">
              <thead><tr><th>Receipt</th><th>Student</th><th>Mode</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{collection.map((p) => <tr key={p.id}><td className="font-mono">{p.receiptNo ?? '—'}</td><td>{p.student}</td><td>{p.mode}</td><td className="text-right font-mono">{formatINR(p.amount)}</td></tr>)}</tbody>
            </table>
          )}
          <p className="mt-2 text-sm font-semibold">Total {formatINR(collection.reduce((s, p) => s + p.amount, 0))}</p>
          <form method="get" action="/crm/accounts/tally" className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4 text-sm">
            <label>From <input type="date" name="from" defaultValue={`${today.slice(0, 8)}01`} className="input py-1 text-xs" /></label>
            <label>To <input type="date" name="to" defaultValue={today} className="input py-1 text-xs" /></label>
            <button className="btn-outline py-1.5">Download Tally CSV</button>
          </form>
        </Panel>
      )}
    </div>
  );
}
