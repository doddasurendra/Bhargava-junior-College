import { describe, expect, it } from 'vitest';
import { decodeSession as decodeSessionForTest, encodeSession as encodeSessionForTest } from './session';
import { can, canSeeLead, pickActiveRole } from './permissions';
import { categoryFromCall, followUp, roundRobin, validateCall, validateDecision, visitFlag } from './rules';

const NOW = new Date('2026-11-02T06:00:00Z'); // 11:30 IST, Monday
const iso = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString();
const lead = (p: Partial<Parameters<typeof followUp>[0]> = {}) => ({
  status: 'open' as const,
  nextFollowUpAt: null,
  lastContactAt: null,
  createdAt: iso(-1),
  ownerId: null,
  assignedAt: null,
  firstSource: 'callback',
  ...p,
});

describe('follow-up queues and escalation (§7.3)', () => {
  it('a never-contacted lead is due from the moment it arrives', () => {
    const f = followUp(lead({ createdAt: iso(-3) }), NOW);
    expect(f.state).toBe('overdue');
    expect(f.escalation).toBe(1);
  });
  it('escalates at 24h and 48h overdue', () => {
    expect(followUp(lead({ nextFollowUpAt: iso(-25), lastContactAt: iso(-50) }), NOW).escalation).toBe(2);
    expect(followUp(lead({ nextFollowUpAt: iso(-49), lastContactAt: iso(-50) }), NOW).escalation).toBe(3);
  });
  it('splits today and upcoming by IST calendar day', () => {
    expect(followUp(lead({ nextFollowUpAt: iso(5), lastContactAt: iso(-2) }), NOW).state).toBe('today'); // 16:30 IST
    expect(followUp(lead({ nextFollowUpAt: iso(14), lastContactAt: iso(-2) }), NOW).state).toBe('upcoming'); // 01:30 IST next day
  });
  it('imported leads wait for assignment, then the clock starts at assignment', () => {
    const imported = { firstSource: 'school_data', createdAt: iso(-24 * 10) };
    expect(followUp(lead(imported), NOW)).toMatchObject({ state: 'awaiting', escalation: 0 });
    const assigned = followUp(lead({ ...imported, ownerId: 'priya', assignedAt: iso(-3) }), NOW);
    expect(assigned).toMatchObject({ state: 'overdue', escalation: 1, overdueHours: 3 });
    expect(followUp(lead({ ...imported, ownerId: 'priya', assignedAt: iso(-30) }), NOW).escalation).toBe(2);
    // Web enquiries keep the arrival clock even while unassigned.
    expect(followUp(lead({ createdAt: iso(-30) }), NOW).escalation).toBe(2);
  });
  it('closed leads have no follow-up', () => {
    expect(followUp(lead({ status: 'lost', nextFollowUpAt: iso(-100) }), NOW).state).toBe('closed');
  });
  it('age counts from last contact', () => {
    expect(followUp(lead({ lastContactAt: iso(-73), nextFollowUpAt: iso(2) }), NOW).ageDays).toBe(3);
  });
});

describe('call outcome rules (§7.1 step 4)', () => {
  const base = { outcome: 'not_answered' as const, interest: null, notes: null, nextFollowUpAt: iso(24) };
  it('requires a future follow-up unless the lead closes', () => {
    expect(validateCall({ ...base, nextFollowUpAt: null }, NOW)).toMatch(/follow-up/);
    expect(validateCall({ ...base, nextFollowUpAt: iso(-1) }, NOW)).toMatch(/future/);
    expect(validateCall(base, NOW)).toBeNull();
    expect(validateCall({ ...base, outcome: 'wrong_number', nextFollowUpAt: null }, NOW)).toBeNull();
  });
  it('connected calls need an interest level', () => {
    expect(validateCall({ ...base, outcome: 'connected' }, NOW)).toMatch(/interest/);
    expect(validateCall({ ...base, outcome: 'connected', interest: 'hot' }, NOW)).toBeNull();
  });
  it('closing as lost needs a reason, and a competitor name when relevant', () => {
    const lost = { ...base, outcome: 'connected' as const, nextFollowUpAt: null, close: 'lost' as const };
    expect(validateCall(lost, NOW)).toMatch(/reason/);
    expect(validateCall({ ...lost, lostReason: 'competitor' }, NOW)).toMatch(/competitor/);
    expect(validateCall({ ...lost, lostReason: 'competitor', competitor: 'XYZ College' }, NOW)).toBeNull();
    expect(validateCall({ ...lost, outcome: 'busy', lostReason: 'fees' }, NOW)).toMatch(/connected/);
  });
  it('maps calls to categories', () => {
    expect(categoryFromCall({ outcome: 'wrong_number', interest: null }, 'hot')).toBe('invalid');
    expect(categoryFromCall({ outcome: 'connected', interest: 'warm' }, 'hot')).toBe('warm');
    expect(categoryFromCall({ outcome: 'busy', interest: null }, 'cold')).toBe('cold');
  });
});

