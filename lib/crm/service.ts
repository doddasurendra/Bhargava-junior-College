import 'server-only';
import { STAGES, type StageKey } from '../admission';
import { addDays, todayIST } from '../dates';
import { can, canSeeLead, isCounsellor } from './permissions';
import { getCrmRepo } from './repo';
import { categoryFromCall, followUp, roundRobin, validateCall, validateDecision, visitFlag, type CallInput, type DecisionInput, type FollowUpInfo } from './rules';
import { PROGRAM_SLUGS } from '@/content/programs';
import { parseCsv } from './csv';
import { buildRecords, IMPORT_SOURCES, MAX_IMPORT_ROWS, validateMapping, type ImportDefaults, type ImportRecord, type ImportSource, type Mapping, type RejectedRow } from './importer';
import type { AuditInput, CrmLead, LeadCategory, LeadFilter, LeadPatch, Staff, VisitRow } from './types';

export class CrmError extends Error {}

export type Queue = 'all' | 'overdue' | 'today' | 'upcoming' | 'unassigned' | 'escalated';

export interface LeadRow {
  lead: CrmLead;
  owner: Staff | null;
  follow: FollowUpInfo;
}

const stageIndex = (s: StageKey) => STAGES.findIndex((x) => x.key === s);
/** Stages only move forward. */
const advanceStage = (current: StageKey, to: StageKey): StageKey => (stageIndex(to) > stageIndex(current) ? to : current);

async function staffMap() {
  const staff = await getCrmRepo().listStaff();
  return new Map(staff.map((s) => [s.id, s]));
}

async function visibleLead(user: Staff, id: string): Promise<CrmLead> {
  const lead = await getCrmRepo().getLead(id);
  if (!lead || !canSeeLead(user, lead)) throw new CrmError('Lead not found.');
  return lead;
}

function scoped(user: Staff, filter: LeadFilter): LeadFilter {
  return can(user, 'lead.viewAll') ? filter : { ...filter, ownerId: user.id, unassigned: false };
}

export async function listLeads(user: Staff, filter: LeadFilter, queue: Queue = 'all', now = new Date()): Promise<LeadRow[]> {
  const f = scoped(user, queue === 'unassigned' ? { ...filter, unassigned: true } : filter);
  const [leads, staff] = await Promise.all([getCrmRepo().listLeads(f), staffMap()]);
  const rows = leads.map((lead) => ({ lead, owner: lead.ownerId ? staff.get(lead.ownerId) ?? null : null, follow: followUp(lead, now) }));
  const byQueue = rows.filter((r) => {
    switch (queue) {
      case 'overdue':
        return r.follow.state === 'overdue';
      case 'escalated':
        return r.follow.escalation >= 2;
      case 'today':
        return r.follow.state === 'today';
      case 'upcoming':
        return r.follow.state === 'upcoming';
      default:
        return true;
    }
  });
  if (queue === 'all' || queue === 'unassigned') return byQueue;
  // Work queues: most urgent first.
  return byQueue.sort((a, b) => (a.follow.dueAt ?? '').localeCompare(b.follow.dueAt ?? ''));
}

export async function leadDetail(user: Staff, id: string) {
  const lead = await visibleLead(user, id);
  const [history, staff] = await Promise.all([getCrmRepo().getLeadHistory(id), staffMap()]);
  return { lead, history, staff, owner: lead.ownerId ? staff.get(lead.ownerId) ?? null : null, follow: followUp(lead) };
}

export async function qualifyLead(user: Staff, id: string, category: LeadCategory) {
  if (!can(user, 'lead.qualify')) throw new CrmError('Only the admission manager can qualify leads.');
  const lead = await visibleLead(user, id);
  if (lead.category === category) return;
  const patch: LeadPatch = { category };
  if (category === 'invalid') {
    patch.status = 'invalid';
    patch.nextFollowUpAt = null;
  } else if (lead.status === 'invalid') {
    patch.status = 'open';
  }
  await getCrmRepo().updateLead(id, patch, [{ action: 'qualified', actorId: user.id, field: 'category', oldValue: lead.category, newValue: category }]);
}

