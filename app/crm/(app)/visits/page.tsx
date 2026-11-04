import Link from 'next/link';
import { CheckInButtons, VisitOutcomeForm } from '@/components/crm/forms';
import { CategoryBadge, Empty, programShort } from '@/components/crm/ui';
import { getContent } from '@/lib/cms';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { phoneFor, seesPhones } from '@/lib/crm/mask';
import { visitBoard, type VisitBoardRow } from '@/lib/crm/service';
import { addDays, formatDate, todayIST } from '@/lib/dates';

export const metadata = { title: 'Campus visits' };

export default async function VisitsPage() {
  const { visitSlots } = await getContent();
  const user = await requireStaff('visit.view');
  const today = todayIST();
  const rows = await visitBoard(user, today, addDays(today, 7));
  const pending = rows.filter((r) => r.flag !== 'ok');
  const byDate = new Map<string, VisitBoardRow[]>();
  for (const r of rows.filter((r) => r.flag === 'ok')) byDate.set(r.visit.date, [...(byDate.get(r.visit.date) ?? []), r]);
  const slotLabel = (s: string) => visitSlots.slots.find((x) => x.slot === s)?.label ?? s;

  const Row = ({ r }: { r: VisitBoardRow }) => (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-start">
      <div className="w-28 shrink-0">
        <p className="font-mono font-semibold">{slotLabel(r.visit.slot)}</p>
        <p className="text-xs text-muted">{formatDate(r.visit.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/crm/leads/${r.visit.leadId}`} className="font-semibold text-heading hover:underline">{r.lead?.contactName ?? phoneFor(user, r.lead?.phone)}</Link>
        <p className="text-xs text-muted">
          {seesPhones(user) ? <a href={`tel:${r.lead?.phone}`} className="font-mono">{r.lead?.phone}</a> : <span className="font-mono">{phoneFor(user, r.lead?.phone)}</span>} · {programShort(r.visit.program ?? r.lead?.program ?? null)} · {r.visit.familySize} people · owner {r.owner?.fullName ?? 'unassigned'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <CategoryBadge category={r.lead?.category ?? null} />
          <span className="rounded-full bg-bg px-2 py-0.5 text-xs capitalize">{r.visit.status.replace('_', ' ')}</span>
          {r.flag === 'needs_outcome' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Outcome needed</span>}
          {r.flag === 'escalated' && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Outcome overdue · escalated</span>}
        </div>
      </div>
      <div className="md:w-80">
        {r.visit.status === 'scheduled' && r.visit.date <= today && can(user, 'visit.checkin') && <CheckInButtons visitId={r.visit.id} />}
        {r.visit.status === 'arrived' && can(user, 'visit.outcome') && <VisitOutcomeForm visitId={r.visit.id} />}
        {r.visit.outcome && <p className="text-sm text-muted">{r.visit.outcome}</p>}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-heading">Campus visits</h1>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-heading">Past visits without an outcome ({pending.length})</h2>
        {pending.length === 0 ? <Empty>Every past visit has a recorded outcome.</Empty> : <ul className="space-y-2">{pending.map((r) => <Row key={r.visit.id} r={r} />)}</ul>}
      </section>
      {Array.from({ length: 8 }, (_, i) => addDays(today, i)).map((date) => {
        const list = byDate.get(date) ?? [];
        if (list.length === 0 && date !== today) return null;
        return (
          <section key={date}>
            <h2 className="mb-2 text-sm font-semibold text-heading">
              {date === today ? 'Today · ' : ''}
              {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} ({list.length})
            </h2>
            {list.length === 0 ? <Empty>No visits today.</Empty> : <ul className="space-y-2">{list.map((r) => <Row key={r.visit.id} r={r} />)}</ul>}
          </section>
        );
      })}
    </div>
  );
}
