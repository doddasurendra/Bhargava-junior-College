import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getAppStore } from '../app/service';
import { usingSupabase } from '../crm/repo';
import { listLeads } from '../crm/service';
import { phoneFor } from '../crm/mask';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import type { StudentRow } from '../crm/verification';
import { todayIST } from '../dates';
import { getRecordStore } from '../records';
import { aiQueryAudit, counselling, feeRequests } from '../records/collections';
import { weakChapters } from './insights';
import { studentResults } from '../school/academics';
import { duesForStudent, duesList } from '../school/accounts';
import { allBatches, batchOf, roomOf, studentsById, visibleStudentIds } from '../school/common';
import { studentFile, studentSignals } from '../school/mentoring';
import { busFor } from '../school/operations';
import { parseQuery, type Intent } from './parse';

/**
 * Staff AI assistant (§8.2). Every answer is built from tool results over the college's own records:
 * nothing is generated, so nothing can be invented. A question we can't answer from data says so.
 * Scoping is the same as the rest of the CRM (faculty see only their batches, masked phones without
 * `phone.view`), and every question is written to ai_query_audit.
 */

export const ASSISTANT_ROLES = ['super_admin', 'management', 'principal', 'admission_manager', 'admission_office', 'admin_office', 'accounts', 'academic_coordinator', 'faculty', 'class_teacher'] as const;
export const canUseAssistant = (user: Pick<Staff, 'roles'>) => user.roles.some((r) => (ASSISTANT_ROLES as readonly string[]).includes(r));
export const canSeeAudit = (user: Pick<Staff, 'roles'>) => user.roles.some((r) => r === 'super_admin' || r === 'management' || r === 'principal');

export class AssistantError extends Error {}

export type Profile = Awaited<ReturnType<typeof studentProfile>>;

export type Answer =
  | { kind: 'profile'; text: string; profile: Profile }
  | { kind: 'students'; text: string; rows: { id: string; name: string; collegeId: string | null; batch: string | null; detail: string }[] }
  | { kind: 'compare'; text: string; student: { id: string; name: string; collegeId: string | null }; tests: { title: string; date: string; score: number; max: number; pct: number; rank: number; of: number }[] }
  | { kind: 'leads'; text: string; rows: { id: string; name: string; phone: string; category: string; owner: string | null; lastContact: string | null }[] }
  | { kind: 'dues'; text: string; rows: { id: string; name: string; collegeId: string | null; overdue: number; outstanding: number }[] }
  | { kind: 'none'; text: string };

const istDate = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

async function visibleStudents(user: Staff): Promise<StudentRow[]> {
  const [byId, vis] = await Promise.all([studentsById(), visibleStudentIds(user)]);
  const all = [...byId.values()];
  return vis === 'all' ? all : all.filter((s) => vis.has(s.id));
}

/** Exact College ID first, then name matches (every word of the query must appear in the name). */
export function matchStudents<T extends Pick<StudentRow, 'fullName' | 'collegeId'>>(students: T[], q: string): T[] {
  const id = q.trim().toUpperCase();
  const exact = students.filter((s) => s.collegeId?.toUpperCase() === id);
  if (exact.length) return exact;
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return students.filter((s) => words.every((w) => s.fullName.toLowerCase().includes(w))).slice(0, 25);
}

