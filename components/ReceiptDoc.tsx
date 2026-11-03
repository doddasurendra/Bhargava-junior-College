import { Crest } from '@/components/ui';
import { college, fullAddress } from '@/content/college';
import { getProgram } from '@/content/programs';
import { PAYMENT_MODES } from '@/content/sample';
import type { CrmLead } from '@/lib/crm/types';
import { rupeesInWords, type PaymentRow, type StudentRow } from '@/lib/crm/verification';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatINR } from '@/lib/fees';

/** The official fee receipt on the letterhead — the same document in the CRM and the parent app. */
export function ReceiptDoc({ payment, student, lead }: { payment: PaymentRow; student: StudentRow | null; lead: Pick<CrmLead, 'parentName' | 'contactName' | 'studentName' | 'program'> | null }) {
  const program = getProgram(student?.program ?? lead?.program ?? '')?.name ?? '—';
  return (
    <article className="rounded-2xl border border-line bg-white p-6 text-[#151C36] sm:p-8 print:rounded-none print:border-0">
      <header className="flex items-center gap-4 border-b-2 border-[#C9A24A] pb-4">
        <Crest size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl text-[#1D2A5E] sm:text-2xl">{college.name}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7D1F2C]">{college.motto}</p>
          <p className="mt-1 text-xs text-[#565E7A]">{fullAddress}</p>
          <p className="text-xs text-[#565E7A]">
            {college.phones.map((p) => p.display).join(' · ')} · {college.email}
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl text-[#1D2A5E]">Official fee receipt</h1>
        <p className="font-mono text-lg font-semibold">{payment.receiptNo}</p>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {[
          ['Received from', student?.guardianName ?? lead?.parentName ?? lead?.contactName ?? '—'],
          ['Student', student?.fullName ?? lead?.studentName ?? '—'],
          ['Program', program],
          ['College ID', student?.collegeId ?? 'To be issued'],
          ['Payment date', formatDate(payment.paidOn, { day: 'numeric', month: 'long', year: 'numeric' })],
          ['Mode', `${PAYMENT_MODES.find((m) => m.value === payment.mode)?.label ?? payment.mode}${payment.reference ? ` · ${payment.reference}` : ''}`],
        ].map(([k, v]) => (
          <div key={k} className="border-b border-[#DFE2EC] pb-2">
            <dt className="text-xs uppercase tracking-wider text-[#565E7A]">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 rounded-xl bg-[#F4F5F9] p-5">
        <p className="text-xs uppercase tracking-wider text-[#565E7A]">Amount received</p>
        <p className="font-mono text-3xl font-semibold text-[#1D2A5E]">{formatINR(payment.amount)}</p>
        <p className="mt-1 text-sm">{rupeesInWords(payment.amount)}</p>
      </div>

      <footer className="mt-10 flex items-end justify-between gap-4 text-xs text-[#565E7A]">
        <p>
          Issued {payment.receiptAt ? formatDateTime(payment.receiptAt) : ''}
          <br />
          {college.society}
        </p>
        <p className="text-right">
          Computer-generated receipt
          <br />
          Accounts, {college.name}
        </p>
      </footer>
    </article>
  );
}
