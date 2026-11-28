import Link from 'next/link';
import { BarList, Donut, TableView, TrendChart } from '@/components/crm/charts';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { can } from '@/lib/crm/permissions';
import type { Staff } from '@/lib/crm/types';
import { examsOverview } from '@/lib/openbook/closedExam';
import { canSeeMarketing, marketingAnalytics } from '@/lib/crm/marketingAnalytics';
import { sourceLabel } from '@/components/crm/ui';
import { formatINR } from '@/lib/fees';

type P = { tab: string; user: Staff; from: string; to: string; q: Record<string, string | undefined> };

/** Analytics tabs from later modules. Every tab re-checks the permission on the server. */
export async function ExtraTab(p: P) {
  if (p.tab === 'mocks' && can(p.user, 'ob.teach')) return <MocksTab {...p} />;
  if (p.tab === 'marketing' && canSeeMarketing(p.user)) return <MarketingTab {...p} />;
  return <Empty>Not available for your role.</Empty>;
}

async function MocksTab({ user }: P) {
  const list = await examsOverview(user);
  const taken = list.reduce((s, e) => s + e.taken, 0);
  const withAvg = list.filter((e) => e.average !== null);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Closed-book exams" value={list.length} />
        <Stat label="Attempts submitted" value={taken} />
        <Stat label="Average across exams" value={withAvg.length ? `${Math.round((withAvg.reduce((s, e) => s + e.average!, 0) / withAvg.length) * 10) / 10}%` : '–'} />
        <Stat label="Flagged attempts" value={list.reduce((s, e) => s + e.flagged, 0)} tone={list.some((e) => e.flagged) ? 'warn' : 'good'} />
      </div>
      <Panel title="Average score by exam">{withAvg.length ? <BarList rows={withAvg.map((e) => ({ label: e.title, value: e.average!, note: `${e.taken}/${e.of}` }))} unit="%" /> : <Empty>No submitted exams yet.</Empty>}</Panel>
      <p className="text-sm"><Link href="/crm/exams" className="underline">Open closed-book exams →</Link></p>
    </>
  );
}