/** The full student file for one student the user may see. */
export async function studentProfile(user: Staff, s: StudentRow) {
  const repo = getCrmRepo();
  const [batch, room, bus, results, signals, lead, verification, guardians, dues, file, sessions, concessions] = await Promise.all([
    batchOf(s.id),
    roomOf(s.id),
    busFor(s.id),
    studentResults(s.id),
    studentSignals(s.id),
    repo.getLead(s.leadId),
    repo.getVerification(s.leadId),
    getAppStore().guardiansOf(s.id),
    can(user, 'fees.dues') ? duesForStudent(s.id) : Promise.resolve(null),
    studentFile(user, s.id),
    counselling.list(getRecordStore(), { k1: s.leadId }),
    can(user, 'fees.dues') ? feeRequests.list(getRecordStore(), { k2: s.leadId }) : Promise.resolve([]),
  ]);
  const paid = verification.payments.filter((p) => p.status === 'approved');
  const pcts = results.map((r) => r.pct);
  const trend = pcts.length >= 2 ? Math.round(pcts[pcts.length - 1] - pcts[0]) : null;
  const seesFees = can(user, 'fees.dues');

  const people = [{ name: s.guardianName, relation: 'primary guardian', phone: phoneFor(user, s.guardianPhone) }];
  for (const g of guardians) if (g.phone !== s.guardianPhone) people.push({ name: g.name, relation: g.relation, phone: phoneFor(user, g.phone) });

  return {
    id: s.id,
    name: s.fullName,
    collegeId: s.collegeId,
    program: s.program,
    batch: batch?.data.name ?? null,
    section: batch?.data.section ?? null,
    dob: s.dob,
    gender: s.gender,
    stay: s.stay,
    hostelRoom: room?.data.room ?? null,
    bus: bus ? bus.data.busNo : null,
    previousSchool: lead?.school ?? null,
    board: lead?.board ?? null,
    classLevel: lead?.classLevel ?? null,
    guardians: people,
    phonesMasked: !can(user, 'phone.view'),
    attendance: { pct: signals.attendance.pct, absent: signals.attendance.absent, late: signals.attendance.late, recentAbsences: signals.attendance.absentDates.slice(-5) },
    tests: results.map((r) => ({ title: r.test.title, date: r.test.date, score: r.score, max: r.max, pct: Math.round(r.pct), rank: r.rank, of: r.of })),
    trend,
    weakChapters: weakChapters(results),
    warnings: signals.warnings,
    counsellorNotes: sessions.map((c) => ({ program: c.data.programDiscussed, decision: c.data.decision, concerns: c.data.concerns, notes: c.data.notes, scholarshipExplained: c.data.scholarshipExplained })),
    scholarship: seesFees ? concessions.filter((c) => c.data.kind === 'concession' && c.data.status === 'approved').map((c) => ({ amount: c.data.amount, percent: c.data.percentOfTuition, reason: c.data.reason })) : null,
    // Not captured by the admission form yet; shown as "not recorded" rather than guessed.
    sscMarks: null as string | null,
    email: null as string | null,
    area: lead?.area ?? null,
    fees: seesFees
      ? { paid: paid.reduce((t, p) => t + p.amount, 0), outstanding: dues?.outstanding ?? null, overdue: dues?.overdue ?? null, receipts: paid.filter((p) => p.receiptNo).map((p) => ({ no: p.receiptNo!, amount: p.amount, on: p.paidOn })) }
      : null,
    mentorNotes: file.notes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((n) => ({ date: n.date, note: n.note })),
    admission: lead ? { stage: lead.stage, status: lead.status, signOffs: verification.signOffs.map((x) => ({ stage: x.stage, at: x.at })) } : null,
  };
}

