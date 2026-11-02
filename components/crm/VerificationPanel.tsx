import Link from 'next/link';
import { PAYMENT_MODES, type ChecklistItem } from '@/content/sample';
import { can } from '@/lib/crm/permissions';
import type { CrmLead, Staff } from '@/lib/crm/types';
import { canApproveReversal, canRequestReversal, canSignOff, type DocStatus, type StepState, type VerificationRecord } from '@/lib/crm/verification';
import { formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { CollegeIdButton, DocumentButtons, PaymentDecision, PaymentForm, ReceiptButton, ReversalDecision, ReversalRequest, SignOffForm, StudentForm } from './verifyForms';

const DOC_LABEL: Record<DocStatus, { text: string; cls: string }> = {
  pending: { text: 'Pending', cls: 'bg-bg text-muted' },
  received: { text: 'Received', cls: 'bg-gold-100 text-navy' },
  verified: { text: 'Verified', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100' },
  not_applicable: { text: 'N/A', cls: 'bg-bg text-muted' },
  rejected: { text: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-100' },
};

export function VerificationPanel({
  user,
  lead,
  record,
  steps,
  checklist,
  names,
}: {
  user: Staff;
  lead: CrmLead;
  record: VerificationRecord;
  steps: StepState[];
  checklist: ChecklistItem[];
  names: (id: string | null) => string;
}) {
  const step = (s: StepState['stage']) => steps.find((x) => x.stage === s)!;
  const doneCount = steps.filter((s) => s.done).length;
  const approvedTotal = record.payments.filter((p) => p.status === 'approved').reduce((n, p) => n + p.amount, 0);
  const collegeId = record.student?.collegeId;
  const mine = (s: StepState) => !s.done && canSignOff(user, s.stage);
  const pendingFor = (stage: StepState['stage']) => record.reversals.find((r) => r.stage === stage && r.status === 'pending');

  const Header = ({ s, n }: { s: StepState; n: number }) => (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-3">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? 'bg-gold text-navy-950' : 'border-2 border-line text-muted'}`}>{s.done ? '✓' : n}</span>
        <div>
          <p className="font-semibold text-heading">{s.label}</p>
          <p className="text-xs text-muted">
            Owner: {s.owner}
            {s.done && ` · signed off by ${names(s.done.signedOffBy)}, ${formatDateTime(s.done.at)}`}
            {s.done?.note && ` · ${s.done.note}`}
          </p>
        </div>
      </div>
      {!s.done && s.blockers.length > 0 && <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">Waiting</span>}
      {!s.done && s.blockers.length === 0 && <span className="rounded-full bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold text-maroon dark:text-gold">Ready to sign off</span>}
      {s.done && !collegeId && !pendingFor(s.stage) && canRequestReversal(user, s.stage) && <ReversalRequest leadId={lead.id} stage={s.stage} />}
      {pendingFor(s.stage) && (
        <div className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50">
          <p>
            <strong>Reversal requested</strong> by {names(pendingFor(s.stage)!.requestedBy)}, {formatDateTime(pendingFor(s.stage)!.requestedAt)}: “{pendingFor(s.stage)!.reason}”
          </p>
          {canApproveReversal(user, pendingFor(s.stage)!) ? (
            <div className="mt-2">
              <ReversalDecision leadId={lead.id} reversalId={pendingFor(s.stage)!.id} />
              {s.stage === 'application' && record.student && <p className="mt-1 text-xs">Approving also removes the student record (a copy is kept in the audit trail).</p>}
              {s.stage === 'fee' && step('receipt').done && <p className="mt-1 text-xs">Approving also reopens the receipt step. Receipts already issued stay valid.</p>}
            </div>
          ) : (
            <p className="mt-1 text-xs">Waiting for {pendingFor(s.stage)!.requestedBy === user.id ? 'another' : 'a'} manager to approve.</p>
          )}
        </div>
      )}
    </div>
  );

  const Blockers = ({ s, indent = true }: { s: StepState; indent?: boolean }) =>
    !s.done && s.blockers.length > 0 ? (
      <ul className={`${indent ? 'ml-10' : ''} mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted`}>
        {s.blockers.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    ) : null;

  return (
    <section className="rounded-2xl border-2 border-gold/50 bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-sans text-sm font-semibold text-heading">Admission verification checkpoint</h2>
          <p className="text-xs text-muted">Every step is signed off by its owner. The College ID unlocks only when steps 1–5 are complete.</p>
        </div>
        <span className="font-mono text-sm font-semibold">{doneCount}/6</span>
      </header>
      <ol className="divide-y divide-line">
        {/* 1 Application */}
        <li className="p-4">
          <Header s={step('application')} n={1} />
          <Blockers s={step('application')} />
          {mine(step('application')) && step('application').blockers.length === 0 && (
            <div className="ml-10 mt-3">
              <SignOffForm leadId={lead.id} stage="application" label="Mark application completed" />
            </div>
          )}
        </li>

        {/* 2 Documents */}
        <li className="p-4">
          <Header s={step('documents')} n={2} />
          <div className="ml-10 mt-3 overflow-x-auto">
            <table className="table-base text-[13px]">
              <tbody>
                {checklist.map((d) => {
                  const row = record.documents.find((x) => x.key === d.key);
                  const st = DOC_LABEL[row?.status ?? 'pending'];
                  return (
                    <tr key={d.key}>
                      <td className="py-2">
                        {d.label}
                        {!d.required && !/applicable/i.test(d.label) && <span className="text-xs text-muted"> (if applicable)</span>}
                        {row?.note && <span className="block text-xs text-muted">{row.note}</span>}
                      </td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                        {row?.updatedBy && <span className="block text-[11px] text-muted">{names(row.updatedBy)}</span>}
                      </td>
                      <td className="py-2">{mine(step('documents')) && <DocumentButtons leadId={lead.id} docKey={d.key} required={d.required} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted">DigiLocker fetch comes in a later phase.</p>
          </div>
          {mine(step('documents')) && step('documents').blockers.length === 0 && (
            <div className="ml-10 mt-3">
              <SignOffForm leadId={lead.id} stage="documents" label="Sign off documents" />
            </div>
          )}
        </li>

        {/* 3 Fee */}
        <li className="p-4">
          <Header s={step('fee')} n={3} />
          <div className="ml-10 mt-3 space-y-3">
            {record.payments.length > 0 && (
              <table className="table-base text-[13px]">
                <thead>
                  <tr>
                    <th>Paid on</th>
                    <th className="text-right">Amount</th>
                    <th>Mode / ref</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {record.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paidOn, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="text-right font-mono">{formatINR(p.amount)}</td>
                      <td>
                        {PAYMENT_MODES.find((m) => m.value === p.mode)?.label ?? p.mode}
                        {p.reference && <span className="block font-mono text-xs text-muted">{p.reference}</span>}
                      </td>
                      <td>
                        <span className="capitalize">{p.status.replace('_', ' ')}</span>
                        <span className="block text-[11px] text-muted">
                          by {names(p.recordedBy)}
                          {p.approvedBy && p.status !== 'pending_approval' && ` · ${p.status} by ${names(p.approvedBy)}`}
                        </span>
                      </td>
                      <td>
                        {p.status === 'pending_approval' && can(user, 'payment.approve') && <PaymentDecision leadId={lead.id} paymentId={p.id} />}
                        {p.receiptNo && (
                          <Link href={`/crm/receipts/${p.id}`} className="font-mono text-xs font-semibold text-maroon underline dark:text-gold" target="_blank">
                            {p.receiptNo}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-xs text-muted">Approved total: <span className="font-mono font-semibold text-ink">{formatINR(approvedTotal)}</span></p>
            {!step('fee').done && can(user, 'payment.record') && lead.status === 'confirmed' && <PaymentForm leadId={lead.id} today={todayIST()} approvesDirectly={can(user, 'payment.approve')} />}
          </div>
          <Blockers s={step('fee')} />
          {mine(step('fee')) && step('fee').blockers.length === 0 && (
            <div className="ml-10 mt-3">
              <SignOffForm leadId={lead.id} stage="fee" label="Confirm fee payment" />
            </div>
          )}
        </li>

        {/* 4 Receipt */}
        <li className="p-4">
          <Header s={step('receipt')} n={4} />
          <Blockers s={step('receipt')} />
          {mine(step('receipt')) && step('receipt').blockers.length === 0 && (
            <div className="ml-10 mt-3">
              <ReceiptButton leadId={lead.id} />
              <p className="mt-1 text-[11px] text-muted">Numbers every approved payment. WhatsApp and email delivery of the PDF comes with the messaging provider.</p>
            </div>
          )}
        </li>

        {/* 5 Student record */}
        <li className="p-4">
          <Header s={step('student_record')} n={5} />
          <Blockers s={step('student_record')} />
          {record.student && (
            <p className="ml-10 mt-2 text-sm">
              {record.student.fullName} · born {formatDate(record.student.dob, { day: 'numeric', month: 'short', year: 'numeric' })} · <span className="capitalize">{record.student.gender}</span> · {record.student.stay === 'hostel' ? 'Hostel' : 'Day scholar'} · guardian {record.student.guardianName} ({record.student.guardianPhone})
            </p>
          )}
          {mine(step('student_record')) && step('student_record').blockers.length === 0 && (
            <div className="ml-10 mt-3">
              <StudentForm
                leadId={lead.id}
                defaults={{ fullName: lead.studentName ?? '', program: lead.program ?? '', guardianName: lead.parentName ?? lead.contactName ?? '', guardianPhone: lead.phone }}
              />
            </div>
          )}
        </li>

        {/* 6 College ID */}
        <li className="p-4">
          <Header s={step('college_id')} n={6} />
          {collegeId ? (
            <div className="ml-10 mt-3 inline-flex flex-col rounded-xl bg-navy px-5 py-3 text-white">
              <span className="text-[11px] uppercase tracking-[0.16em] text-gold-300">College ID</span>
              <span className="font-mono text-2xl font-semibold">{collegeId}</span>
            </div>
          ) : (
            <div className="ml-10 mt-3">
              {canSignOff(user, 'college_id') && <CollegeIdButton leadId={lead.id} disabled={step('college_id').blockers.length > 0} />}
              <Blockers s={step('college_id')} indent={false} />
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
