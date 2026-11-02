import Link from 'next/link';
import { SeedDemoButton } from '@/components/crm/forms';
import { CategoryBadge, Empty, FollowUpBadge, Panel, programShort, Stat } from '@/components/crm/ui';
import { visitSlots } from '@/content/sample';
import { devLoginEnabled, requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { dashboard, type LeadRow } from '@/lib/crm/service';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'My tasks' };

function LeadList({ rows, showOwner }: { rows: LeadRow[]; showOwner: boolean }) {
  if (rows.length === 0) return <Empty>Nothing here. Well done.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {rows.slice(0, 12).map((r) => (
        <li key={r.lead.id}>
          <Link href={`/crm/leads/${r.lead.id}`} className="flex items-center gap-3 py-2.5 hover:bg-bg">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-heading">{r.lead.contactName ?? r.lead.studentName ?? r.lead.phone}</p>
              <p className="text-xs text-muted">
                {programShort(r.lead.program)}
                {showOwner && ` · ${r.owner?.fullName ?? 'Unassigned'}`}
              </p>
            </div>
            <CategoryBadge category={r.lead.category} />
            <FollowUpBadge f={r.follow} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CrmHome() {
  const user = await requireStaff();
  const d = await dashboard(user);
  const all = can(user, 'lead.viewAll');
  const slotLabel = (s: string) => visitSlots.slots.find((x) => x.slot === s)?.label ?? s;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Good to see you</p>
          <h1 className="font-display text-3xl text-heading">{user.fullName}’s tasks</h1>
        </div>
        {devLoginEnabled() && d.total === 0 && <SeedDemoButton />}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Overdue" value={d.overdue.length} tone={d.overdue.length ? 'alert' : 'good'} href="/crm/leads?queue=overdue" />
        <Stat label="Escalated 24h+" value={d.escalated} tone={d.escalated ? 'alert' : 'good'} href="/crm/leads?queue=escalated" />
        <Stat label="Due today" value={d.today.length} tone="warn" href="/crm/leads?queue=today" />
        <Stat label="Upcoming" value={d.upcoming} href="/crm/leads?queue=upcoming" />
        {can(user, 'lead.assign') && <Stat label="Unassigned" value={d.unassigned} tone={d.unassigned ? 'warn' : 'good'} href="/crm/leads?queue=unassigned" />}
        {can(user, 'visit.view') && <Stat label="Visits needing outcome" value={d.visitsNeedingOutcome.length} tone={d.visitsNeedingOutcome.length ? 'alert' : 'good'} href="/crm/visits" />}
      </div>

      {d.management > 0 && all && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-100">
          <strong>{d.management}</strong> lead{d.management === 1 ? ' is' : 's are'} overdue by more than 48 hours and will be flagged in the 7 PM management report.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Overdue follow-ups (${d.overdue.length})`} actions={<Link href="/crm/leads?queue=overdue" className="text-xs font-semibold text-maroon underline dark:text-gold">See all</Link>}>
          <LeadList rows={d.overdue} showOwner={all} />
        </Panel>
        <Panel title={`Due today (${d.today.length})`} actions={<Link href="/crm/leads?queue=today" className="text-xs font-semibold text-maroon underline dark:text-gold">See all</Link>}>
          <LeadList rows={d.today} showOwner={all} />
        </Panel>
      </div>

      {can(user, 'visit.view') && (
        <Panel title={`Campus visits today (${d.visitsToday.length})`} actions={<Link href="/crm/visits" className="text-xs font-semibold text-maroon underline dark:text-gold">Visit board</Link>}>
          {d.visitsToday.length === 0 ? (
            <Empty>No visits booked for today.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {d.visitsToday.map((v) => (
                <li key={v.visit.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-20 font-mono font-semibold">{slotLabel(v.visit.slot)}</span>
                  <Link href={`/crm/leads/${v.visit.leadId}`} className="flex-1 font-medium text-heading hover:underline">
                    {v.lead?.contactName ?? v.lead?.phone}
                  </Link>
                  <span className="text-muted">
                    {v.visit.familySize} people · {formatDate(v.visit.date, { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-xs capitalize">{v.visit.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