/** Exactly one current owner per lead; reassignment needs a reason (§7.1 step 3). */
export async function assignLeads(user: Staff, ids: string[], target: string | 'round_robin', reason: string | null) {
  if (!can(user, 'lead.assign')) throw new CrmError('Only the admission manager can assign leads.');
  if (ids.length === 0) throw new CrmError('Select at least one lead.');
  const repo = getCrmRepo();
  const [leads, staff] = await Promise.all([repo.listLeads({ ids }), repo.listStaff()]);

  let plan: Record<string, string>;
  if (target === 'round_robin') {
    const telecallers = staff.filter((s) => s.roles.includes('telecaller')).map((s) => s.id);
    if (telecallers.length === 0) throw new CrmError('There are no active telecallers.');
    const open = await repo.listLeads({});
    const load: Record<string, number> = {};
    for (const l of open) if (l.ownerId && followUp(l).state !== 'closed') load[l.ownerId] = (load[l.ownerId] ?? 0) + 1;
    plan = roundRobin(
      leads.filter((l) => !l.ownerId).map((l) => l.id),
      telecallers,
      load,
    );
    if (Object.keys(plan).length === 0) throw new CrmError('Round-robin only assigns unassigned leads. Pick an owner to reassign.');
  } else {
    const owner = staff.find((s) => s.id === target);
    if (!owner || !can(owner, 'lead.call')) throw new CrmError('Choose a telecaller, counsellor or manager as owner.');
    plan = Object.fromEntries(leads.map((l) => [l.id, target]));
  }

  const reassigning = leads.some((l) => l.ownerId && plan[l.id] && l.ownerId !== plan[l.id]);
  if (reassigning && !reason?.trim()) throw new CrmError('A reason is required when reassigning leads that already have an owner.');

  let count = 0;
  for (const l of leads) {
    const to = plan[l.id];
    if (!to || to === l.ownerId) continue;
    await repo.updateLead(l.id, { ownerId: to, assignedAt: new Date().toISOString() }, [{ action: l.ownerId ? 'reassigned' : 'assigned', actorId: user.id, field: 'owner', oldValue: l.ownerId, newValue: to, reason: reason?.trim() || null }]);
    count++;
  }
  return count;
}

export async function bulkCategory(user: Staff, ids: string[], category: LeadCategory) {
  if (!can(user, 'lead.qualify')) throw new CrmError('Only the admission manager can change categories.');
  for (const id of ids) await qualifyLead(user, id, category);
  return ids.length;
}

export async function logCall(user: Staff, id: string, input: CallInput, now = new Date()) {
  if (!can(user, 'lead.call')) throw new CrmError('You cannot log calls.');
  const lead = await visibleLead(user, id);
  if (!lead.ownerId) throw new CrmError('Assign an owner before logging calls.');
  const err = validateCall(input, now);
  if (err) throw new CrmError(err);

  const repo = getCrmRepo();
  const closing = input.outcome === 'wrong_number' || input.close === 'lost';
  await repo.addCall({ leadId: id, actorId: user.id, outcome: input.outcome, interest: input.interest, notes: input.notes, nextFollowUpAt: closing ? null : input.nextFollowUpAt });

  const category = categoryFromCall(input, lead.category);
  const patch: LeadPatch = { lastContactAt: now.toISOString(), nextFollowUpAt: closing ? null : input.nextFollowUpAt, category };
  const audit: AuditInput[] = [{ action: 'call_logged', actorId: user.id, field: 'outcome', newValue: input.outcome }];
  if (category !== lead.category) audit.push({ action: 'qualified', actorId: user.id, field: 'category', oldValue: lead.category, newValue: category });
  if (input.outcome === 'wrong_number') {
    patch.status = 'invalid';
    audit.push({ action: 'status_changed', actorId: user.id, field: 'status', oldValue: lead.status, newValue: 'invalid', reason: 'wrong number' });
  } else if (input.close === 'lost') {
    patch.status = 'lost';
    patch.lostReason = input.lostReason ?? null;
    patch.lostCompetitor = input.lostReason === 'competitor' ? input.competitor?.trim() ?? null : null;
    audit.push({ action: 'status_changed', actorId: user.id, field: 'status', oldValue: lead.status, newValue: 'lost', reason: [input.lostReason, patch.lostCompetitor].filter(Boolean).join(': ') });
  }
  if (input.nextFollowUpAt && !closing) audit.push({ action: 'follow_up_set', actorId: user.id, field: 'next_follow_up_at', oldValue: lead.nextFollowUpAt, newValue: input.nextFollowUpAt });
  await repo.updateLead(id, patch, audit);
}

