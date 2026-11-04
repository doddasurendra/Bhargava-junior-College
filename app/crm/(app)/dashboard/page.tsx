import Link from 'next/link';
import { previewReportAction, sendReportNowAction } from '@/app/crm/report-actions';
import { TrendChart } from '@/components/crm/charts';
import { BacklogTiles, FlaggedCard, FunnelCard, LossesCard, OwnersCard, QualityCard, SourcesCard } from '@/components/crm/dashboardSections';
import { DailyParameters, QualityMix, SeatsVsTarget, SourceRoi, VisitAndChat } from '@/components/crm/dashboardExtras';
import { programs } from '@/content/programs';
import { requireStaff } from '@/lib/crm/auth';
import type { MetricsFilter, PeriodKey } from '@/lib/crm/metrics';
import { dashboard } from '@/lib/crm/reports';
import { formatDate, formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Management dashboard' };
export const dynamic = 'force-dynamic';

const KEYS: PeriodKey[] = ['today', 'mtd', 'season'];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff('dashboard.view');
  const key = (KEYS.find((k) => k === one(searchParams.p)) ?? 'today') as PeriodKey;
  const filter: MetricsFilter = { program: one(searchParams.program), source: one(searchParams.source), school: one(searchParams.school)?.slice(0, 120), ownerId: one(searchParams.owner) };
  const { metrics: m, series, periods, season, options } = await dashboard(user, key, filter);
  const filtered = Boolean(filter.program || filter.source || filter.school || filter.ownerId);
  const qs = (p: string) => {
    const s = new URLSearchParams({ p });
    for (const [k, v] of Object.entries({ program: filter.program, source: filter.source, school: filter.school, owner: filter.ownerId })) if (v) s.set(k, v);
    return `/crm/dashboard?${s}`;
  };

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
          <form action={sendReportNowAction}>
            <button className="btn-primary py-1.5">Send 7 PM report now</button>
          </form>
        </div>
      </div>

      {/* One filter row scopes everything below it. */}
      <nav aria-label="Period" className="flex flex-wrap gap-1.5">
        {KEYS.map((k) => (
          <Link key={k} href={qs(k)} className={`chip px-3.5 py-1.5 text-sm ${k === key ? 'chip-active' : ''}`}>
            {periods[k].label}
            <span className="ml-1.5 text-[11px] opacity-70">
              {periods[k].from === periods[k].to ? formatDate(periods[k].from, { day: 'numeric', month: 'short' }) : `${formatDate(periods[k].from, { day: 'numeric', month: 'short' })} – ${formatDate(periods[k].to, { day: 'numeric', month: 'short' })}`}
            </span>
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap items-center gap-2" aria-label="Filter the dashboard">
        <input type="hidden" name="p" value={key} />
        <select name="program" defaultValue={filter.program ?? ''} className="input w-auto py-1.5 text-sm" aria-label="Program">
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>{p.short}</option>
          ))}
        </select>
        <select name="source" defaultValue={filter.source ?? ''} className="input w-auto py-1.5 text-sm" aria-label="Source">
          <option value="">All sources</option>
          {options.sources.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select name="school" defaultValue={filter.school ?? ''} className="input w-auto max-w-[14rem] py-1.5 text-sm" aria-label="School">
          <option value="">All schools</option>
          {options.schools.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="owner" defaultValue={filter.ownerId ?? ''} className="input w-auto py-1.5 text-sm" aria-label="Owner">
          <option value="">All owners</option>
          {options.owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button className="btn-outline py-1.5">Apply</button>
        {filtered && (
          <Link href={`/crm/dashboard?p=${key}`} className="text-sm text-muted underline">Clear filters</Link>
        )}
      </form>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Daily tracking: {periods[key].label.toLowerCase()}{filtered ? ' (filtered)' : ''}</h2>
        <DailyParameters m={m} />
      </section>

      <VisitAndChat m={m} />

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

      <div className="grid gap-5 xl:grid-cols-2">
        <QualityMix m={m} />
        <SeatsVsTarget m={m} />
      </div>

      <SourceRoi m={m} />

      <QualityCard m={m} />

      <p className="text-xs text-muted">
        Definitions are under each figure (§8 of the brief). The backlog and owner tables are live; the period figures follow the filters above.
      </p>
    </div>
  );
}
