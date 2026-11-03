import { programShort, sourceLabel } from './ui';
import type { Metrics } from '@/lib/crm/metrics';
import { formatINR } from '@/lib/fees';

/** §8 — the 10 daily tracking parameters, each with its written definition. */
export function DailyParameters({ m }: { m: Metrics }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {m.daily.map((p, i) => (
        <li key={p.key} className="rounded-2xl border border-line bg-surface p-4" title={p.definition}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="mr-1 font-mono">{i + 1}.</span>
            {p.label}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-heading">{p.money ? formatINR(p.value) : p.value.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">{p.definition}</p>
        </li>
      ))}
    </ol>
  );
}

const QUALITY = [
  { key: 'hot', label: 'Hot', color: 'var(--viz-3)' },
  { key: 'warm', label: 'Warm', color: 'var(--viz-2)' },
  { key: 'cold', label: 'Cold', color: 'var(--viz-1)' },
  { key: 'invalid', label: 'Invalid', color: 'var(--viz-4)' },
  { key: 'unqualified', label: 'Not yet qualified', color: 'var(--line)' },
] as const;

/** Lead quality mix as one segmented bar with a legend and counts (identity never by colour alone). */
export function QualityMix({ m }: { m: Metrics }) {
  const q = m.extras.quality;
  const total = QUALITY.reduce((s, x) => s + q[x.key], 0);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-heading">Lead quality mix</h2>
      <p className="mt-0.5 text-xs text-muted">Leads created in the period, by category.</p>
      {total === 0 ? (
        <p className="mt-4 text-sm text-muted">No new leads in this period.</p>
      ) : (
        <>
          <div className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded" role="img" aria-label={QUALITY.map((x) => `${x.label} ${q[x.key]}`).join(', ')}>
            {QUALITY.filter((x) => q[x.key] > 0).map((x) => (
              <span key={x.key} style={{ width: `${(q[x.key] / total) * 100}%`, background: x.color }} title={`${x.label}: ${q[x.key]}`} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
            {QUALITY.map((x) => (
              <li key={x.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} aria-hidden />
                <span className="text-muted">{x.label}</span>
                <span className="ml-auto font-mono text-ink">
                  {q[x.key]} <span className="text-muted">({Math.round((q[x.key] / total) * 100)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function VisitAndChat({ m }: { m: Metrics }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Visit no-show rate</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-heading">{m.extras.noShowRate === null ? '–' : `${m.extras.noShowRate}%`}</p>
        <p className="text-xs text-muted">{m.extras.noShows} no-shows of the families due in the period</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Chat-agent leads</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-heading">{m.extras.chatLeads}</p>
        <p className="text-xs text-muted">New leads from the website chat and WhatsApp</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Follow-ups pending / overdue</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-heading">
          {m.backlog.open} / <span className={m.backlog.overdue ? 'text-maroon dark:text-gold' : ''}>{m.backlog.overdue}</span>
        </p>
        <p className="text-xs text-muted">Open leads / of which overdue now</p>
      </div>
    </div>
  );
}

export function SourceRoi({ m }: { m: Metrics }) {
  const rows = m.extras.roi;
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-heading">Cost per lead & source ROI</h2>
      <p className="mt-0.5 text-xs text-muted">Ad spend entered under Marketing spend, for the months in this period.</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No leads or spend in this period.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="table-base min-w-[520px] text-[13px]">
            <thead>
              <tr>
                <th>Source</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Cost / lead</th>
                <th className="text-right">Confirmed</th>
                <th className="text-right">Cost / admission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source}>
                  <td className="capitalize">{sourceLabel(r.source)}</td>
                  <td className="text-right font-mono">{r.spend ? formatINR(r.spend) : '–'}</td>
                  <td className="text-right font-mono">{r.leads}</td>
                  <td className="text-right font-mono">{r.costPerLead === null ? '–' : formatINR(r.costPerLead)}</td>
                  <td className="text-right font-mono">{r.confirmed}</td>
                  <td className="text-right font-mono">{r.costPerAdmission === null ? '–' : formatINR(r.costPerAdmission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Seats filled (College IDs issued) vs the CMS target, as labelled meters. */
export function SeatsVsTarget({ m }: { m: Metrics }) {
  const rows = m.extras.seats;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-heading">Seats filled vs target</h2>
      <p className="mt-0.5 text-xs text-muted">College IDs issued against the seat targets in Website content › Admissions season.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.program}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-heading">{programShort(r.program)}</span>
              <span className="font-mono text-ink">
                {r.filled} / {r.target} <span className="text-muted">({r.pct ?? 0}%)</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-bg" role="meter" aria-valuemin={0} aria-valuemax={r.target} aria-valuenow={r.filled} aria-label={`${programShort(r.program)} seats filled`}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct ?? 0)}%`, background: 'var(--viz-1)' }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
