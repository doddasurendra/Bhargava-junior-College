import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { eventsForPortal } from '@/lib/school/backoffice';

export const metadata = { title: 'Events' };
export const dynamic = 'force-dynamic';

const day = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

export default async function AppEventsPage() {
  const { p } = await requireEnrolled();
  const list = await eventsForPortal(p.kind === 'parent' ? 'parents' : 'students');
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Events calendar</h1>
      {list.length === 0 ? <p className="card p-4 text-sm text-muted">Nothing scheduled.</p> : list.map((e) => (
        <article key={e.id} className="card p-4 text-sm">
          <p className="font-semibold text-heading">{e.title} <span className="ml-1 text-[11px] uppercase text-muted">{e.kind}</span></p>
          <p className="text-[11px] text-muted">{day(e.date)}{e.endDate && e.endDate !== e.date ? ` – ${day(e.endDate)}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
          {e.note && <p className="mt-2 whitespace-pre-line">{e.note}</p>}
        </article>
      ))}
    </div>
  );
}
