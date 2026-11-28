import Link from 'next/link';
import { removeSpendAction } from '@/app/crm/report-actions';
import { removeCampaignAction, saveCampaignAction } from '@/app/crm/campaign-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { listCampaigns } from '@/lib/crm/marketingAnalytics';
import { CAMPAIGN_CHANNELS } from '@/lib/records/collections';
import { formatDate } from '@/lib/dates';
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
  const [rows, campaigns] = await Promise.all([listSpend(user), listCampaigns(user)]);
  const sources = [...new Set([...LEAD_SOURCES, ...IMPORT_SOURCES.map((s) => s.value), 'google_ads', 'meta_ads', 'newspaper', 'hoardings', 'school_visits'])];
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Marketing spend & campaigns</h1>
        <p className="text-sm text-muted">Spend per lead source and month. The dashboard turns it into cost per lead and cost per admission (§8).</p>
      </div>
      <p className="text-sm"><Link href="/crm/analytics?tab=marketing" className="underline">Open marketing & admissions analytics →</Link></p>
      <Panel title={`Campaigns (${campaigns.length})`}>
        <QuickForm action={saveCampaignAction} submit="Save campaign" cols={2} fields={[
          { name: 'name', label: 'Campaign name', type: 'text', required: true, placeholder: 'Instagram reels · JEE 2027' },
          { name: 'code', label: 'Code (utm_campaign in ad links)', type: 'text', required: true, placeholder: 'insta-jee-2027' },
          { name: 'channel', label: 'Channel', type: 'select', options: CAMPAIGN_CHANNELS.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })) },
          { name: 'source', label: 'Offline campaign: lead source to count (optional)', type: 'select', options: [{ value: '', label: '— only utm-tagged leads —' }, ...sources.map((x) => ({ value: x, label: sourceLabel(x) }))] },
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends (optional)', type: 'date' },
          { name: 'budget', label: 'Budget (₹)', type: 'number' },
          { name: 'targetLeads', label: 'Target enquiries', type: 'number' },
          { name: 'targetAdmissions', label: 'Target admissions', type: 'number' },
        ]} />
        {campaigns.length > 0 && (
          <table className="table-base mt-3 text-sm"><thead><tr><th>Campaign</th><th>Code</th><th>Channel</th><th>Dates</th><th className="text-right">Budget</th><th /></tr></thead>
            <tbody>{campaigns.map((c) => <tr key={c.id}><td>{c.name}</td><td className="font-mono text-xs">{c.code}</td><td className="capitalize">{c.channel.replace(/_/g, ' ')}{c.source ? ` · ${sourceLabel(c.source)}` : ''}</td><td className="text-xs">{formatDate(c.startDate, { day: 'numeric', month: 'short' })}{c.endDate ? ` – ${formatDate(c.endDate, { day: 'numeric', month: 'short' })}` : ' onwards'}</td><td className="text-right font-mono">{formatINR(c.budget)}</td><td><ActionButton action={removeCampaignAction} label="Remove" hidden={{ id: c.id }} /></td></tr>)}</tbody></table>
        )}
        <p className="mt-2 text-xs text-muted">Website and ad links count a lead for a campaign when they carry <span className="font-mono">?utm_campaign=CODE</span>. Offline campaigns (school outreach, newspaper) count leads of the chosen source created between the dates.</p>
      </Panel>
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
