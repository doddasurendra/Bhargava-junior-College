import 'server-only';
import { getContent } from '../cms';
import { addDays, todayIST } from '../dates';
import { getRecordStore } from '../records';
import { marketingCampaigns, marketingSpend } from '../records/collections';
import { filterData, type MetricsData } from './metrics';
import { can } from './permissions';
import { getCrmRepo } from './repo';
import { followUp, istDate } from './rules';
import { CrmError } from './service';
import type { CrmLead, Staff } from './types';

/**
 * Marketing & admissions analytics. Everything is counted from lead, call, visit and admission records; the
 * forecast is labelled as an estimate and shows how much history it rests on. Nothing is invented: with too
 * little history the forecast says so instead of guessing.
 */
export const canSeeMarketing = (u: Staff) => can(u, 'dashboard.view') || can(u, 'lead.viewAll') || can(u, 'marketing.spend');

export interface MarketingFilter { from: string; to: string; program?: string; source?: string; campaign?: string; ownerId?: string }

/** The enquiry pipeline the marketing team asked for, mapped from the CRM's lead states (exclusive, in this order). */
export const PIPELINE = [
  ['confirmed', 'Admission confirmed'], ['not_interested', 'Not interested / lost'], ['application', 'Application submitted'], ['counselling', 'Counselling scheduled'],
  ['follow_up', 'Follow-up pending'], ['interested', 'Interested'], ['contacted', 'Contacted'], ['new', 'New (not contacted yet)'], ['invalid', 'Invalid'],
] as const;
type Stage = (typeof PIPELINE)[number][0];

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const inRange = (iso: string | null | undefined, from: string, to: string) => !!iso && istDate(iso) >= from && istDate(iso) <= to;

function stageOf(l: CrmLead, called: Set<string>, applied: Set<string>): Stage {
  if (l.status === 'confirmed' || l.status === 'admitted') return 'confirmed';
  if (l.status === 'lost') return 'not_interested';
  if (l.status === 'invalid') return 'invalid';
  if (applied.has(l.id)) return 'application';
  if (l.status === 'visit_scheduled') return 'counselling';
  if (['visited', 'counselled', 'decision_pending'].includes(l.status) || l.nextFollowUpAt) return 'follow_up';
  if (l.category === 'hot' || l.category === 'warm') return 'interested';
  if (called.has(l.id) || l.lastContactAt) return 'contacted';
  return 'new';
}

/** Rule-based next step for a lead that needs attention (shown as a recommendation, never acted on automatically). */
function recommend(l: CrmLead, overdueHours: number): string {
  if (overdueHours >= 48) return 'Overdue 2+ days: call today; if no answer, WhatsApp and try again tomorrow morning.';
  if (overdueHours > 0) return 'Due now: call today.';
  if (l.status === 'visited' || l.status === 'counselled' || l.status === 'decision_pending') return 'Visited: call within 24 hours for the decision, then every 2 days.';
  if (l.category === 'hot') return 'Hot: call within 24 hours and offer a campus visit slot.';
  if (l.category === 'warm') return 'Warm: call within 2 days, then weekly.';
  if (!l.lastContactAt) return 'Not contacted yet: first call within 24 hours.';
  return 'Cold: weekly follow-up.';
}

async function load(from: string) {
  const repo = getCrmRepo();
  const since = new Date(`${addDays(from, -400)}T00:00:00+05:30`).toISOString(); // history for the forecast
  const [data, staff, spend, campaigns, { season }] = await Promise.all([repo.exportForMetrics(since), repo.listStaff(), marketingSpend.list(getRecordStore()), marketingCampaigns.list(getRecordStore()), getContent()]);
  return { data: { ...data, staff } as MetricsData, spend: spend.map((r) => r.data), campaigns: campaigns.map((r) => ({ id: r.id, ...r.data })), season };
}

