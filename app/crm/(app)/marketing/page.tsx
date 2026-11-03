import { removeSpendAction } from '@/app/crm/report-actions';
import { SpendForm } from '@/components/crm/SpendForm';
import { Empty, Panel, sourceLabel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { IMPORT_SOURCES } from '@/lib/crm/importer';
import { listSpend } from '@/lib/crm/reports';
import { formatINR } from '@/lib/fees';
import { LEAD_SOURCES } from '@/lib/validation';

export const metadata = { title: 'Marketing spend' };

export default async function MarketingPage() {
  const user = await requireStaff('marketing.spend');
  const rows = await listSpend(user);
  const sources = [...new Set([...LEAD_SOURCES, ...IMPORT_SOURCES.map((s) => s.value), 'google_ads', 'meta_ads', 'newspaper', 'hoardings', 'school_visits'])];
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Marketing spend</h1>
        <p className="text-sm text-muted">Spend per lead source and month. The dashboard turns it into cost per lead and cost per admission (§8).</p>
      </div>
      <Panel title="Add spend">
        <SpendForm sources={sources.map((s) => ({ value: s, label: sourceLabel(s) }))} />
      </Panel>
      <Panel title="Recorded">
        {rows.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <table className="table-base text-sm">
            <thead>
              <tr>
                <th>Month</th>
                <th>Source</th>
                <th className="text-right">Amount</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono">{r.data.month}</td>
                  <td className="capitalize">{sourceLabel(r.data.source)}</td>
                  <td className="text-right font-mono">{formatINR(r.data.amount)}</td>
                  <td className="text-muted">{r.data.note ?? ''}</td>
                  <td>
                    <form action={removeSpendAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs text-maroon underline dark:text-gold">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
