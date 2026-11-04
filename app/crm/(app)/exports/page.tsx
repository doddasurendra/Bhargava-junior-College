import Link from 'next/link';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { exportsFor } from '@/lib/school/exports';

export const metadata = { title: 'Reports & exports' };

export default async function ExportsPage() {
  const user = await requireStaff();
  const list = exportsFor(user);
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Reports & exports</h1>
        <p className="text-sm text-muted">Excel downloads (CSV, opens directly in Excel). Each export contains only what your role may see; phone numbers stay masked if your role can’t see them.</p>
      </div>
      <Panel title="Excel">
        {list.length === 0 ? <Empty>No exports for your role.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {list.map((e) => (
              <li key={e.kind} className="flex items-center justify-between gap-3 py-2">
                <span>{e.label}</span>
                <a href={`/crm/exports/${e.kind}`} className="btn-outline py-1 text-xs">Download</a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="PDF">
        <ul className="space-y-1 text-sm">
          <li>Report cards: open a student → <strong>Report card</strong> → Print / save as PDF.</li>
          {can(user, 'dashboard.view') && <li><Link href="/crm/reports" className="underline">7 PM daily report</Link> (PDF attached to the email).</li>}
          {can(user, 'fees.export') && <li>Fee receipts print from each payment; the Tally CSV is under <Link href="/crm/accounts" className="underline">Accounts</Link>.</li>}
        </ul>
      </Panel>
    </div>
  );
}