export async function recordDecision(user: Staff, id: string, d: DecisionInput, now = new Date()) {
  if (!can(user, 'lead.decide')) throw new CrmError('Only admission counsellors and managers record decisions.');
  const lead = await visibleLead(user, id);
  const err = validateDecision(d, Boolean(lead.ownerId), now);
  if (err) throw new CrmError(err);

  const status = d.decision === 'confirmed' ? 'confirmed' : d.decision === 'pending' ? 'decision_pending' : 'lost';
  const patch: LeadPatch = {
    status,
    nextFollowUpAt: d.decision === 'lost' ? null : d.nextFollowUpAt ?? null,
    lostReason: d.decision === 'lost' ? d.lostReason ?? null : null,
    lostCompetitor: d.decision === 'lost' && d.lostReason === 'competitor' ? d.competitor?.trim() ?? null : null,
  };
  if (d.decision === 'confirmed') patch.stage = advanceStage(lead.stage, 'counselling');
  const audit: AuditInput[] = [
    { action: 'decision', actorId: user.id, field: 'status', oldValue: lead.status, newValue: status, reason: d.decision === 'lost' ? [d.lostReason, patch.lostCompetitor].filter(Boolean).join(': ') : null },
  ];
  // §7.2: a pending post-visit decision is owned by the admission counsellor following it up.
  if (d.decision === 'pending' && isCounsellor(user) && lead.ownerId !== user.id) {
    patch.ownerId = user.id;
    patch.assignedAt = now.toISOString();
    audit.push({ action: 'reassigned', actorId: user.id, field: 'owner', oldValue: lead.ownerId, newValue: user.id, reason: 'Post-visit follow-up by admission counsellor' });
  }
  await getCrmRepo().updateLead(id, patch, audit);
}

async function visibleVisit(user: Staff, visitId: string) {
  const repo = getCrmRepo();
  const visit = await repo.getVisit(visitId);
  if (!visit) throw new CrmError('Visit not found.');
  const lead = await visibleLead(user, visit.leadId);
  return { visit, lead };
}

export async function checkInVisit(user: Staff, visitId: string, status: 'arrived' | 'no_show') {
  if (!can(user, 'visit.checkin')) throw new CrmError('You cannot check in visits.');
  const { visit } = await visibleVisit(user, visitId);
  if (visit.status !== 'scheduled') throw new CrmError('This visit has already been marked.');
  if (visit.date > todayIST()) throw new CrmError('You can only mark a visit on or after its date.');
  await getCrmRepo().updateVisit(visitId, { status }, [{ action: status === 'arrived' ? 'visit_arrived' : 'visit_no_show', actorId: user.id, field: 'visit', newValue: `${visit.date} ${visit.slot}` }]);
}

export async function recordVisitOutcome(user: Staff, visitId: string, outcome: string, counselled: boolean) {
  if (!can(user, 'visit.outcome')) throw new CrmError('You cannot record visit outcomes.');
  const { visit, lead } = await visibleVisit(user, visitId);
  if (visit.status !== 'arrived') throw new CrmError('Mark the family as arrived before recording the outcome.');
  if (outcome.trim().length < 5) throw new CrmError('Describe the outcome of the visit.');
  const repo = getCrmRepo();
  const nowIso = new Date().toISOString();
  await repo.updateVisit(visitId, { status: 'completed', outcome: outcome.trim(), outcomeAt: nowIso, outcomeBy: user.id }, [{ action: 'visit_completed', actorId: user.id, field: 'visit', newValue: outcome.trim() }]);
  const status = counselled ? 'counselled' : 'visited';
  const stage = advanceStage(lead.stage, counselled ? 'counselling' : 'visit');
  const keep = ['decision_pending', 'confirmed', 'lost', 'admitted', 'invalid'].includes(lead.status);
  await repo.updateLead(lead.id, keep ? { stage } : { status, stage }, [{ action: 'stage_changed', actorId: user.id, field: 'stage', oldValue: lead.stage, newValue: stage }]);
}