async function MarketingTab({ user, from, to, q }: P) {
  const m = await marketingAnalytics(user, { from, to, program: q.program || undefined, source: q.source || undefined, campaign: q.campaign || undefined, ownerId: q.owner || undefined });
  const qs = new URLSearchParams(Object.entries({ from, to, program: q.program, source: q.source, campaign: q.campaign, owner: q.owner }).filter(([, v]) => v) as [string, string][]);
  const fc = m.forecast;
  return (
    <>
      <form method="get" action="/crm/analytics" className="card flex flex-wrap items-end gap-2 p-3 text-sm">
        <input type="hidden" name="tab" value="marketing" />
        <label className="text-xs">From<input type="date" name="from" defaultValue={from} className="input mt-1 py-1" /></label>
        <label className="text-xs">To<input type="date" name="to" defaultValue={to} className="input mt-1 py-1" /></label>
        <label className="text-xs">Program<select name="program" defaultValue={q.program ?? ''} className="input mt-1 w-auto py-1"><option value="">All</option><option value="iit-jee">IIT-JEE</option><option value="neet">NEET</option><option value="long-term-jee">Long Term JEE</option><option value="long-term-neet">Long Term NEET</option></select></label>
        <label className="text-xs">Source<select name="source" defaultValue={q.source ?? ''} className="input mt-1 w-auto py-1"><option value="">All</option>{m.options.sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select></label>
        <label className="text-xs">Campaign<select name="campaign" defaultValue={q.campaign ?? ''} className="input mt-1 w-auto py-1"><option value="">All</option>{m.options.campaigns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-xs">Counsellor<select name="owner" defaultValue={q.owner ?? ''} className="input mt-1 w-auto py-1"><option value="">All</option>{m.options.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <button className="btn-primary px-4 py-1.5">Apply</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total enquiries" value={m.totals.enquiries} />
        <Stat label="Visited campus" value={m.totals.visited} />
        <Stat label="Admissions confirmed" value={m.totals.confirmed} tone="good" />
        <Stat label="Lead conversion" value={m.totals.conversion === null ? '–' : `${m.totals.conversion}%`} />
        <Stat label="Follow-ups done on time" value={m.totals.followUpRate === null ? '–' : `${m.totals.followUpRate}%`} tone={m.totals.followUpRate !== null && m.totals.followUpRate < 70 ? 'warn' : 'default'} />
      </div>
      <p className="flex flex-wrap gap-3 text-sm"><a className="btn-outline py-1.5" href={`/api/crm/marketing-report?${qs}`}>Download report (Excel / CSV)</a><span className="self-center text-xs text-muted">Follow-ups: {m.totals.followUpsOnTime} of {m.totals.followUpsDue} done within 24 h of the due time.</span></p>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Daily lead generation"><TrendChart rows={m.daily.map((d) => ({ date: d.date, leads: d.leads, confirmed: d.confirmed }))} series={[{ key: 'leads', label: 'Enquiries', color: 'var(--viz-1)' }, { key: 'confirmed', label: 'Confirmed', color: 'var(--viz-4)' }]} /></Panel>
        <Panel title="Monthly enquiries and enrollment"><TrendChart rows={m.monthly} series={[{ key: 'leads', label: 'Enquiries', color: 'var(--viz-1)' }, { key: 'confirmed', label: 'Confirmed', color: 'var(--viz-4)' }, { key: 'enrolled', label: 'College IDs', color: 'var(--viz-2)' }]} /></Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Pipeline now (enquiries in range)"><BarList rows={m.pipeline.map((x) => ({ label: x.label, value: x.value }))} /></Panel>
        <Panel title="Admission source comparison"><Donut label="enquiries" slices={m.sources.slice(0, 5).map((s, i) => ({ label: sourceLabel(s.source), value: s.leads, color: `var(--viz-${(i % 4) + 1})` })).concat(m.sources.length > 5 ? [{ label: 'Other sources', value: m.sources.slice(5).reduce((n, s) => n + s.leads, 0), color: 'var(--viz-grid)' }] : [])} /></Panel>
      </div>
      <Panel title="Sources: conversion and cost">
        {m.sources.length === 0 ? <Empty>No enquiries in this range.</Empty> : (
          <div className="overflow-x-auto"><table className="table-base min-w-[640px] text-sm"><thead><tr><th>Source</th><th className="text-right">Enquiries</th><th className="text-right">Visited</th><th className="text-right">Confirmed</th><th className="text-right">Conversion</th><th className="text-right">Spend</th><th className="text-right">Cost / lead</th><th className="text-right">Cost / admission</th></tr></thead>
            <tbody>{m.sources.map((s) => <tr key={s.source}><td>{sourceLabel(s.source)}</td><td className="text-right font-mono">{s.leads}</td><td className="text-right font-mono">{s.visited}</td><td className="text-right font-mono">{s.confirmed}</td><td className="text-right font-mono">{s.conversion ?? '–'}%</td><td className="text-right font-mono">{s.spend ? formatINR(s.spend) : '–'}</td><td className="text-right font-mono">{s.costPerLead ? formatINR(s.costPerLead) : '–'}</td><td className="text-right font-mono">{s.costPerAdmission ? formatINR(s.costPerAdmission) : '–'}</td></tr>)}</tbody></table></div>
        )}
      </Panel>
      <Panel title="Campaign-wise enrollment">
        {m.campaigns.length === 0 ? <Empty>No campaigns yet. Register them under Marketing spend & campaigns, and use ?utm_campaign=CODE in ad links.</Empty> : (
          <>
            <BarList rows={m.campaigns.map((c) => ({ label: c.name, value: c.confirmed, note: `${c.leads} enq · ${c.conversion ?? 0}%`, hint: c.registered ? c.channel : 'tag seen on enquiries, not registered' }))} color="var(--viz-4)" />
            {m.bestCampaigns.length > 0 && <p className="mt-3 text-sm"><b>Most successful</b> (5+ enquiries, by conversion then cost per admission): {m.bestCampaigns.map((c) => `${c.name} (${c.conversion}%${c.costPerAdmission ? `, ${formatINR(c.costPerAdmission)}/admission` : ''})`).join(' · ')}</p>}
            <TableView><table className="table-base text-xs"><thead><tr><th>Campaign</th><th className="text-right">Enquiries</th><th className="text-right">Target</th><th className="text-right">Confirmed</th><th className="text-right">Target</th><th className="text-right">Budget</th><th className="text-right">Cost / admission</th></tr></thead>
              <tbody>{m.campaigns.map((c) => <tr key={c.code}><td>{c.name}</td><td className="text-right">{c.leads}</td><td className="text-right">{c.targetLeads || '–'}</td><td className="text-right">{c.confirmed}</td><td className="text-right">{c.targetAdmissions || '–'}</td><td className="text-right">{c.budget ? formatINR(c.budget) : '–'}</td><td className="text-right">{c.costPerAdmission ? formatINR(c.costPerAdmission) : '–'}</td></tr>)}</tbody></table></TableView>
          </>
        )}
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Counsellor-wise performance">{m.owners.length === 0 ? <Empty>No owned enquiries in range.</Empty> : <BarList rows={m.owners.map((o) => ({ label: o.name, value: o.confirmed, note: `${o.leads} leads · ${o.calls} calls · ${o.conversion ?? 0}%` }))} color="var(--viz-1)" />}</Panel>
        <Panel title="Target vs actual admissions (season)">{m.seats.length === 0 ? <Empty>No seat targets set (Website content › Admissions season).</Empty> : <BarList rows={m.seats.map((s) => ({ label: s.program, value: s.filled, note: `of ${s.target}` }))} color="var(--viz-2)" />}</Panel>
      </div>
      <Panel title="Admission forecast (estimate)">
        {'insufficient' in fc ? <p className="text-sm text-muted">Not enough history to estimate yet: {fc.basis} decided enquiries in the past year (needs at least 30). The forecast appears once there is enough real data.</p> : (
          <p className="text-sm">About <b>{fc.expectedFromPipeline}</b> more admissions can be expected from the {fc.openLeads} open enquiries. <span className="text-muted">Estimate from {fc.basis} decided enquiries in the past year: {fc.rateAll}% of decided enquiries confirmed{fc.rateVisited !== null ? `, ${fc.rateVisited}% after a campus visit` : ''}. It is a projection, not a count.</span></p>
        )}
      </Panel>
      <Panel title={`Needs immediate follow-up (${m.attention.length})`}>
        {m.attention.length === 0 ? <Empty>Nothing overdue, and every hot or warm lead has been contacted.</Empty> : (
          <div className="overflow-x-auto"><table className="table-base min-w-[640px] text-sm"><thead><tr><th>Lead</th><th>Category</th><th>Owner</th><th className="text-right">Overdue</th><th>Recommended next step</th></tr></thead>
            <tbody>{m.attention.map((a) => <tr key={a.id}><td><Link className="underline" href={`/crm/leads/${a.id}`}>{a.name}</Link></td><td className="capitalize">{a.category ?? '–'}</td><td>{a.owner}</td><td className="text-right font-mono">{a.overdueHours ? `${a.overdueHours} h` : '–'}</td><td className="text-xs">{a.recommendation}</td></tr>)}</tbody></table></div>
        )}
        <p className="mt-2 text-xs text-muted">Recommendations follow fixed rules (hot within 24 h, warm within 2 days, after a visit within 24 h); nothing is sent automatically.</p>
      </Panel>
    </>
  );
}