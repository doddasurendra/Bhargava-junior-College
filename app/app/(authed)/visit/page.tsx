import { rescheduleAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { applicantVisit, requireApplicant } from '@/lib/app/portal';
import { getContent } from '@/lib/cms';
import { formatDate } from '@/lib/dates';
import { bookableDates, slotLabel } from '@/lib/visits';

export const metadata = { title: 'Campus visit' };

export default async function AppVisitPage() {
  const { p } = await requireApplicant();
  const [{ visitSlots }, v] = await Promise.all([getContent(), applicantVisit(p.leadId)]);
  const dates = bookableDates(visitSlots);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Campus visit</h1>
      {v && <section className="card p-4 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Booked</p><p className="font-medium text-heading">{formatDate(v.date)}, {slotLabel(v.slot, visitSlots)}</p></section>}
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-heading">{v ? 'Change the time' : 'Book a visit'}</p>
        <QuickForm action={rescheduleAction} submit={v ? 'Reschedule' : 'Book'} cols={1} fields={[
          { name: 'date', label: 'Date (Mon–Sat)', type: 'select', options: dates.map((d) => ({ value: d, label: formatDate(d) })) },
          { name: 'slot', label: 'Time', type: 'select', options: visitSlots.slots.map((s) => ({ value: s.slot, label: `${s.label}${s.saturday ? '' : ' (not Saturdays)'}` })) },
        ]} />
      </section>
    </div>
  );
}