export interface VisitBoardRow {
  visit: VisitRow;
  lead: CrmLead | null;
  owner: Staff | null;
  flag: ReturnType<typeof visitFlag>;
}

export async function visitBoard(user: Staff, from: string, to: string, includeOverdue = true): Promise<VisitBoardRow[]> {
  if (!can(user, 'visit.view')) throw new CrmError('You cannot view visits.');
  const repo = getCrmRepo();
  const [inRange, overdue] = await Promise.all([
    repo.listVisits({ from, to }),
    includeOverdue ? repo.listVisits({ to: addDays(todayIST(), -1), statuses: ['scheduled', 'arrived'] }) : Promise.resolve([]),
  ]);
  const visits = [...overdue, ...inRange.filter((v) => !overdue.some((o) => o.id === v.id))];
  const ids = Array.from(new Set(visits.map((v) => v.leadId)));
  const [leads, staff] = await Promise.all([ids.length ? repo.listLeads({ ids }) : Promise.resolve([]), staffMap()]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  return visits
    .map((visit) => {
      const lead = leadById.get(visit.leadId) ?? null;
      return { visit, lead, owner: lead?.ownerId ? staff.get(lead.ownerId) ?? null : null, flag: visitFlag(visit) };
    })
    .filter((r) => r.lead && canSeeLead(user, r.lead));
}

// ---------------------------------------------------------------- families (siblings)

export async function family(user: Staff, leadId: string) {
  const lead = await visibleLead(user, leadId);
  const members = await getCrmRepo().familyOf(lead.id);
  // Siblings owned by a colleague are listed (so nobody double-calls the family) but not linked.
  return members.map((m) => ({ lead: m, visible: canSeeLead(user, m), isCurrent: m.id === lead.id }));
}

/** "Add another child": a sibling's own lead in the same family (same parent phone, owner and consent). */
export async function addSibling(user: Staff, leadId: string, s: { studentName: string; classLevel: string | null; program: string | null; school: string | null }) {
  if (!can(user, 'lead.call')) throw new CrmError('You cannot add children to a family.');
  const lead = await visibleLead(user, leadId);
  const name = s.studentName.trim();
  if (name.length < 2) throw new CrmError('Enter the child’s name.');
  const members = await getCrmRepo().familyOf(lead.id);
  if (members.some((m) => (m.studentName ?? '').trim().toLowerCase() === name.toLowerCase())) throw new CrmError(`${name} is already in this family.`);
  if (members.length >= 6) throw new CrmError('A family can have at most 6 children here. Contact the admin office.');
  if (s.program && !(PROGRAM_SLUGS as readonly string[]).includes(s.program)) throw new CrmError('Choose a valid program.');
  return getCrmRepo().createSibling(lead.id, { studentName: name.slice(0, 80), classLevel: s.classLevel?.slice(0, 40) || null, program: s.program || null, school: s.school?.trim().slice(0, 120) || null }, user.id);
}

// ---------------------------------------------------------------- import (§7.1 step 1)

export interface ImportRequest {
  fileName: string;
  text: string;
  mapping: Mapping;
  source: ImportSource;
  defaults: ImportDefaults;
}

export interface ImportPreview {
  totalRows: number;
  valid: number;
  newLeads: number;
  mergeExisting: number;
  duplicatesInFile: number;
  rejected: RejectedRow[];
  sample: (ImportRecord & { existing: boolean })[];
  bySchool: { school: string; rows: number; existing: number }[];
}

function prepareImport(req: ImportRequest) {
  if (!IMPORT_SOURCES.some((s) => s.value === req.source)) throw new CrmError('Choose where this data came from.');
  if (req.text.length > 3_000_000) throw new CrmError('The file is too large. Split it into files under 2 MB.');
  const { headers, rows } = parseCsv(req.text);
  if (headers.length === 0) throw new CrmError('The file is empty.');
  if (rows.length === 0) throw new CrmError('The file has a header row but no data rows.');
  if (rows.length > MAX_IMPORT_ROWS) throw new CrmError(`At most ${MAX_IMPORT_ROWS} rows per import. This file has ${rows.length}.`);
  const mappingError = validateMapping(req.mapping, headers.length);
  if (mappingError) throw new CrmError(mappingError);
  return buildRecords(rows, req.mapping, req.defaults);
}

async function existingFor(records: ImportRecord[]) {
  const phones = records.flatMap((r) => (r.studentPhone ? [r.phone, r.studentPhone] : [r.phone]));
  const found = await getCrmRepo().findExistingPhones(phones);
  return (r: ImportRecord) => found.has(r.phone) || (r.studentPhone !== null && found.has(r.studentPhone));
}

export async function previewImport(user: Staff, req: ImportRequest): Promise<ImportPreview> {
  if (!can(user, 'lead.import')) throw new CrmError('You cannot import leads.');
  const built = prepareImport(req);
  const isExisting = await existingFor(built.records);
  const schools = new Map<string, { rows: number; existing: number }>();
  let mergeExisting = 0;
  for (const r of built.records) {
    const ex = isExisting(r);
    if (ex) mergeExisting++;
    const key = r.school ?? '(no school)';
    const s = schools.get(key) ?? { rows: 0, existing: 0 };
    s.rows++;
    if (ex) s.existing++;
    schools.set(key, s);
  }
  return {
    totalRows: built.totalRows,
    valid: built.records.length,
    newLeads: built.records.length - mergeExisting,
    mergeExisting,
    duplicatesInFile: built.duplicatesInFile,
    rejected: built.rejected.slice(0, 2000),
    sample: built.records.slice(0, 15).map((r) => ({ ...r, existing: isExisting(r) })),
    bySchool: Array.from(schools, ([school, v]) => ({ school, ...v })).sort((a, b) => b.rows - a.rows).slice(0, 30),
  };
}

export async function runImport(user: Staff, req: ImportRequest) {
  if (!can(user, 'lead.import')) throw new CrmError('You cannot import leads.');
  // Re-parse and re-validate on the server; the browser preview is never trusted.
  const built = prepareImport(req);
  if (built.records.length === 0) throw new CrmError('No valid rows to import.');
  const fileName = req.fileName.replace(/[^\w.\- ]/g, '').slice(0, 120) || 'upload.csv';
  const result = await getCrmRepo().importLeads(built.records, {
    fileName,
    source: req.source,
    actorId: user.id,
    totalRows: built.totalRows,
    invalid: built.rejected.length,
    duplicatesInFile: built.duplicatesInFile,
  });
  return { ...result, invalid: built.rejected.length, duplicatesInFile: built.duplicatesInFile };
}

export async function importHistory(user: Staff) {
  if (!can(user, 'lead.import')) throw new CrmError('You cannot view imports.');
  const [batches, staff] = await Promise.all([getCrmRepo().listImportBatches(20), staffMap()]);
  return batches.map((b) => ({ ...b, actorName: staff.get(b.actorId)?.fullName ?? 'Staff' }));
}

export async function dashboard(user: Staff) {
  const rows = await listLeads(user, {});
  const open = rows.filter((r) => r.follow.state !== 'closed');
  const today = todayIST();
  const visits = can(user, 'visit.view') ? await visitBoard(user, today, today) : [];
  return {
    overdue: open.filter((r) => r.follow.state === 'overdue').sort((a, b) => (a.follow.dueAt ?? '').localeCompare(b.follow.dueAt ?? '')),
    today: open.filter((r) => r.follow.state === 'today').sort((a, b) => (a.follow.dueAt ?? '').localeCompare(b.follow.dueAt ?? '')),
    upcoming: open.filter((r) => r.follow.state === 'upcoming').length,
    escalated: open.filter((r) => r.follow.escalation >= 2).length,
    management: open.filter((r) => r.follow.escalation === 3).length,
    unassigned: can(user, 'lead.assign') ? open.filter((r) => !r.lead.ownerId).length : 0,
    unqualified: can(user, 'lead.qualify') ? open.filter((r) => !r.lead.category).length : 0,
    visitsToday: visits.filter((v) => v.visit.date === today),
    visitsNeedingOutcome: visits.filter((v) => v.flag !== 'ok'),
    total: rows.length,
  };
}
