/** Pure CRM business rules (brief §7). No I/O — unit tested in rules.test.ts. */
import { addDays, todayIST } from '../dates';
import { CLOSED_STATUSES, type CallOutcome, type CrmLead, type LeadCategory, type LeadStatus, type LostReason, type VisitRow } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const isClosed = (status: LeadStatus) => CLOSED_STATUSES.includes(status);

export const istDate = (iso: string) => todayIST(new Date(iso));

export type FollowUpState = 'closed' | 'overdue' | 'today' | 'upcoming';

export interface FollowUpInfo {
  state: FollowUpState;
  dueAt: string | null;
  /** 0 none · 1 overdue (alert owner) · 2 overdue 24h+ (supervisor) · 3 overdue 48h+ (management report) — §7.3 */
  escalation: 0 | 1 | 2 | 3;
  overdueHours: number;
  /** days since the last contact, or since the lead arrived if never contacted */
  ageDays: number;
}

/**
 * A lead is due at its next follow-up date. A lead that has never been contacted is due the moment it
 * arrives. A contacted lead without a follow-up date (should not happen) is treated as due since that contact.
 */
export function followUp(lead: Pick<CrmLead, 'status' | 'nextFollowUpAt' | 'lastContactAt' | 'createdAt'>, now: Date = new Date()): FollowUpInfo {
  const ageDays = Math.floor((now.getTime() - new Date(lead.lastContactAt ?? lead.createdAt).getTime()) / DAY);
  if (isClosed(lead.status)) return { state: 'closed', dueAt: null, escalation: 0, overdueHours: 0, ageDays };
  const dueAt = lead.nextFollowUpAt ?? lead.lastContactAt ?? lead.createdAt;
  const overdueMs = now.getTime() - new Date(dueAt).getTime();
  if (overdueMs > 0) {
    const overdueHours = Math.floor(overdueMs / HOUR);
    const escalation = overdueMs >= 2 * DAY ? 3 : overdueMs >= DAY ? 2 : 1;
    return { state: 'overdue', dueAt, escalation, overdueHours, ageDays };
  }
  const state = istDate(dueAt) === todayIST(now) ? 'today' : 'upcoming';
  return { state, dueAt, escalation: 0, overdueHours: 0, ageDays };
}

/** Visits must have an outcome within 24h, else escalate (§7.1 step 5B). */
export function visitFlag(v: Pick<VisitRow, 'date' | 'status'>, now: Date = new Date()): 'ok' | 'needs_outcome' | 'escalated' {
  if (v.status !== 'scheduled' && v.status !== 'arrived') return 'ok';
  const today = todayIST(now);
  if (v.date >= today) return 'ok';
  return v.date < addDays(today, -1) ? 'escalated' : 'needs_outcome';
}

export interface CallInput {
  outcome: CallOutcome;
  interest: LeadCategory | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  /** close the lead as lost straight from the call ("not interested") */
  close?: 'lost' | null;
  lostReason?: LostReason | null;
  competitor?: string | null;
}

/** Call outcome is always required; next follow-up is mandatory unless the lead ends up closed (§7.1 step 4). */
export function validateCall(c: CallInput, now: Date = new Date()): string | null {
  const closes = c.outcome === 'wrong_number' || c.close === 'lost';
  if (c.close === 'lost') {
    if (c.outcome !== 'connected') return 'A lead can only be closed as lost after a connected call.';
    if (!c.lostReason) return 'A loss reason is required.';
    if (c.lostReason === 'competitor' && !c.competitor?.trim()) return 'Name the competitor the family chose.';
    return null;
  }
  if (c.outcome === 'connected' && !c.interest) return 'Record the interest level for a connected call.';
  if (!closes) {
    if (!c.nextFollowUpAt) return 'Set the next follow-up date and time.';
    const t = new Date(c.nextFollowUpAt).getTime();
    if (Number.isNaN(t)) return 'The follow-up date is not valid.';
    if (t <= now.getTime()) return 'The next follow-up must be in the future.';
    if (t > now.getTime() + 60 * DAY) return 'Follow-ups can be scheduled at most 60 days ahead.';
  }
  return null;
}

export interface DecisionInput {
  decision: 'confirmed' | 'pending' | 'lost';
  lostReason?: LostReason | null;
  competitor?: string | null;
  nextFollowUpAt?: string | null;
}

export function validateDecision(d: DecisionInput, hasOwner: boolean, now: Date = new Date()): string | null {
  if (!hasOwner) return 'Assign an owner before recording a decision.';
  if (d.decision === 'lost') {
    if (!d.lostReason) return 'A loss reason is required.';
    if (d.lostReason === 'competitor' && !d.competitor?.trim()) return 'Name the competitor the family chose.';
    return null;
  }
  if (!d.nextFollowUpAt) return d.decision === 'pending' ? 'Pending decisions need a follow-up date.' : 'Set the next follow-up (for document collection).';
  const t = new Date(d.nextFollowUpAt).getTime();
  if (Number.isNaN(t) || t <= now.getTime()) return 'The follow-up must be in the future.';
  return null;
}

/** Category implied by a call. Wrong number → invalid; otherwise the interest level recorded. */
export function categoryFromCall(c: Pick<CallInput, 'outcome' | 'interest'>, current: LeadCategory | null): LeadCategory | null {
  if (c.outcome === 'wrong_number') return 'invalid';
  return c.interest ?? current;
}

/** Balanced round-robin: each lead goes to the telecaller with the fewest open leads (ties keep list order). */
export function roundRobin(leadIds: string[], ownerIds: string[], currentLoad: Record<string, number> = {}): Record<string, string> {
  if (ownerIds.length === 0) return {};
  const load = new Map(ownerIds.map((id) => [id, currentLoad[id] ?? 0]));
  const out: Record<string, string> = {};
  for (const lead of leadIds) {
    let best = ownerIds[0];
    for (const id of ownerIds) if (load.get(id)! < load.get(best)!) best = id;
    out[lead] = best;
    load.set(best, load.get(best)! + 1);
  }
  return out;
}