export async function marketingAnalytics(user: Staff, f: MarketingFilter, now = new Date()) {
  if (!canSeeMarketing(user)) throw new CrmError('Only marketing, admissions management and management can see marketing analytics.');
  const { data: all, spend, campaigns, season } = await load(f.from);
  // campaign attribution: utm tag, or (offline campaigns) first source within the campaign dates
  const leadCampaigns = new Map<string, Set<string>>();
  for (const t of all.campaigns ?? []) { const s = leadCampaigns.get(t.leadId) ?? new Set(); s.add(t.campaign.toLowerCase()); leadCampaigns.set(t.leadId, s); }
  for (const c of campaigns) if (c.source) for (const l of all.leads) {
    const d = istDate(l.createdAt);
    if (l.firstSource === c.source && d >= c.startDate && (!c.endDate || d <= c.endDate)) { const s = leadCampaigns.get(l.id) ?? new Set(); s.add(c.code); leadCampaigns.set(l.id, s); }
  }
  const campaignLeadIds = f.campaign ? new Set([...leadCampaigns].filter(([, s]) => s.has(f.campaign!)).map(([id]) => id)) : undefined;
  const data = filterData(all, { program: f.program, source: f.source, ownerId: f.ownerId, campusLeadIds: campaignLeadIds });
  const leads = data.leads.filter((l) => inRange(l.createdAt, f.from, f.to));
  const ids = new Set(leads.map((l) => l.id));
  const called = new Set(data.calls.map((c) => c.leadId));
  const applied = new Set(data.signOffs.filter((s) => s.stage === 'application').map((s) => s.leadId));
  const visited = new Set(data.visits.filter((v) => v.status === 'completed').map((v) => v.leadId));
  const isConfirmed = (l: CrmLead) => l.status === 'confirmed' || l.status === 'admitted';
  const confirmed = leads.filter(isConfirmed);

  // pipeline (stage of each lead created in range, now)
  const stageCount = new Map<Stage, number>();
  for (const l of leads) stageCount.set(stageOf(l, called, applied), (stageCount.get(stageOf(l, called, applied)) ?? 0) + 1);
  const pipeline = PIPELINE.map(([k, label]) => ({ key: k, label, value: stageCount.get(k) ?? 0 }));

  // daily and monthly lead generation, confirmations and College IDs
  const days: string[] = [];
  for (let d = f.from; d <= f.to; d = addDays(d, 1)) days.push(d);
  const confirmAt = new Map<string, string>();
  for (const a of data.audit) if (a.action === 'decision' && a.newValue === 'confirmed') confirmAt.set(a.leadId, a.at);
  const daily = days.map((d) => ({ date: d, leads: leads.filter((l) => istDate(l.createdAt) === d).length, confirmed: [...confirmAt].filter(([id, at]) => ids.has(id) && istDate(at) === d).length }));
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  const admittedAt = new Map(data.signOffs.filter((s) => s.stage === 'college_id').map((s) => [s.leadId, s.at] as const));
  const monthly = months.map((m) => ({ date: `${m}-01`, month: m, leads: leads.filter((l) => l.createdAt && istDate(l.createdAt).startsWith(m)).length, confirmed: [...confirmAt].filter(([, at]) => istDate(at).startsWith(m)).length, enrolled: [...admittedAt].filter(([, at]) => istDate(at).startsWith(m)).length }));

  // sources
  const months2 = new Set(months);
  const spendBy = new Map<string, number>();
  for (const s of spend) if (months2.has(s.month)) spendBy.set(s.source, (spendBy.get(s.source) ?? 0) + s.amount);
  const srcMap = new Map<string, { leads: number; visited: number; confirmed: number }>();
  for (const l of leads) { const r = srcMap.get(l.firstSource) ?? { leads: 0, visited: 0, confirmed: 0 }; r.leads++; if (visited.has(l.id)) r.visited++; if (isConfirmed(l)) r.confirmed++; srcMap.set(l.firstSource, r); }
  const sources = [...srcMap].map(([source, r]) => ({ source, ...r, conversion: pct(r.confirmed, r.leads), spend: spendBy.get(source) ?? 0, costPerLead: spendBy.get(source) && r.leads ? Math.round(spendBy.get(source)! / r.leads) : null, costPerAdmission: spendBy.get(source) && r.confirmed ? Math.round(spendBy.get(source)! / r.confirmed) : null })).sort((a, b) => b.leads - a.leads);

  // campaigns (registered + any utm tag seen)
  const codes = new Set([...campaigns.map((c) => c.code), ...[...leadCampaigns.values()].flatMap((s) => [...s])]);
  const campaignRows = [...codes].map((code) => {
    const c = campaigns.find((x) => x.code === code);
    const ls = leads.filter((l) => leadCampaigns.get(l.id)?.has(code));
    const conf = ls.filter(isConfirmed).length;
    return { code, name: c?.name ?? code, channel: c?.channel ?? 'untracked', registered: !!c, leads: ls.length, visited: ls.filter((l) => visited.has(l.id)).length, confirmed: conf, conversion: pct(conf, ls.length), budget: c?.budget ?? 0, costPerLead: c?.budget && ls.length ? Math.round(c.budget / ls.length) : null, costPerAdmission: c?.budget && conf ? Math.round(c.budget / conf) : null, targetLeads: c?.targetLeads ?? 0, targetAdmissions: c?.targetAdmissions ?? 0 };
  }).sort((a, b) => b.leads - a.leads);
  const ranked = campaignRows.filter((c) => c.leads >= 5).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0) || (a.costPerAdmission ?? Infinity) - (b.costPerAdmission ?? Infinity));

  // counsellors / telecallers
  const owners = data.staff.filter((s) => s.roles.some((r) => ['telecaller', 'admission_counsellor', 'admission_manager'].includes(r))).map((s) => {
    const mine = leads.filter((l) => l.ownerId === s.id);
    const calls = data.calls.filter((c) => c.actorId === s.id && inRange(c.createdAt, f.from, f.to));
    const conf = mine.filter(isConfirmed).length;
    return { id: s.id, name: s.fullName, leads: mine.length, calls: calls.length, connected: calls.filter((c) => c.outcome === 'connected').length, visits: mine.filter((l) => visited.has(l.id)).length, confirmed: conf, conversion: pct(conf, mine.length) };
  }).filter((o) => o.leads || o.calls).sort((a, b) => b.confirmed - a.confirmed || b.leads - a.leads);

  // follow-up completion: follow-ups that fell due in range (up to now) and whether the lead was contacted within 24 h of the due time
  const nowIso = now.toISOString();
  const touches = new Map<string, string[]>();
  for (const c of data.calls) touches.set(c.leadId, [...(touches.get(c.leadId) ?? []), c.createdAt]);
  for (const v of data.visits) if (v.outcomeAt) touches.set(v.leadId, [...(touches.get(v.leadId) ?? []), v.outcomeAt]);
  let due = 0, onTime = 0;
  for (const c of data.calls) {
    // calls are already limited to the filtered leads (filterData)
    if (!c.nextFollowUpAt || c.nextFollowUpAt > nowIso || !inRange(c.nextFollowUpAt, f.from, f.to)) continue;
    due++;
    const limit = new Date(Date.parse(c.nextFollowUpAt) + 86_400_000).toISOString();
    if ((touches.get(c.leadId) ?? []).some((t) => t > c.createdAt && t <= limit)) onTime++;
  }

  // leads needing attention now (open leads, any creation date in the data)
  const attention = data.leads.filter((l) => !['confirmed', 'admitted', 'lost', 'invalid'].includes(l.status)).map((l) => ({ l, fu: followUp(l, now) }))
    .filter(({ l, fu }) => fu.state === 'overdue' || ((l.category === 'hot' || l.category === 'warm') && !l.lastContactAt))
    .sort((a, b) => b.fu.overdueHours - a.fu.overdueHours || (a.l.category === 'hot' ? -1 : 1))
    .slice(0, 50)
    .map(({ l, fu }) => ({ id: l.id, name: l.studentName ?? l.contactName ?? 'Lead', category: l.category, status: l.status, owner: data.staff.find((s) => s.id === l.ownerId)?.fullName ?? 'Unassigned', overdueHours: fu.overdueHours, recommendation: recommend(l, fu.overdueHours) }));

  // forecast (ESTIMATE): historical decided outcomes → probability of confirmation by current stage
  const histFrom = addDays(f.from, -365);
  const decided = all.leads.filter((l) => inRange(l.createdAt, histFrom, todayIST(now)) && ['confirmed', 'admitted', 'lost'].includes(l.status));
  const pConfirm = (filter: (l: CrmLead) => boolean) => { const g = decided.filter(filter); return g.length >= 10 ? g.filter(isConfirmed).length / g.length : null; };
  const pVisited = pConfirm((l) => visited.has(l.id));
  const pAll = pConfirm(() => true);
  const open = data.leads.filter((l) => !['confirmed', 'admitted', 'lost', 'invalid'].includes(l.status));
  const forecast = decided.length >= 30 && pAll !== null ? {
    basis: decided.length,
    rateAll: Math.round(pAll * 1000) / 10,
    rateVisited: pVisited === null ? null : Math.round(pVisited * 1000) / 10,
    expectedFromPipeline: Math.round(open.reduce((s, l) => s + (visited.has(l.id) && pVisited !== null ? pVisited : pAll), 0)),
    openLeads: open.length,
  } : { basis: decided.length, insufficient: true as const };

  // seats: target vs actual (College IDs this season)
  const filled = new Map<string, number>();
  for (const s of data.admitted ?? []) filled.set(s.program, (filled.get(s.program) ?? 0) + 1);
  const seats = Object.entries(season.seatTargets ?? {}).map(([program, target]) => ({ program, target: Number(target), filled: filled.get(program) ?? 0 }));

  return {
    filter: f,
    totals: { enquiries: leads.length, confirmed: confirmed.length, conversion: pct(confirmed.length, leads.length), visited: leads.filter((l) => visited.has(l.id)).length, followUpRate: pct(onTime, due), followUpsDue: due, followUpsOnTime: onTime },
    pipeline, daily, monthly, sources, campaigns: campaignRows, bestCampaigns: ranked.slice(0, 3), owners, attention, forecast, seats,
    options: { sources: [...new Set(all.leads.map((l) => l.firstSource))].sort(), campaigns: [...codes].sort(), owners: data.staff.filter((s) => s.roles.some((r) => ['telecaller', 'admission_counsellor', 'admission_manager'].includes(r))).map((s) => ({ id: s.id, name: s.fullName })) },
  };
}

export async function listCampaigns(user: Staff) {
  if (!canSeeMarketing(user)) throw new CrmError('Not permitted.');
  return (await marketingCampaigns.list(getRecordStore())).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function saveCampaign(user: Staff, input: Record<string, unknown>, id?: string) {
  if (!can(user, 'marketing.spend') && !can(user, 'lead.assign')) throw new CrmError('Only marketing or admissions management can manage campaigns.');
  const code = String(input.code ?? '').trim().toLowerCase();
  const dup = (await marketingCampaigns.list(getRecordStore(), { k1: code })).find((c) => c.id !== id);
  if (dup) throw new CrmError('Another campaign already uses this code.');
  return marketingCampaigns.put(getRecordStore(), { ...input, code, createdBy: user.id }, id);
}

export async function removeCampaign(user: Staff, id: string) {
  if (!can(user, 'marketing.spend') && !can(user, 'lead.assign')) throw new CrmError('Not permitted.');
  await marketingCampaigns.remove(getRecordStore(), id);
}
