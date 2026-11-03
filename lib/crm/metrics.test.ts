import { describe, expect, it } from 'vitest';
import { computeMetrics, dailySeries, filterData, periods, type MetricsData } from './metrics';
import { reportEmailHtml, reportPdf } from './reportPdf';
import type { CrmLead, Staff } from './types';

const NOW = new Date('2026-11-03T13:30:00Z'); // 19:00 IST, Tuesday 3 Nov
const H = 3_600_000;
const ago = (h: number) => new Date(NOW.getTime() - h * H).toISOString();

const staff = (id: string, roles: Staff['roles']): Staff => ({ id, fullName: id, email: null, phone: null, roles, active: true });
let n = 0;
const lead = (p: Partial<CrmLead>): CrmLead => ({
  id: `l${++n}`,
  phone: `+9190000${String(n).padStart(5, '0')}`,
  contactName: `Lead ${n}`,
  parentName: null,
  studentName: null,
  studentPhone: null,
  school: null,
  classLevel: null,
  board: null,
  area: null,
  program: null,
  category: null,
  status: 'open',
  stage: 'enquiry',
  ownerId: null,
  assignedAt: null,
  firstSource: 'callback',
  lastSource: 'callback',
  siblingOf: null,
  nextFollowUpAt: null,
  lastContactAt: null,
  lostReason: null,
  lostCompetitor: null,
  createdAt: ago(1),
  updatedAt: ago(1),
  ...p,
});

function fixture(): MetricsData {
  n = 0;
  const a = lead({ ownerId: 'priya', category: 'hot', school: 'ZPHS', createdAt: ago(2), nextFollowUpAt: ago(50), lastContactAt: ago(60) }); // today, 48h+ overdue
  const b = lead({ ownerId: 'priya', category: 'warm', school: 'ZPHS', createdAt: ago(10), status: 'confirmed', nextFollowUpAt: new Date(NOW.getTime() + 5 * H).toISOString(), lastContactAt: ago(3) });
  const c = lead({ ownerId: 'ramesh', category: 'invalid', status: 'invalid', school: 'St Ann', firstSource: 'school_data', createdAt: ago(3) });
  const d = lead({ ownerId: 'ramesh', status: 'lost', lostReason: 'competitor', lostCompetitor: 'XYZ Academy', createdAt: ago(24 * 40) }); // previous month
  const e = lead({ firstSource: 'school_data', createdAt: ago(4) }); // imported, unassigned
  return {
    leads: [a, b, c, d, e],
    calls: [
      { id: 'c1', leadId: a.id, actorId: 'priya', outcome: 'connected', interest: 'hot', notes: null, nextFollowUpAt: null, createdAt: ago(1) },
      { id: 'c2', leadId: b.id, actorId: 'priya', outcome: 'not_answered', interest: null, notes: null, nextFollowUpAt: null, createdAt: ago(2) },
      { id: 'c3', leadId: c.id, actorId: 'ramesh', outcome: 'wrong_number', interest: null, notes: null, nextFollowUpAt: null, createdAt: ago(2) },
      { id: 'c4', leadId: d.id, actorId: 'ramesh', outcome: 'connected', interest: null, notes: null, nextFollowUpAt: null, createdAt: ago(24 * 10) },
    ],
    audit: [
      { id: 'a1', leadId: b.id, actorId: 'anil', action: 'decision', field: 'status', oldValue: 'visited', newValue: 'confirmed', reason: null, at: ago(1) },
      { id: 'a2', leadId: d.id, actorId: 'ramesh', action: 'decision', field: 'status', oldValue: 'visited', newValue: 'lost', reason: 'competitor', at: ago(24 * 5) },
    ],
    visits: [
      { id: 'v1', leadId: b.id, date: '2026-11-03', slot: '10:00', familySize: 2, program: null, status: 'completed', outcome: 'ok', outcomeAt: ago(6), outcomeBy: 'fd', createdAt: ago(28) },
      { id: 'v2', leadId: d.id, date: '2026-10-29', slot: '10:00', familySize: 2, program: null, status: 'completed', outcome: 'ok', outcomeAt: ago(24 * 5), outcomeBy: 'fd', createdAt: ago(24 * 7) },
      { id: 'v3', leadId: a.id, date: '2026-11-01', slot: '11:30', familySize: 1, program: null, status: 'scheduled', outcome: null, outcomeAt: null, outcomeBy: null, createdAt: ago(24 * 3) }, // past, no outcome
    ],
    signOffs: [{ leadId: b.id, stage: 'application', at: ago(1) }],
    staff: [staff('priya', ['telecaller']), staff('ramesh', ['telecaller']), staff('anil', ['admission_counsellor']), staff('manager', ['admission_manager'])],
  };
}

