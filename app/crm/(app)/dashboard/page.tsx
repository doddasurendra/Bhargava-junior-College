import Link from 'next/link';
import { previewReportAction } from '@/app/crm/report-actions';
import { TrendChart } from '@/components/crm/charts';
import { BacklogTiles, FlaggedCard, FunnelCard, LossesCard, OwnersCard, QualityCard, SourcesCard } from '@/components/crm/dashboardSections';
import { requireStaff } from '@/lib/crm/auth';
import type { PeriodKey } from '@/lib/crm/metrics';
import { dashboard } from '@/lib/crm/reports';
import { formatDate, formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Management dashboard' };
export const dynamic = 'force-dynamic';

const KEYS: PeriodKey[] = ['today', 'mtd', 'season'];

export default async function DashboardPage({ searchParams }: { searchParams: { p?: string } }) {
  const user = await requireStaff('dashboard.view');
  const key = (KEYS.find((k) => k === searchParams.p) ?? 'today') as PeriodKey;
  const { metrics: m, series, periods, season } = await dashboard(user, key);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Management dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {season.label} · season from {formatDate(season.start, { day: 'numeric', month: 'short', year: 'numeric' })}
            {season.sample && ' (sample setting)'} · as of {formatDateTime(new Date().toISOString())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/crm/reports" className="btn-outline py-1.5">7 PM reports</Link>
          <form action={previewReportAction}>
            <button className="btn-outline py-1.5">Preview today’s report</button>
          </form>
        </div>
      </div>

      {/* One filter row scopes everything below it. */}
      <nav aria-label="Period" className="flex flex-wrap gap-1.5">
        {KEYS.map((k) => (
          <Link key={k} href={`/crm/dashboard?p=${k}`} className={`chip px-3.5 py-1.5 text-sm ${k === key ? 'chip-active' : ''}`}>
            {periods[k].label}
            <span className="ml-1.5 text-[11px] opacity-70">
              {periods[k].from === periods[k].to ? formatDate(periods[k].from, { day: 'numeric', month: 'short' }) : `${formatDate(periods[k].from, { day: 'numeric', month: 'short' })} – ${formatDate(periods[k].to, { day: 'numeric', month: 'short' })}`}
            </span>
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Right now</h2>
        <BacklogTiles m={m} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <FunnelCard m={m} />
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-heading">Last 30 days</h2>
          <p className="mt-0.5 text-xs text-muted">New leads, visits held and admissions confirmed per day (India time). Hover a day for its numbers.</p>
          <div className="mt-3">
            <TrendChart
              rows={series}
              series={[
                { key: 'leads', label: 'New leads', color: 'var(--viz-1)' },
                { key: 'visits', label: 'Visits held', color: 'var(--viz-2)' },
                { key: 'confirmed', label: 'Confirmed', color: 'var(--viz-3)' },
              ]}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <OwnersCard m={m} />
        <FlaggedCard m={m} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <LossesCard m={m} />
        <SourcesCard m={m} />
      </div>

      <QualityCard m={m} />

      <p className="text-xs text-muted">
        Definitions: hover any funnel row. Section 8 of the brief (dashboard metrics) was not available when this was built; metrics follow §6.8, §7.1–7.5 and can be adjusted in <span className="font-mono">lib/crm/metrics.ts</span>.
      </p>
    </div>
  );
}