async function answer(user: Staff, intent: Intent): Promise<{ result: Answer; studentIds: string[] }> {
  switch (intent.kind) {
    case 'leads': {
      if (!can(user, 'lead.call') && !can(user, 'lead.viewAll')) return { result: { kind: 'none', text: 'Your role can’t view leads.' }, studentIds: [] };
      const today = todayIST();
      const rows = (await listLeads(user, {}))
        .filter((r) => r.lead.category === intent.category && !['lost', 'admitted', 'invalid'].includes(r.lead.status))
        .filter((r) => !intent.notCalledToday || !r.lead.lastContactAt || istDate(r.lead.lastContactAt) !== today)
        .map((r) => ({ id: r.lead.id, name: r.lead.studentName ?? r.lead.contactName ?? 'Unnamed', phone: phoneFor(user, r.lead.phone), category: r.lead.category!, owner: r.owner?.fullName ?? null, lastContact: r.lead.lastContactAt }));
      const label = `${intent.category[0].toUpperCase()}${intent.category.slice(1)} leads${intent.notCalledToday ? ' not called today' : ''}`;
      return { result: rows.length ? { kind: 'leads', text: `${rows.length} ${label}.`, rows } : { kind: 'none', text: `No ${label.toLowerCase()} found.` }, studentIds: [] };
    }
    case 'dues': {
      if (!can(user, 'fees.dues')) return { result: { kind: 'none', text: 'Your role can’t view fee dues.' }, studentIds: [] };
      const vis = await visibleStudentIds(user);
      const rows = (await duesList(user))
        .filter((d) => d.overdue > 0 && (vis === 'all' || vis.has(d.student.id)))
        .map((d) => ({ id: d.student.id, name: d.student.fullName, collegeId: d.student.collegeId, overdue: d.overdue, outstanding: d.outstanding }));
      return { result: rows.length ? { kind: 'dues', text: `${rows.length} students with overdue fees.`, rows } : { kind: 'none', text: 'No students have overdue fees.' }, studentIds: rows.map((r) => r.id) };
    }
    case 'attendance': {
      if (!can(user, 'students.view')) return { result: { kind: 'none', text: 'Your role can’t view student records.' }, studentIds: [] };
      let students = await visibleStudents(user);
      let batchNote = '';
      if (intent.batch) {
        const q = intent.batch.toLowerCase();
        const batches = (await allBatches()).filter((b) => b.data.name.toLowerCase().includes(q));
        if (!batches.length) return { result: { kind: 'none', text: `No batch matching “${intent.batch}” found.` }, studentIds: [] };
        const ids = new Set(batches.flatMap((b) => b.data.studentIds));
        students = students.filter((s) => ids.has(s.id));
        batchNote = ` in ${batches.map((b) => b.data.name).join(', ')}`;
      }
      const rows = [];
      for (const s of students) {
        const sig = await studentSignals(s.id);
        if (sig.attendance.pct !== null && sig.attendance.pct < intent.below) rows.push({ id: s.id, name: s.fullName, collegeId: s.collegeId, batch: sig.batch, detail: `${sig.attendance.pct}% attendance (30 days), ${sig.attendance.absent} absent` });
      }
      rows.sort((a, b) => parseFloat(a.detail) - parseFloat(b.detail));
      return { result: rows.length ? { kind: 'students', text: `${rows.length} students below ${intent.below}% attendance${batchNote}.`, rows } : { kind: 'none', text: `No students below ${intent.below}% attendance${batchNote}.` }, studentIds: rows.map((r) => r.id) };
    }
    case 'compare': {
      if (!can(user, 'students.view')) return { result: { kind: 'none', text: 'Your role can’t view student records.' }, studentIds: [] };
      const matches = matchStudents(await visibleStudents(user), intent.who);
      if (matches.length !== 1) return { result: matches.length ? await listOf(matches, `${matches.length} students match “${intent.who}”. Use the College ID.`) : { kind: 'none', text: `No student matching “${intent.who}” found.` }, studentIds: matches.map((m) => m.id) };
      const s = matches[0];
      const tests = (await studentResults(s.id)).slice(-intent.count).map((r) => ({ title: r.test.title, date: r.test.date, score: r.score, max: r.max, pct: Math.round(r.pct), rank: r.rank, of: r.of }));
      if (!tests.length) return { result: { kind: 'none', text: `${s.fullName} has no published test results.` }, studentIds: [s.id] };
      const change = tests.length >= 2 ? tests[tests.length - 1].pct - tests[0].pct : 0;
      const text = `${s.fullName}: last ${tests.length} test${tests.length > 1 ? 's' : ''}${tests.length >= 2 ? `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)} points from the first to the latest` : ''}.`;
      return { result: { kind: 'compare', text, student: { id: s.id, name: s.fullName, collegeId: s.collegeId }, tests }, studentIds: [s.id] };
    }
    case 'lookup': {
      if (!can(user, 'students.view')) return { result: { kind: 'none', text: 'Your role can’t view student records.' }, studentIds: [] };
      const matches = matchStudents(await visibleStudents(user), intent.q);
      if (!matches.length) return { result: { kind: 'none', text: `Not found: no student matching “${intent.q}” that you can see.` }, studentIds: [] };
      if (matches.length > 1) return { result: await listOf(matches, `${matches.length} students match “${intent.q}”.`), studentIds: matches.map((m) => m.id) };
      const profile = await studentProfile(user, matches[0]);
      return { result: { kind: 'profile', text: `${profile.name} · ${profile.collegeId ?? 'no College ID'}`, profile }, studentIds: [profile.id] };
    }
  }
}

async function listOf(students: StudentRow[], text: string): Promise<Answer> {
  const rows = await Promise.all(students.map(async (s) => ({ id: s.id, name: s.fullName, collegeId: s.collegeId, batch: (await batchOf(s.id))?.data.name ?? null, detail: s.program })));
  return { kind: 'students', text, rows };
}

export async function ask(user: Staff, question: string): Promise<Answer> {
  if (!canUseAssistant(user)) throw new AssistantError('Your role can’t use the college assistant.');
  const q = question.trim().slice(0, 500);
  if (!q) return { kind: 'none', text: 'Type a College ID, a student name or a question.' };
  const intent = parseQuery(q);
  const { result, studentIds } = await answer(user, intent);
  const entry = {
    actorId: user.id,
    role: user.roles[0] ?? 'staff',
    query: q,
    intent: intent.kind,
    resultCount: result.kind === 'none' ? 0 : result.kind === 'profile' || result.kind === 'compare' ? 1 : result.rows.length,
    studentIds: studentIds.slice(0, 200),
    at: new Date().toISOString(),
  };
  await aiQueryAudit.put(getRecordStore(), entry);
  // With Supabase connected, also write the dedicated ai_query_audit table (RLS: heads read, server writes).
  if (usingSupabase()) {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { error } = await sb.from('ai_query_audit').insert({ actor_id: entry.actorId, role: entry.role, query: entry.query, intent: entry.intent, result_count: entry.resultCount, student_ids: entry.studentIds, at: entry.at });
    if (error) console.error('[assistant] ai_query_audit insert failed', error.message);
  }
  return result;
}

export async function recentQueries(user: Staff, limit = 30) {
  if (!canSeeAudit(user)) return [];
  const rows = await aiQueryAudit.list(getRecordStore());
  return rows.map((r) => r.data).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
