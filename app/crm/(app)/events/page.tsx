import { addEventAction, removeEventAction } from '@/app/crm/backoffice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { listEvents } from '@/lib/school/backoffice';

export const metadata = { title: 'Events calendar' };
export const dynamic = 'force-dynamic';

const KINDS = [{ value: 'event', label: 'Event' }, { value: 'exam', label: 'Exam' }, { value: 'ptm', label: 'PTM' }, { value: 'holiday', label: 'Holiday' }, { value: 'deadline', label: 'Deadline' }];
const AUDIENCE = [{ value: 'all', label: 'Everyone' }, { value: 'students', label: 'Students' }, { value: 'parents', label: 'Parents' }, { value: 'staff', label: 'Staff' }];
const dayLabel = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

export default async function EventsPage() {
  const user = await requireStaff();
  const { upcoming, past } = await listEvents();
  const manage = can(user, 'events.manage');
  const months = new Map<string, typeof upcoming>();
  for (const e of upcoming) {
    const m = e.date.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), e]);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Events calendar</h1>
      {manage && (
        <Panel title="Add to the calendar">
          <QuickForm action={addEventAction} submit="Add" fields={[
            { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'endDate', label: 'Ends (optional)', type: 'date' },
            { name: 'kind', label: 'Type', type: 'select', options: KINDS },
            { name: 'audience', label: 'For', type: 'select', options: AUDIENCE },
            { name: 'location', label: 'Where', type: 'text', wide: true },
            { name: 'note', label: 'Note', type: 'textarea', rows: 2, wide: true },
          ]} />
        </Panel>
      )}
      {upcoming.length === 0 ? <Panel title="Upcoming"><Empty>Nothing scheduled.</Empty></Panel> : [...months.entries()].map(([m, list]) => (
        <Panel key={m} title={formatDate(`${m}-01`, { month: 'long', year: 'numeric' })}>
          <ul className="divide-y divide-line text-sm">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-medium text-heading">{e.title} <span className="chip ml-1 px-2 py-0.5 text-[11px] uppercase">{e.kind}</span></p>
                  <p className="text-xs text-muted">{dayLabel(e.date)}{e.endDate && e.endDate !== e.date ? ` – ${dayLabel(e.endDate)}` : ''} · for {e.audience}{e.location ? ` · ${e.location}` : ''}</p>
                  {e.note && <p className="mt-1 whitespace-pre-line">{e.note}</p>}
                </div>
                {manage && <QuickForm action={removeEventAction} submit="Remove" cols={1} fields={[{ name: 'id', type: 'hidden', value: e.id }]} />}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      {past.length > 0 && (
        <Panel title="Recent past">
          <ul className="space-y-1 text-sm text-muted">{past.map((e) => <li key={e.id}>{dayLabel(e.date)} · {e.title}</li>)}</ul>
        </Panel>
      )}
    </div>
  );
}
