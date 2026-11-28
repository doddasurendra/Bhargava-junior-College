import { getStaffSession } from '@/lib/crm/auth';
import { toCsv } from '@/lib/crm/csv';
import { canSeeMarketing, marketingAnalytics } from '@/lib/crm/marketingAnalytics';
import { addDays, todayIST } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Marketing & admissions report for the dashboard's range and filters, as one CSV (opens in Excel). */
export async function GET(req: Request) {
  const user = await getStaffSession();
  if (!user) return new Response('Sign in first.', { status: 401 });
  if (!canSeeMarketing(user)) return new Response('Not allowed.', { status: 403 });
  const u = new URL(req.url);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get(k) ?? '') ? u.searchParams.get(k)! : null);
  const to = iso('to') ?? todayIST();
  const from = iso('from') ?? addDays(to, -29);
  const m = await marketingAnalytics(user, { from, to, program: u.searchParams.get('program') || undefined, source: u.searchParams.get('source') || undefined, campaign: u.searchParams.get('campaign') || undefined, ownerId: u.searchParams.get('owner') || undefined });
  const rows: string[][] = [
    ['Marketing & admissions report', `${from} to ${to}`],
    [],
    ['Total enquiries', String(m.totals.enquiries)], ['Visited campus', String(m.totals.visited)], ['Admissions confirmed', String(m.totals.confirmed)], ['Lead conversion %', String(m.totals.conversion ?? '')], ['Follow-ups done on time %', String(m.totals.followUpRate ?? '')],
    [],
    ['Pipeline stage', 'Enquiries'], ...m.pipeline.map((p) => [p.label, String(p.value)]),
    [],
    ['Source', 'Enquiries', 'Visited', 'Confirmed', 'Conversion %', 'Spend', 'Cost per lead', 'Cost per admission'], ...m.sources.map((s) => [s.source, String(s.leads), String(s.visited), String(s.confirmed), String(s.conversion ?? ''), String(s.spend), String(s.costPerLead ?? ''), String(s.costPerAdmission ?? '')]),
    [],
    ['Campaign', 'Code', 'Channel', 'Enquiries', 'Confirmed', 'Conversion %', 'Budget', 'Cost per admission', 'Target enquiries', 'Target admissions'], ...m.campaigns.map((c) => [c.name, c.code, c.channel, String(c.leads), String(c.confirmed), String(c.conversion ?? ''), String(c.budget), String(c.costPerAdmission ?? ''), String(c.targetLeads), String(c.targetAdmissions)]),
    [],
    ['Counsellor', 'Leads', 'Calls', 'Connected', 'Visits', 'Confirmed', 'Conversion %'], ...m.owners.map((o) => [o.name, String(o.leads), String(o.calls), String(o.connected), String(o.visits), String(o.confirmed), String(o.conversion ?? '')]),
    [],
    ['Month', 'Enquiries', 'Confirmed', 'College IDs'], ...m.monthly.map((x) => [x.month, String(x.leads), String(x.confirmed), String(x.enrolled)]),
    [],
    ['Forecast (estimate)', 'insufficient' in m.forecast ? `not enough history (${m.forecast.basis} decided enquiries)` : `${m.forecast.expectedFromPipeline} more admissions expected from ${m.forecast.openLeads} open enquiries, based on ${m.forecast.basis} decided enquiries`],
  ];
  return new Response('﻿' + toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="marketing-${from}_to_${to}.csv"`, 'Cache-Control': 'no-store' } });
}
