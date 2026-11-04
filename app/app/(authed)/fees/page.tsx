import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PAYMENT_MODES } from '@/content/sample';
import { profileData, requireAppUser } from '@/lib/app/service';
import { formatDate } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { duesForStudent } from '@/lib/school/accounts';
import { PayButton } from './PayButton';

export const metadata = { title: 'Fees' };

export default async function AppFees({ searchParams }: { searchParams: { paid?: string } }) {
  const u = await requireAppUser();
  if (!u.active || u.active.kind === 'alumni') redirect('/app');
  const enrolled = u.active.kind === 'parent' || u.active.kind === 'student';
  const dues = enrolled ? await duesForStudent((u.active as { studentId: string }).studentId) : null;
  const next = dues?.rows.find((r) => r.outstanding > 0) ?? null;
  const d = await profileData(u.active);
  const paid = d.payments.filter((p) => p.status === 'approved').reduce((n, p) => n + p.amount, 0);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Fees & receipts</h1>
      <section className="card p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted">Total paid</p>
        <p className="font-mono text-3xl font-semibold text-heading">{formatINR(paid)}</p>
      </section>
      {searchParams.paid === '1' && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">Payment received. The receipt appears below once it is issued.</p>}
      {searchParams.paid === 'invalid' && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">We couldn’t confirm that payment. If money left your account, call the accounts office with the reference.</p>}
      {dues && (
        <section className="card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted">Instalments</p>
          <ul className="mt-2 space-y-1">{dues.rows.map((r) => <li key={r.due} className="flex justify-between"><span>{r.label} · {formatDate(r.due, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className={`font-mono ${r.overdue ? 'font-semibold text-red-700 dark:text-red-300' : r.outstanding ? '' : 'text-muted'}`}>{r.outstanding ? formatINR(r.outstanding) : 'paid'}</span></li>)}</ul>
          {next && <div className="mt-3"><PayButton label={`Pay ${formatINR(next.outstanding)} online`} /></div>}
        </section>
      )}
      <ul className="space-y-2">
        {d.payments.length === 0 && <li className="card p-4 text-sm text-muted">No payments recorded yet.</li>}
        {d.payments.map((p) => (
          <li key={p.id} className="card flex items-center justify-between gap-3 p-4 text-sm">
            <span>
              <span className="block font-mono font-semibold text-heading">{formatINR(p.amount)}</span>
              <span className="text-xs text-muted">
                {formatDate(p.paidOn, { day: 'numeric', month: 'short', year: 'numeric' })} · {PAYMENT_MODES.find((m) => m.value === p.mode)?.label ?? p.mode}
              </span>
            </span>
            {p.receiptNo ? (
              <Link href={`/app/receipts/${p.id}`} className="text-right text-xs font-semibold text-maroon underline dark:text-gold">
                Receipt
                <span className="block font-mono font-normal">{p.receiptNo}</span>
              </Link>
            ) : (
              <span className="text-right text-xs text-muted">{p.status === 'pending_approval' ? 'Being confirmed' : 'Receipt pending'}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Pay online (UPI, cards, net banking), at the accounts office, or by bank transfer. Offline payments are confirmed by Accounts; every receipt appears here.
      </p>
    </div>
  );
}
