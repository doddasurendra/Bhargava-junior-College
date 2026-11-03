/**
 * Management dashboard and 7 PM report metrics (brief §6.8, §7.2, §7.3, §7.5, §8 — §8 was truncated in the
 * brief we received, so the definitions below are ours; each is stated on the dashboard). Pure: unit tested.
 * All day boundaries are India Standard Time.
 */
import { addDays, todayIST } from '../dates';
import { followUp, istDate, visitFlag } from './rules';
import { CLOSED_STATUSES, LOST_REASONS, type AuditEntry, type CallLog, type CrmLead, type Staff, type VisitRow } from './types';

export interface MetricsData {
  leads: CrmLead[];
  calls: CallLog[];
  audit: AuditEntry[];
  visits: VisitRow[];
  signOffs: { leadId: string; stage: string; at: string }[];
  staff: Staff[];
}

export type PeriodKey = 'today' | 'mtd' | 'season';

export interface Period {
  key: PeriodKey;
  label: string;
  /** inclusive, IST calendar dates */
  from: string;
  to: string;
}

export function periods(seasonStart: string, now: Date = new Date()): Record<PeriodKey, Period> {
  const today = todayIST(now);
  return {
    today: { key: 'today', label: 'Today', from: today, to: today },
    mtd: { key: 'mtd', label: 'Month to date', from: `${today.slice(0, 8)}01`, to: today },
    season: { key: 'season', label: 'Season to date', from: seasonStart, to: today },
  };
}

