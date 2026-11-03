import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PAYMENT_MODES } from '@/content/sample';
import { profileData, requireAppUser } from '@/lib/app/service';
import { formatDate } from '@/lib/dates';
import { formatINR } from '@/lib/fees';

export const metadata = { title: 'Fees' };

export default async function AppFees() {
  const u = await requireAppUser();
  if (!u.active || u.active.kind === 'applicant') redirect('/app');
  const d = await profileData(u.active);
  const paid = d.payments.filter((p) => p.status === 'approved').reduce((n, p) => n + p.amount, 0);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Fees & receipts</h1>
      <section className="card p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted">Total paid</p>
        <p className="font-mono text-3xl font-semibold text-heading">{formatINR(paid)}</p>
      </section>
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
        Online fee payment (UPI, cards, AutoPay) comes with the payment gateway. For now, pay at the accounts office or by bank transfer and the receipt will appear here.
      </p>
    </div>
  );
}
