import Link from 'next/link';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDate, todayIST } from '@/lib/dates';
import { summary } from '@/lib/school/summary';

export const metadata = { title: 'Summary' };
export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const user = await requireStaff();
  const { sections, events } = await summary(user);
  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Summary</h1>
        <p className="text-sm text-muted">Today across the college · {formatDate(todayIST(), { weekday: 'long', day: 'numeric', month: 'long' })}. Each card opens the detailed page.</p>
      </div>
      {sections.length === 0 && <Panel title="Summary"><Empty>Nothing to summarise for your role.</Empty></Panel>}
      {sections.map((s) => (
        <Panel key={s.area} title={s.area}>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {s.tiles.map((t) => (
              <li key={t.label}>
                <Link href={s.href} className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-gold">
                  <p className="text-xs uppercase tracking-wider text-muted">{t.label}</p>
                  <p className={`mt-1 font-mono text-2xl ${t.tone === 'warn' ? 'text-maroon dark:text-red-300' : t.tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : 'text-heading'}`}>{t.value}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel title="Coming up">
        {events.length === 0 ? <Empty>No events scheduled.</Empty> : (
          <ul className="space-y-1 text-sm">{events.map((e) => <li key={e.id} className="flex justify-between gap-2"><span>{e.title} <span className="text-xs uppercase text-muted">{e.kind}</span></span><span className="text-muted">{formatDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span></li>)}</ul>
        )}
        <Link href="/crm/events" className="mt-2 inline-block text-xs underline">Events calendar</Link>
      </Panel>
    </div>
  );
}
