import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { college } from '@/content/college';
import { revokeAll } from '../auth/sessions';
import { can } from '../crm/permissions';
import { getCrmRepo, usingSupabase } from '../crm/repo';
import type { Staff } from '../crm/types';
import { getRecordStore } from '../records';
import { pendingSignups, studentAuthAudit, studentCredentials, studentFlags } from '../records/collections';
import type { StudentRow } from '../crm/verification';
import { sendTemplate } from '../whatsapp/service';
import { getAppStore } from './service';
import { nameSimilarity, NAME_MATCH, normCollegeId, normDob, StudentAccountError } from './studentAccount';

/**
 * Admin Office tools for student self-sign-ups (master prompt task 2.7): pending list with suggested matches,
 * conflicts side by side, verify & link, create as new, merge, reject, message, test data. Every action checks
 * the permission here on the server and is written to student_auth_audit.
 */
const st = () => getRecordStore();
const now = () => new Date().toISOString();

export const canManageSignups = (u: Staff) => can(u, 'guardians.manage') && !u.viewedBy;
const need = (u: Staff) => {
  if (!canManageSignups(u)) throw new StudentAccountError('Only the admin office can manage student sign-ups.');
};
const isSuper = (u: Staff) => u.roles.includes('super_admin') && !u.viewedBy;

async function audit(action: 'office_link' | 'office_create' | 'office_merge' | 'office_reject' | 'office_message' | 'office_test' | 'office_delete_test' | 'office_import', outcome: string, collegeId: string | null, actor: string) {
  await studentAuthAudit.put(st(), { at: now(), action, outcome: outcome.slice(0, 40), collegeId, ip: null, actor }).catch((e) => console.error('[pending-admin] audit failed', e));
}

async function credOfPending(pendingId: string) {
  const p = await pendingSignups.get(st(), pendingId);
  if (!p) throw new StudentAccountError('Sign-up not found.');
  const cred = (await studentCredentials.list(st(), { k1: p.data.collegeId })).find((c) => c.data.pendingId === pendingId) ?? null;
  return { p, cred };
}

/** Real students marked as test data (kept out of reports and dashboards). */
export async function testStudentIds() {
  return new Set((await studentFlags.list(st())).filter((f) => f.data.isTest).map((f) => f.data.studentId));
}

