import Link from 'next/link';
import { Empty, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { verificationQueue } from '@/lib/crm/verifyService';

export const metadata = { title: 'Admission verification' };

export default async function VerificationQueuePage() {
  const user = await requireStaff('verify.view');
  const rows = await verificationQueue(user);
  const open = rows.filter((r) => !r.collegeId);
  const admitted = rows.filter((r) => r.collegeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-heading">Admission verification</h1>
        <p className="mt-1 text-sm text-muted">Confirmed admissions moving through documents, fee, receipt and student record to the College ID. Rows waiting on you are first.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-heading">In progress ({open.length})</h2>
        {open.length === 0 ? (
          <Empty>No confirmed admissions waiting for verification.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="table-base min-w-[720px] text-[13px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Progress</th>
                  <th>Next step</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {open.map((r) => (
                  <tr key={r.lead.id} className={r.mine ? 'bg-gold-100/40 dark:bg-gold/5' : ''}>
                    <td>
                      <Link href={`/crm/leads/${r.lead.id}`} className="font-semibold text-heading hover:underline">
                        {r.lead.studentName ?? r.lead.contactName ?? r.lead.phone}
                      </Link>
                      <span className="block font-mono text-xs text-muted">{r.lead.phone}</span>
                    </td>
                    <td>{programShort(r.lead.program)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
                          <div className="h-full bg-gold" style={{ width: `${(r.done / 6) * 100}%` }} />
                        </div>
                        <span className="font-mono text-xs">{r.done}/6</span>
                      </div>
                    </td>
                    <td>
                      {r.next ? (
                        <>
                          {r.next.label}
                          <span className="block text-xs text-muted">{r.next.owner}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="space-x-1">
                      {r.mine && <span className="rounded-full bg-maroon px-2 py-0.5 text-[11px] font-semibold text-white">Waiting on you</span>}
                      {r.pendingReversals > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Reversal requested</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-heading">Admitted ({admitted.length})</h2>
        {admitted.length === 0 ? (
          <Empty>No College IDs issued yet.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {admitted.map((r) => (
              <li key={r.lead.id}>
                <Link href={`/crm/leads/${r.lead.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 hover:border-gold">
                  <span className="font-medium text-heading">{r.lead.studentName ?? r.lead.contactName}</span>
                  <span className="font-mono text-sm text-maroon dark:text-gold">{r.collegeId}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