describe('management metrics', () => {
  const P = periods('2026-09-01', NOW);

  it('builds IST periods', () => {
    expect(P.today).toMatchObject({ from: '2026-11-03', to: '2026-11-03' });
    expect(P.mtd).toMatchObject({ from: '2026-11-01', to: '2026-11-03' });
    expect(P.season.from).toBe('2026-09-01');
  });

  it('counts the funnel for today', () => {
    const m = computeMetrics(fixture(), P.today, NOW);
    const f = Object.fromEntries(m.funnel.map((x) => [x.key, x.value]));
    expect(f).toMatchObject({ leads: 4, called: 3, visits_booked: 0, visits_held: 1, confirmed: 1, fee: 0, college_id: 0 });
    expect(m.calls).toEqual({ total: 3, connected: 1, connectRate: 33 });
  });

  it('reports losses with reasons and competitors over the season', () => {
    const m = computeMetrics(fixture(), P.season, NOW);
    expect(m.losses).toMatchObject({ total: 1, afterVisit: 1, byReason: [{ reason: 'competitor', label: 'Chose a competitor', n: 1 }], competitors: [{ name: 'XYZ Academy', n: 1 }] });
  });

  it('shows the live backlog and the 48h list for the 7 PM report', () => {
    const m = computeMetrics(fixture(), P.today, NOW);
    expect(m.backlog).toMatchObject({ open: 3, unassigned: 1, unqualified: 1, escalated48: 1, visitsNeedingOutcome: 1, visitsEscalated: 1, inVerification: 1 });
    // The imported, unassigned lead is awaiting assignment — not overdue.
    expect(m.backlog.overdue).toBe(1);
    expect(m.flagged).toEqual([{ leadId: 'l1', name: 'Lead 1', owner: 'priya', overdueHours: 50, status: 'open' }]);
  });

  it('holds owners accountable', () => {
    const m = computeMetrics(fixture(), P.today, NOW);
    const priya = m.owners.find((o) => o.id === 'priya')!;
    expect(priya).toMatchObject({ openLeads: 2, calls: 2, connectRate: 50, overdue: 1, escalated48: 1, confirmed: 1 });
    expect(m.owners[0].id).toBe('priya'); // most escalations first
    expect(m.owners.map((o) => o.id)).not.toContain('manager');
  });

  it('measures data quality by source and school', () => {
    const m = computeMetrics(fixture(), P.today, NOW);
    expect(m.quality.bySource.find((r) => r.key === 'school_data')).toMatchObject({ total: 2, invalid: 1, unqualified: 1 });
    expect(m.quality.bySchool.find((r) => r.key === 'ZPHS')).toMatchObject({ total: 2, hot: 1, warm: 1 });
  });

  it('reports the 10 daily parameters of §8, in order, with definitions', () => {
    const data = fixture();
    const [a, b, c] = data.leads;
    data.audit.push(
      { id: 'a3', leadId: a.id, actorId: 'manager', action: 'assigned', field: 'owner', oldValue: null, newValue: 'priya', reason: null, at: ago(2) },
      { id: 'a4', leadId: c.id, actorId: 'manager', action: 'reassigned', field: 'owner', oldValue: 'priya', newValue: 'ramesh', reason: 'load', at: ago(2) },
      { id: 'a5', leadId: a.id, actorId: 'manager', action: 'assigned', field: 'owner', oldValue: null, newValue: 'priya', reason: null, at: ago(1) },
      { id: 'a6', leadId: b.id, actorId: 'fd', action: 'visit_arrived', field: 'visit', oldValue: null, newValue: '2026-11-03 10:00', reason: null, at: ago(7) },
      { id: 'a7', leadId: b.id, actorId: 'anil', action: 'counselled', field: 'counselling', oldValue: null, newValue: 'done', reason: null, at: ago(6) },
      { id: 'a8', leadId: c.id, actorId: 'manager', action: 'qualified', field: 'category', oldValue: null, newValue: 'warm', reason: null, at: ago(2) },
      { id: 'a9', leadId: c.id, actorId: 'ramesh', action: 'status_changed', field: 'status', oldValue: 'open', newValue: 'lost', reason: 'fees', at: ago(1) },
    );
    data.payments = [
      { leadId: b.id, amount: 50000, approvedAt: ago(1) },
      { leadId: b.id, amount: 25000, approvedAt: ago(36) }, // yesterday: in MTD, not today
    ];
    const m = computeMetrics(data, P.today, NOW);
    expect(m.daily.map((d) => d.key)).toEqual(['collected', 'allocated', 'calls', 'interested', 'visits_scheduled', 'visits_actual', 'counselled', 'confirmed', 'fees', 'lost']);
    const v = Object.fromEntries(m.daily.map((d) => [d.key, d.value]));
    // a, b, c, e created today; allocated a (twice, counted once) and c; 3 calls; interested: a (hot call) + c (warm)
    expect(v).toEqual({ collected: 4, allocated: 2, calls: 3, interested: 2, visits_scheduled: 0, visits_actual: 1, counselled: 1, confirmed: 1, fees: 50000, lost: 1 });
    expect(m.daily.find((d) => d.key === 'fees')!.money).toBe(true);
    for (const d of m.daily) expect(d.definition.length).toBeGreaterThan(20);
    expect(computeMetrics(data, P.mtd, NOW).daily.find((d) => d.key === 'fees')!.value).toBe(75000);
  });

  it('filters everything by program, source, school and owner', () => {
    const data = fixture();
    const byOwner = computeMetrics(filterData(data, { ownerId: 'ramesh' }), P.today, NOW);
    expect(byOwner.daily.find((d) => d.key === 'collected')!.value).toBe(1); // c (d was created last month)
    expect(byOwner.daily.find((d) => d.key === 'calls')!.value).toBe(1);
    const bySchool = computeMetrics(filterData(data, { school: 'zphs' }), P.today, NOW);
    expect(bySchool.daily.find((d) => d.key === 'collected')!.value).toBe(2);
    const bySource = computeMetrics(filterData(data, { source: 'school_data' }), P.today, NOW);
    expect(bySource.daily.find((d) => d.key === 'collected')!.value).toBe(2);
    expect(filterData(data, {})).toBe(data);
  });

  it('adds quality mix, no-show rate, chat leads, cost per lead and seats vs target', () => {
    const data = fixture();
    data.leads.push(lead({ firstSource: 'chat', createdAt: ago(1) }));
    data.audit.push(
      { id: 'n1', leadId: 'l1', actorId: 'fd', action: 'visit_no_show', field: 'visit', oldValue: null, newValue: 'x', reason: null, at: ago(3) },
      { id: 'n2', leadId: 'l2', actorId: 'fd', action: 'visit_arrived', field: 'visit', oldValue: null, newValue: 'x', reason: null, at: ago(3) },
    );
    data.admitted = [{ leadId: 'l2', program: 'iit-jee', collegeId: 'BJC-2027-JEE-0001' }];
    const m = computeMetrics(data, P.today, NOW, { spend: [{ source: 'school_data', month: '2026-11', amount: 10000 }, { source: 'school_data', month: '2026-10', amount: 99999 }], targets: { 'iit-jee': 120, neet: 100 } });
    expect(m.extras.quality).toEqual({ hot: 1, warm: 1, cold: 0, invalid: 1, unqualified: 2 });
    expect(m.extras.noShowRate).toBe(50);
    expect(m.extras.chatLeads).toBe(1);
    expect(m.extras.roi.find((r) => r.source === 'school_data')).toEqual({ source: 'school_data', spend: 10000, leads: 2, confirmed: 0, costPerLead: 5000, costPerAdmission: null });
    expect(m.extras.seats).toEqual([{ program: 'iit-jee', target: 120, filled: 1, pct: 1 }, { program: 'neet', target: 100, filled: 0, pct: 0 }]);
  });

  it('daily series fills empty days with zeros', () => {
    const s = dailySeries(fixture(), '2026-11-01', '2026-11-03');
    expect(s.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(s[2]).toMatchObject({ leads: 4, visits: 1, confirmed: 1 });
    expect(s[0]).toMatchObject({ leads: 0, visits: 0, confirmed: 0 });
  });

  it('renders the 7 PM report as a PDF and an email with all 10 parameters', async () => {
    const d = fixture();
    const r = { date: '2026-11-03', generatedAt: NOW.toISOString(), today: computeMetrics(d, P.today, NOW), mtd: computeMetrics(d, P.mtd, NOW), season: computeMetrics(d, P.season, NOW) };
    const pdf = await reportPdf(r);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
    const html = reportEmailHtml(r, 'https://example.org/crm/reports/2026-11-03');
    for (const p of r.today.daily) expect(html).toContain(p.label);
    expect(html).toContain('https://example.org/crm/reports/2026-11-03');
  });
});