describe('decisions (§7.1 step 8)', () => {
  it('needs an owner, a loss reason, or a follow-up for pending', () => {
    expect(validateDecision({ decision: 'confirmed', nextFollowUpAt: iso(24) }, false, NOW)).toMatch(/owner/);
    expect(validateDecision({ decision: 'lost' }, true, NOW)).toMatch(/reason/);
    expect(validateDecision({ decision: 'pending' }, true, NOW)).toMatch(/follow-up/);
    expect(validateDecision({ decision: 'pending', nextFollowUpAt: iso(24) }, true, NOW)).toBeNull();
    expect(validateDecision({ decision: 'lost', lostReason: 'distance' }, true, NOW)).toBeNull();
  });
});

describe('visits need an outcome within 24h', () => {
  it('flags past visits', () => {
    expect(visitFlag({ date: '2026-11-02', status: 'scheduled' }, NOW)).toBe('ok');
    expect(visitFlag({ date: '2026-11-01', status: 'arrived' }, NOW)).toBe('needs_outcome');
    expect(visitFlag({ date: '2026-10-30', status: 'scheduled' }, NOW)).toBe('escalated');
    expect(visitFlag({ date: '2026-10-30', status: 'completed' }, NOW)).toBe('ok');
  });
});

describe('allocation', () => {
  it('round-robin balances by current load', () => {
    const plan = roundRobin(['a', 'b', 'c', 'd'], ['priya', 'ramesh', 'divya'], { priya: 2 });
    const counts = Object.values(plan).reduce<Record<string, number>>((m, o) => ({ ...m, [o]: (m[o] ?? 0) + 1 }), {});
    expect(counts).toEqual({ ramesh: 2, divya: 2 });
  });
});

describe('permissions (§7.6)', () => {
  const telecaller = { id: 't1', roles: ['telecaller' as const] };
  const manager = { id: 'm1', roles: ['admission_manager' as const] };
  it('telecallers see only their own leads', () => {
    expect(canSeeLead(telecaller, { ownerId: 't1' })).toBe(true);
    expect(canSeeLead(telecaller, { ownerId: 't2' })).toBe(false);
    expect(canSeeLead(telecaller, { ownerId: null })).toBe(false);
    expect(canSeeLead(manager, { ownerId: 't2' })).toBe(true);
  });
  it('only managers assign and qualify', () => {
    expect(can(telecaller, 'lead.assign')).toBe(false);
    expect(can(manager, 'lead.assign')).toBe(true);
    expect(can({ roles: ['front_desk'] }, 'visit.checkin')).toBe(true);
    expect(can({ roles: ['front_desk'] }, 'lead.call')).toBe(false);
  });
  it('multi-role staff work in one role at a time, defaulting to the first in the standard order, never one they lack', () => {
    expect(pickActiveRole(['accounts', 'management'], undefined)).toBe('management');
    expect(pickActiveRole(['telecaller', 'accounts'], 'accounts')).toBe('accounts');
    expect(pickActiveRole(['telecaller', 'accounts'], 'super_admin')).toBe('telecaller');
    expect(pickActiveRole(['front_desk'], 'garbage')).toBe('front_desk');
    expect(pickActiveRole([], 'telecaller')).toBeNull();
    // narrowing really narrows: as a telecaller they can't approve payments
    expect(can({ roles: [pickActiveRole(['telecaller', 'accounts'], 'telecaller')!] }, 'payment.approve')).toBe(false);
  });
});

describe('session token', () => {
  it('round-trips and rejects tampering and expiry', () => {
    const t = encodeSessionForTest('staff-priya', NOW.getTime());
    expect(decodeSessionForTest(t, NOW.getTime())).toBe('staff-priya');
    expect(decodeSessionForTest(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), NOW.getTime())).toBeNull();
    expect(decodeSessionForTest(t, NOW.getTime() + 11 * 3_600_000)).toBeNull();
    expect(decodeSessionForTest('garbage', NOW.getTime())).toBeNull();
  });
});
