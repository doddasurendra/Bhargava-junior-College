import { describe, expect, it } from 'vitest';
import { computeMetrics, dailySeries, periods, type MetricsData } from './metrics';
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

  it('daily series fills empty days with zeros', () => {
    const s = dailySeries(fixture(), '2026-11-01', '2026-11-03');
    expect(s.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(s[2]).toMatchObject({ leads: 4, visits: 1, confirmed: 1 });
    expect(s[0]).toMatchObject({ leads: 0, visits: 0, confirmed: 0 });
  });
});