const inPeriod = (iso: string | null | undefined, p: Period) => {
  if (!iso) return false;
  const d = istDate(iso);
  return d >= p.from && d <= p.to;
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export function computeMetrics(data: MetricsData, p: Period, now: Date = new Date()) {
  const active = data.leads.filter((l) => l.status !== 'invalid' || inPeriod(l.createdAt, p));
  const open = data.leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const calls = data.calls.filter((c) => inPeriod(c.createdAt, p));
  const audit = data.audit.filter((a) => inPeriod(a.at, p));
  const leadById = new Map(data.leads.map((l) => [l.id, l]));

  // ---- funnel (activity in the period)
  const newLeads = data.leads.filter((l) => inPeriod(l.createdAt, p));
  const leadsCalled = new Set(calls.map((c) => c.leadId));
  const connected = calls.filter((c) => c.outcome === 'connected');
  const visitsBooked = data.visits.filter((v) => inPeriod(v.createdAt, p));
  const visitsHeld = data.visits.filter((v) => v.status === 'completed' && inPeriod(v.outcomeAt, p));
  const noShows = audit.filter((a) => a.action === 'visit_no_show');
  const decision = (v: string) => audit.filter((a) => a.action === 'decision' && a.newValue === v);
  const lostAudit = audit.filter((a) => (a.action === 'decision' && a.newValue === 'lost') || (a.action === 'status_changed' && a.newValue === 'lost'));
  const lostLeadIds = new Set(lostAudit.map((a) => a.leadId));
  const signed = (stage: string) => data.signOffs.filter((s) => s.stage === stage && inPeriod(s.at, p));

  const funnel = [
    { key: 'leads', label: 'New leads', value: newLeads.length, definition: 'Leads created in the period (all sources, after de-duplication).' },
    { key: 'called', label: 'Leads called', value: leadsCalled.size, definition: 'Distinct leads with at least one logged call in the period.' },
    { key: 'visits_booked', label: 'Visits booked', value: visitsBooked.length, definition: 'Campus visits booked in the period (website, chat, CRM).' },
    { key: 'visits_held', label: 'Visits held', value: visitsHeld.length, definition: 'Visits marked completed with an outcome in the period.' },
    { key: 'confirmed', label: 'Admissions confirmed', value: new Set(decision('confirmed').map((a) => a.leadId)).size, definition: 'Leads whose admission decision was recorded as Confirmed in the period.' },
    { key: 'fee', label: 'Fees confirmed', value: signed('fee').length, definition: 'Fee-payment step signed off by Accounts in the period.' },
    { key: 'college_id', label: 'College IDs issued', value: signed('college_id').length, definition: 'Admissions completed (College ID generated) in the period.' },
  ];

  // ---- losses (brief §7.2: "shows exactly where admissions are being lost")
  const lossByReason = new Map<string, number>();
  const competitors = new Map<string, number>();
  for (const id of lostLeadIds) {
    const l = leadById.get(id);
    const reason = l?.lostReason ?? 'unrecorded';
    lossByReason.set(reason, (lossByReason.get(reason) ?? 0) + 1);
    if (l?.lostCompetitor) competitors.set(l.lostCompetitor, (competitors.get(l.lostCompetitor) ?? 0) + 1);
  }
  const lostAfterVisit = [...lostLeadIds].filter((id) => data.visits.some((v) => v.leadId === id && v.status === 'completed')).length;

  // ---- current backlog (point in time, not period-bound)
  const follow = open.map((l) => ({ lead: l, f: followUp(l, now) }));
  const overdue = follow.filter((x) => x.f.state === 'overdue');
  const visitsNeedingOutcome = data.visits.filter((v) => visitFlag(v, now) !== 'ok');
  const backlog = {
    open: open.length,
    unassigned: open.filter((l) => !l.ownerId).length,
    unqualified: open.filter((l) => !l.category).length,
    overdue: overdue.length,
    escalated24: overdue.filter((x) => x.f.escalation === 2).length,
    escalated48: overdue.filter((x) => x.f.escalation === 3).length,
    visitsNeedingOutcome: visitsNeedingOutcome.length,
    visitsEscalated: visitsNeedingOutcome.filter((v) => visitFlag(v, now) === 'escalated').length,
    pendingDecisions: open.filter((l) => l.status === 'decision_pending').length,
    inVerification: open.filter((l) => l.status === 'confirmed').length,
  };

  // ---- accountability by owner (brief §7.5)
  const owners = data.staff
    .filter((s) => s.roles.some((r) => r === 'telecaller' || r === 'admission_counsellor'))
    .map((s) => {
      const mine = follow.filter((x) => x.lead.ownerId === s.id);
      const myCalls = calls.filter((c) => c.actorId === s.id);
      return {
        id: s.id,
        name: s.fullName,
        role: s.roles.includes('admission_counsellor') ? 'Counsellor' : 'Telecaller',
        openLeads: mine.length,
        calls: myCalls.length,
        connectRate: pct(myCalls.filter((c) => c.outcome === 'connected').length, myCalls.length),
        overdue: mine.filter((x) => x.f.state === 'overdue').length,
        escalated48: mine.filter((x) => x.f.escalation === 3).length,
        visitsBooked: visitsBooked.filter((v) => leadById.get(v.leadId)?.ownerId === s.id).length,
        confirmed: decision('confirmed').filter((a) => leadById.get(a.leadId)?.ownerId === s.id).length,
      };
    })
    .sort((a, b) => b.escalated48 - a.escalated48 || b.overdue - a.overdue || a.name.localeCompare(b.name));

  // ---- sources (leads created in the period, and how far they got)
  const sourceRows = new Map<string, { source: string; leads: number; visited: number; confirmed: number }>();
  for (const l of newLeads) {
    const r = sourceRows.get(l.firstSource) ?? { source: l.firstSource, leads: 0, visited: 0, confirmed: 0 };
    r.leads++;
    if (data.visits.some((v) => v.leadId === l.id && v.status === 'completed')) r.visited++;
    if (l.status === 'confirmed' || l.status === 'admitted') r.confirmed++;
    sourceRows.set(l.firstSource, r);
  }

  // ---- data quality (brief §7.1 step 2: % mix by school and source)
  const mix = (key: (l: CrmLead) => string) => {
    const m = new Map<string, { key: string; total: number; hot: number; warm: number; cold: number; invalid: number; unqualified: number }>();
    for (const l of newLeads) {
      const k = key(l);
      const r = m.get(k) ?? { key: k, total: 0, hot: 0, warm: 0, cold: 0, invalid: 0, unqualified: 0 };
      r.total++;
      r[l.category ?? 'unqualified']++;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  // ---- 48h list for the 7 PM report (brief §7.3: overdue 48 hours → flag to management)
  const staffName = new Map(data.staff.map((s) => [s.id, s.fullName]));
  const flagged = overdue
    .filter((x) => x.f.escalation === 3)
    .sort((a, b) => b.f.overdueHours - a.f.overdueHours)
    .map((x) => ({ leadId: x.lead.id, name: x.lead.contactName ?? x.lead.studentName ?? x.lead.phone, owner: x.lead.ownerId ? staffName.get(x.lead.ownerId) ?? 'Unknown' : 'Unassigned', overdueHours: x.f.overdueHours, status: x.lead.status }));

  return {
    period: p,
    funnel,
    calls: { total: calls.length, connected: connected.length, connectRate: pct(connected.length, calls.length) },
    noShows: noShows.length,
    conversion: {
      leadToVisit: pct(visitsHeld.length, newLeads.length),
      visitToConfirmed: pct(funnel[4].value, visitsHeld.length),
    },
    losses: {
      total: lostLeadIds.size,
      afterVisit: lostAfterVisit,
      byReason: [...lossByReason].map(([reason, n]) => ({ reason, label: LOST_REASONS.find((r) => r.value === reason)?.label ?? 'Not recorded', n })).sort((a, b) => b.n - a.n),
      competitors: [...competitors].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    },
    backlog,
    owners,
    sources: [...sourceRows.values()].sort((a, b) => b.leads - a.leads),
    quality: { bySource: mix((l) => l.firstSource), bySchool: mix((l) => l.school ?? '(no school)').slice(0, 25) },
    flagged,
    activeLeads: active.length,
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;

/** Daily series for the trend chart: new leads, visits held and confirmations per IST day. */
export function dailySeries(data: MetricsData, from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const count = <T>(rows: T[], at: (r: T) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const iso = at(r);
      if (iso) m.set(istDate(iso), (m.get(istDate(iso)) ?? 0) + 1);
    }
    return m;
  };
  const leads = count(data.leads, (l) => l.createdAt);
  const visits = count(
    data.visits.filter((v) => v.status === 'completed'),
    (v) => v.outcomeAt,
  );
  const confirmed = count(
    data.audit.filter((a) => a.action === 'decision' && a.newValue === 'confirmed'),
    (a) => a.at,
  );
  return days.map((d) => ({ date: d, leads: leads.get(d) ?? 0, visits: visits.get(d) ?? 0, confirmed: confirmed.get(d) ?? 0 }));
}
