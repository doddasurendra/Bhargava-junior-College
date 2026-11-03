import Link from 'next/link';
import type { Metrics } from '@/lib/crm/metrics';
import { sourceLabel } from './ui';
import { BarList, MixBars, TableView } from './charts';

const pctText = (n: number | null) => (n === null ? '—' : `${n}%`);
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const source = (s: string) => sentence(sourceLabel(s));

function Card({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-heading">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({ label, value, tone = 'default', hint, href }: { label: string; value: number | string; tone?: 'default' | 'alert' | 'warn' | 'good'; hint?: string; href?: string }) {
  const color = { default: 'text-heading', alert: 'text-red-700 dark:text-red-300', warn: 'text-maroon dark:text-gold', good: 'text-emerald-700 dark:text-emerald-300' }[tone];
  const icon = tone === 'alert' ? '▲ ' : tone === 'good' ? '✓ ' : '';
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${color}`}>
        {tone !== 'default' && <span className="mr-0.5 align-middle text-sm">{icon}</span>}
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-line bg-surface p-4 transition hover:border-gold" title={hint}>
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-4" title={hint}>
      {body}
    </div>
  );
}

/** Live backlog: point-in-time, the same in every period. */
export function BacklogTiles({ m, links = true }: { m: Metrics; links?: boolean }) {
  const b = m.backlog;
  const l = (href: string) => (links ? href : undefined);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      <Tile label="Open leads" value={b.open} hint="Not lost, invalid or admitted" href={l('/crm/leads')} />
      <Tile label="Overdue" value={b.overdue} tone={b.overdue ? 'warn' : 'good'} hint="Follow-up time has passed" href={l('/crm/leads?queue=overdue')} />
      <Tile label="Overdue 48h+" value={b.escalated48} tone={b.escalated48 ? 'alert' : 'good'} hint="Flagged to management (§7.3)" href={l('/crm/leads?queue=escalated')} />
      <Tile label="Visits w/o outcome" value={b.visitsNeedingOutcome} tone={b.visitsNeedingOutcome ? 'alert' : 'good'} hint={`${b.visitsEscalated} escalated (24h+)`} href={l('/crm/visits')} />
      <Tile label="Unassigned" value={b.unassigned} tone={b.unassigned ? 'warn' : 'good'} hint="No owner yet" href={l('/crm/leads?queue=unassigned')} />
      <Tile label="Unqualified" value={b.unqualified} hint="Not yet categorised" href={l('/crm/leads?category=none')} />
      <Tile label="Pending decisions" value={b.pendingDecisions} hint="Visited, family still deciding" href={l('/crm/leads?status=decision_pending')} />
      <Tile label="In verification" value={b.inVerification} hint="Confirmed, before College ID" href={l('/crm/verification')} />
    </div>
  );
}

export function FunnelCard({ m }: { m: Metrics }) {
  const rows = m.funnel.map((f, i) => {
    const prev = i > 0 ? m.funnel[i - 1].value : null;
    return { label: f.label, value: f.value, hint: f.definition, note: prev ? `${Math.round((f.value / prev) * 100)}%` : null };
  });
  return (
    <Card title={`Admission funnel · ${m.period.label}`} sub="Activity in the period. The % is against the stage above; stages are counted independently, so a lead can appear in one stage without the earlier ones in this period.">
      <BarList rows={rows} />
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Calls · connected</dt>
          <dd className="font-semibold text-heading">
            {m.calls.total} · {pctText(m.calls.connectRate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Visit no-shows</dt>
          <dd className="font-semibold text-heading">{m.noShows}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Visit → confirmed</dt>
          <dd className="font-semibold text-heading">{pctText(m.conversion.visitToConfirmed)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function LossesCard({ m }: { m: Metrics }) {
  return (
    <Card title={`Where admissions are lost · ${m.period.label}`} sub={`${m.losses.total} lost in the period, ${m.losses.afterVisit} of them after a campus visit.`}>
      {m.losses.total === 0 ? (
        <p className="text-sm text-muted">No losses recorded in this period.</p>
      ) : (
        <>
          <BarList rows={m.losses.byReason.map((r) => ({ label: r.label, value: r.n }))} color="var(--viz-1)" />
          {m.losses.competitors.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Competitors chosen: {m.losses.competitors.map((c) => `${c.name} (${c.n})`).join(', ')}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export function FlaggedCard({ m, links = true }: { m: Metrics; links?: boolean }) {
  return (
    <Card title={`Overdue 48 hours or more (${m.flagged.length})`} sub="Brief §7.3: these are flagged to management in the 7 PM report.">
      {m.flagged.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">✓ Nothing overdue by 48 hours.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="table-base text-[13px]">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Owner</th>
              <th className="text-right">Late</th>
            </tr>
          </thead>
          <tbody>
            {m.flagged.slice(0, 25).map((f) => (
              <tr key={f.leadId}>
                <td>{links ? <Link href={`/crm/leads/${f.leadId}`} className="font-medium text-heading hover:underline">{f.name}</Link> : f.name}</td>
                <td>{f.owner}</td>
                <td className="text-right tabular-nums">{Math.floor(f.overdueHours / 24)}d {f.overdueHours % 24}h</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}

export function OwnersCard({ m }: { m: Metrics }) {
  return (
    <Card title={`Accountability by owner · ${m.period.label}`} sub="Open leads and overdue counts are live; calls, visits and confirmations are for the period. Sorted by 48h escalations.">
      {m.owners.length === 0 ? (
        <p className="text-sm text-muted">No telecallers or counsellors yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base min-w-[640px] text-[13px]">
            <thead>
              <tr>
                <th>Owner</th>
                <th className="text-right">Open leads</th>
                <th className="text-right">Calls</th>
                <th className="text-right">Connected</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">48h+</th>
                <th className="text-right">Visits booked</th>
                <th className="text-right">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {m.owners.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="font-medium text-heading">{o.name}</span> <span className="text-xs text-muted">{o.role}</span>
                  </td>
                  <td className="text-right tabular-nums">{o.openLeads}</td>
                  <td className="text-right tabular-nums">{o.calls}</td>
                  <td className="text-right tabular-nums">{pctText(o.connectRate)}</td>
                  <td className="text-right tabular-nums">{o.overdue}</td>
                  <td className={`text-right tabular-nums ${o.escalated48 ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{o.escalated48 ? `▲ ${o.escalated48}` : 0}</td>
                  <td className="text-right tabular-nums">{o.visitsBooked}</td>
                  <td className="text-right tabular-nums">{o.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function SourcesCard({ m }: { m: Metrics }) {
  return (
    <Card title={`Lead sources · ${m.period.label}`} sub="Leads created in the period, and how many of those have since visited or been confirmed.">
      {m.sources.length === 0 ? (
        <p className="text-sm text-muted">No new leads in this period.</p>
      ) : (
        <>
          <BarList rows={m.sources.map((s) => ({ label: source(s.source), value: s.leads, note: s.leads ? `${Math.round((s.visited / s.leads) * 100)}% visited` : null, hint: `${s.visited} visited, ${s.confirmed} confirmed` }))} />
          <TableView>
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="text-right">Leads</th>
                  <th className="text-right">Visited</th>
                  <th className="text-right">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {m.sources.map((s) => (
                  <tr key={s.source}>
                    <td>{source(s.source)}</td>
                    <td className="text-right tabular-nums">{s.leads}</td>
                    <td className="text-right tabular-nums">{s.visited}</td>
                    <td className="text-right tabular-nums">{s.confirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableView>
        </>
      )}
    </Card>
  );
}

const MIX = [
  { key: 'hot', label: 'Hot', color: 'var(--viz-3)' },
  { key: 'warm', label: 'Warm', color: 'var(--viz-2)' },
  { key: 'cold', label: 'Cold', color: 'var(--viz-1)' },
  { key: 'invalid', label: 'Invalid', color: 'var(--viz-4)' },
  { key: 'unqualified', label: 'Unqualified', color: 'var(--viz-neutral)' },
];

export function QualityCard({ m }: { m: Metrics }) {
  return (
    <Card title={`Data quality · ${m.period.label}`} sub="Brief §7.1: category mix of leads created in the period, by source and by school. A high Invalid share means a poor list.">
      {m.quality.bySource.length === 0 ? (
        <p className="text-sm text-muted">No new leads in this period.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">By source</p>
            <MixBars rows={m.quality.bySource.map((r) => ({ ...r, key: source(r.key) }))} segments={MIX} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">By school</p>
            <MixBars rows={m.quality.bySchool} segments={MIX} />
          </div>
        </div>
      )}
    </Card>
  );
}