function suggest(p: { fullName: string; dob: string; collegeId: string }, students: StudentRow[]) {
  return students
    .map((s) => {
      const sim = nameSimilarity(p.fullName, s.fullName);
      const score = (s.collegeId === p.collegeId ? 2 : 0) + (s.dob === p.dob ? 1 : 0) + sim;
      return { id: s.id, fullName: s.fullName, collegeId: s.collegeId, dob: s.dob, program: s.program, similarity: sim, score };
    })
    .filter((x) => x.score >= 1.6 || x.similarity >= 0.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Pending sign-ups and conflicts. Conflict details (the college record) are for the admin office only. */
export async function signupQueue(u: Staff) {
  need(u);
  const [pend, students, creds] = await Promise.all([pendingSignups.list(st()), getAppStore().listStudents(), studentCredentials.list(st())]);
  const byId = new Map(students.map((s) => [s.id, s]));
  const accountFor = new Set(creds.filter((c) => !c.data.studentId.startsWith('pending-') && c.data.status === 'active').map((c) => c.data.studentId));
  const rows = pend.map((r) => ({ id: r.id, ...r.data, suggestions: r.data.status === 'pending' ? suggest(r.data, students) : [], conflict: r.data.conflictStudentId ? byId.get(r.data.conflictStudentId) ?? null : null, conflictHasAccount: r.data.conflictStudentId ? accountFor.has(r.data.conflictStudentId) : false }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    pending: rows.filter((r) => r.status === 'pending'),
    conflicts: rows.filter((r) => r.status === 'pending' && (r.case === 'C' || r.case === 'E')),
    recent: rows.filter((r) => r.status !== 'pending').slice(0, 30),
    testCount: rows.filter((r) => r.isTest).length,
  };
}

/** Moves the pending account onto the real student record and activates it. Notifies the student (in-app) and parents. */
async function linkTo(u: Staff, pendingId: string, studentId: string, resolution: 'linked' | 'created' | 'merged' | 'imported', opts: { replaceExisting?: boolean } = {}) {
  const { p, cred } = await credOfPending(pendingId);
  if (p.data.status !== 'pending') throw new StudentAccountError('This sign-up was already handled.');
  const s = await getAppStore().getStudent(studentId);
  if (!s?.collegeId) throw new StudentAccountError('That student has no College ID yet.');
  const existing = (await studentCredentials.list(st(), { k1: s.collegeId })).filter((c) => c.data.studentId === s.id && c.id !== cred?.id);
  if (existing.length && !opts.replaceExisting) throw new StudentAccountError('This student already has an account. Use Merge to replace it with this sign-up.');
  for (const old of existing) {
    // merge: the older account stops working (kept for the audit trail, never deleted here)
    await studentCredentials.put(st(), { ...old.data, status: 'disabled', statusBy: u.fullName, statusAt: now() }, old.id);
    await revokeAll(st(), 'app', `cid:${s.collegeId}`, `merged into sign-up ${p.data.tempId} by ${u.fullName}`);
  }
  if (cred) await studentCredentials.put(st(), { ...cred.data, collegeId: s.collegeId, studentId: s.id, status: 'active', statusBy: u.fullName, statusAt: now() }, cred.id);
  const note = { at: now(), by: 'Admin office', text: `Your account is verified and linked to your college record (${s.collegeId}). Your class, marks and attendance now appear in the app.` };
  await pendingSignups.put(st(), { ...p.data, status: 'linked', linkedStudentId: s.id, resolution, decidedBy: u.fullName, decidedAt: now(), messages: [...p.data.messages, note].slice(-50) }, p.id);
  await audit(resolution === 'merged' ? 'office_merge' : resolution === 'created' ? 'office_create' : 'office_link', `${resolution}:${p.data.tempId}`, s.collegeId, u.fullName);
  for (const g of await getAppStore().guardiansOf(s.id)) {
    await sendTemplate({ template: 'student_account_created', to: g.phone, params: [s.fullName, s.collegeId, college.phones[0].display], dedupeKey: `student-account:${s.collegeId}:${g.phone}:${p.id}` }).catch((e) => console.error('[pending-admin] parent message failed', (e as Error).message));
  }
  return s;
}

export async function verifyAndLink(u: Staff, pendingId: string, studentId: string) {
  need(u);
  return linkTo(u, pendingId, studentId, 'linked');
}

export async function mergeSignup(u: Staff, pendingId: string, studentId: string) {
  need(u);
  return linkTo(u, pendingId, studentId, 'merged', { replaceExisting: true });
}

export interface NewStudentInput { fullName: string; collegeId: string; dob: string; gender: string; program: string; stay: string; guardianName: string; guardianPhone: string; relation?: string }

export function validateNewStudent(i: Record<string, string | undefined>): NewStudentInput {
  const collegeId = normCollegeId(i.collegeId ?? '');
  const dob = normDob(i.dob ?? '');
  const phoneDigits = (i.guardianPhone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const fullName = (i.fullName ?? '').trim().replace(/\s+/g, ' ');
  if (fullName.length < 2 || fullName.length > 80) throw new StudentAccountError('Enter the student’s full name.');
  if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(collegeId)) throw new StudentAccountError('Enter a valid College ID.');
  if (!dob) throw new StudentAccountError('Enter a valid date of birth (YYYY-MM-DD or DD/MM/YYYY).');
  if (!['female', 'male', 'other'].includes(i.gender ?? '')) throw new StudentAccountError('Choose the gender.');
  if (!['iit-jee', 'neet', 'long-term-jee', 'long-term-neet'].includes(i.program ?? '')) throw new StudentAccountError('Choose the program.');
  if (!['day', 'hostel'].includes(i.stay ?? '')) throw new StudentAccountError('Choose day scholar or hostel.');
  if ((i.guardianName ?? '').trim().length < 2) throw new StudentAccountError('Enter the parent / guardian name.');
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) throw new StudentAccountError('Enter the parent’s 10-digit mobile number.');
  return { fullName, collegeId, dob, gender: i.gender!, program: i.program!, stay: i.stay!, guardianName: i.guardianName!.trim(), guardianPhone: `+91${phoneDigits}`, relation: i.relation?.trim() || 'parent' };
}

/** Add Student (form or import row) — then link any pending sign-up that matches it exactly. */
export async function addStudent(u: Staff, input: NewStudentInput) {
  need(u);
  const s = await getAppStore().studentByCollegeId(input.collegeId);
  if (s) throw new StudentAccountError('A student with this College ID already exists.');
  let id: string;
  try {
    id = await getCrmRepo().officeAddStudent(input, u.id);
  } catch (e) {
    if (/college_id_exists/.test((e as Error).message)) throw new StudentAccountError('A student with this College ID already exists.');
    throw e;
  }
  const linked = await autoLinkPending(u, id, input);
  return { studentId: id, ...linked };
}

/** Pending sign-ups for this College ID: exact matches are linked (and activated), the rest become conflicts. */
async function autoLinkPending(u: Staff, studentId: string, s: { fullName: string; dob: string; collegeId: string }) {
  let linked = 0, conflicts = 0;
  const pend = (await pendingSignups.list(st(), { k1: s.collegeId })).filter((p) => p.data.status === 'pending');
  for (const p of pend) {
    if (!linked && p.data.dob === s.dob && nameSimilarity(p.data.fullName, s.fullName) >= NAME_MATCH) {
      await linkTo(u, p.id, studentId, 'imported');
      linked++;
    } else {
      await pendingSignups.put(st(), { ...p.data, case: 'C', conflictType: 'record_mismatch', conflictStudentId: studentId }, p.id);
      conflicts++;
    }
  }
  return { linked, conflicts };
}

/** Create as new: adds the student with the sign-up's details (and the office's program / parent details), then links. */
export async function createFromSignup(u: Staff, pendingId: string, extra: Record<string, string | undefined>) {
  need(u);
  const { p } = await credOfPending(pendingId);
  if (p.data.status !== 'pending') throw new StudentAccountError('This sign-up was already handled.');
  const input = validateNewStudent({ ...extra, fullName: extra.fullName || p.data.fullName, collegeId: extra.collegeId || p.data.collegeId, dob: extra.dob || p.data.dob });
  if (await getAppStore().studentByCollegeId(input.collegeId)) throw new StudentAccountError('That College ID already belongs to a student. Use Verify & Link or Merge, or enter another College ID.');
  const id = await getCrmRepo().officeAddStudent(input, u.id);
  await linkTo(u, pendingId, id, 'created');
  return id;
}

export async function rejectSignup(u: Staff, pendingId: string, reason: string) {
  need(u);
  const { p, cred } = await credOfPending(pendingId);
  if (p.data.status !== 'pending') throw new StudentAccountError('This sign-up was already handled.');
  if (cred) {
    await studentCredentials.put(st(), { ...cred.data, status: 'disabled', statusBy: u.fullName, statusAt: now() }, cred.id);
    await banAuth(cred.data.authUserId, true);
  }
  await revokeAll(st(), 'app', `pend:${p.id}`, `sign-up rejected by ${u.fullName}`);
  await pendingSignups.put(st(), { ...p.data, status: 'rejected', resolution: 'rejected', decidedBy: u.fullName, decidedAt: now(), messages: [...p.data.messages, { at: now(), by: 'Admin office', text: reason.slice(0, 500) || 'Your sign-up could not be verified. Please contact the admin office.' }].slice(-50) }, p.id);
  await audit('office_reject', p.data.tempId, p.data.collegeId, u.fullName);
}

/** A message the student sees on their home screen. */
export async function messageSignup(u: Staff, pendingId: string, text: string) {
  need(u);
  const t = text.trim();
  if (t.length < 2) throw new StudentAccountError('Write a message.');
  const { p } = await credOfPending(pendingId);
  await pendingSignups.put(st(), { ...p.data, messages: [...p.data.messages, { at: now(), by: `Admin office (${u.fullName})`, text: t.slice(0, 1000) }].slice(-50) }, p.id);
  await audit('office_message', p.data.tempId, p.data.collegeId, u.fullName);
}

/** Mark sign-ups (and their accounts) or real student records as test data. */
export async function markTest(u: Staff, ids: { pendingIds?: string[]; studentIds?: string[] }, isTest: boolean) {
  need(u);
  for (const id of ids.pendingIds ?? []) {
    const { p, cred } = await credOfPending(id);
    await pendingSignups.put(st(), { ...p.data, isTest }, p.id);
    if (cred) await studentCredentials.put(st(), { ...cred.data, isTest }, cred.id);
  }
  for (const sid of ids.studentIds ?? []) {
    const prev = (await studentFlags.list(st(), { k1: sid }))[0];
    await studentFlags.put(st(), { studentId: sid, isTest, by: u.fullName, at: now() }, prev?.id);
  }
  await audit('office_test', `${isTest ? 'mark' : 'unmark'}:${(ids.pendingIds?.length ?? 0) + (ids.studentIds?.length ?? 0)}`, null, u.fullName);
}

/** What "Delete all test sign-ups" would remove (for the confirmation screen). */
export async function testSignupsPreview(u: Staff) {
  if (!isSuper(u)) throw new StudentAccountError('Only the Super Admin can delete test sign-ups.');
  const pend = (await pendingSignups.list(st())).filter((p) => p.data.isTest);
  const creds = (await studentCredentials.list(st())).filter((c) => c.data.isTest);
  return { signups: pend.length, accounts: creds.length, names: pend.slice(0, 20).map((p) => `${p.data.fullName} (${p.data.collegeId})`) };
}

/**
 * Super Admin only: deletes sign-ups and student accounts explicitly marked Test (and their Supabase Auth users and
 * sessions). Student records in the college database are never deleted here. Each deletion is audited.
 */
export async function deleteTestSignups(u: Staff, confirmCount: number) {
  if (!isSuper(u)) throw new StudentAccountError('Only the Super Admin can delete test sign-ups.');
  const pend = (await pendingSignups.list(st())).filter((p) => p.data.isTest);
  const creds = (await studentCredentials.list(st())).filter((c) => c.data.isTest);
  if (confirmCount !== pend.length + creds.length) throw new StudentAccountError('The number of test records changed. Review the list again before deleting.');
  for (const c of creds) {
    await deleteAuthUser(c.data.authUserId);
    await revokeAll(st(), 'app', c.data.pendingId ? `pend:${c.data.pendingId}` : `cid:${c.data.collegeId}`, `test account deleted by ${u.fullName}`);
    await studentCredentials.remove(st(), c.id);
    await audit('office_delete_test', `account:${c.data.authLogin ?? c.data.collegeId}`, c.data.collegeId, u.fullName);
  }
  for (const p of pend) {
    await revokeAll(st(), 'app', `pend:${p.id}`, `test sign-up deleted by ${u.fullName}`);
    await pendingSignups.remove(st(), p.id);
    await audit('office_delete_test', `signup:${p.data.tempId}`, p.data.collegeId, u.fullName);
  }
  return { signups: pend.length, accounts: creds.length };
}

const adminClient = () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return usingSupabase() && url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};
async function banAuth(authUserId: string | null, banned: boolean) {
  const a = adminClient();
  if (!a || !authUserId) return;
  const { error } = await a.auth.admin.updateUserById(authUserId, { ban_duration: banned ? '876000h' : 'none' });
  if (error) console.error('[pending-admin] ban failed', error.message);
}
async function deleteAuthUser(authUserId: string | null) {
  const a = adminClient();
  if (!a || !authUserId) return;
  const { error } = await a.auth.admin.deleteUser(authUserId);
  if (error && !/not.?found/i.test(error.message)) throw new Error(`auth user delete failed: ${error.message}`);
}

/** The student's own view: latest admin-office messages (no other student's data). */
export async function myPendingMessages(pendingId: string) {
  const p = await pendingSignups.get(st(), pendingId);
  return p ? p.data.messages.slice(-3).reverse() : [];
}

/** In-app notice for a student whose sign-up was verified in the last 14 days. */
export async function verificationNotice(studentId: string) {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const p = (await pendingSignups.list(st())).find((x) => x.data.linkedStudentId === studentId && (x.data.decidedAt ?? '') >= since);
  return p ? p.data.messages[p.data.messages.length - 1] ?? null : null;
}