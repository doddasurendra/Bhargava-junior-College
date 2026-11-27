import 'server-only';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { college } from '@/content/college';
import { checkPassword, hashPassword } from '../auth/service';
import { revokeAll } from '../auth/sessions';
import { can } from '../crm/permissions';
import { usingSupabase } from '../crm/repo';
import type { Staff } from '../crm/types';
import { getRecordStore } from '../records';
import { studentAuthAudit, studentCredentials } from '../records/collections';
import { sendTemplate } from '../whatsapp/service';
import { getAppStore } from './service';

/**
 * Student accounts (master prompt: simple student sign-up).
 *
 * Sign-up: student name + College ID + date of birth must match the college record; one account per College ID.
 * No email and no mobile number are asked. In production the account is a Supabase Auth user with an internal
 * login id (<college-id>@students.bjc.internal: never shown, never emailed, created already confirmed) and
 * app_metadata.role = 'student'. It has no staff role, so database RLS gives it no access at all; the app reads
 * data on the server. The password is held only by Supabase Auth (local development keeps a scrypt hash).
 *
 * Safety without email: the linked parents get a WhatsApp + in-app message and can block the account; the admin
 * office can disable, re-enable or reset it. Forgot password = a one-time code from a parent (30 min) or the admin
 * office (24 h). Every attempt is written to student_auth_audit, which also backs the rate limits.
 */
export class StudentAccountError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

export const MSG = {
  noMatch: 'These details don’t match our records. Check your College ID and date of birth, or contact the admin office.',
  exists: 'An account already exists for this College ID. Sign in or reset your password.',
  tooMany: 'Too many attempts. Please try again later.',
  blocked: 'This account is blocked. Please contact the admin office.',
  badCode: 'That code is not correct or has expired. Ask your parent or the admin office for a new one.',
} as const;

const st = () => getRecordStore();
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const now = () => new Date().toISOString();
export const internalLoginId = (collegeId: string) => `${collegeId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}@students.bjc.internal`;
export const normCollegeId = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, '-').replace(/-+/g, '-');

// ---------------------------------------------------------------- validation (shared with the form)

export const COLLEGE_ID_RE = /^[A-Z]{2,5}-\d{4}-[A-Z]{2,6}-\d{3,5}$/;

/** "K. Ravi Teja" = "Ravi Teja K" = "ravi  teja k": case, spaces, dots and word order don't matter; an initial matches a word. */
export function namesMatch(given: string, record: string): boolean {
  const toks = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const a = toks(given), b = toks(record);
  if (!a.length || a.length !== b.length) return false;
  const left = [...b];
  // full words first, then initials
  for (const w of [...a].sort((x, y) => y.length - x.length)) {
    let i = w.length > 1 ? left.indexOf(w) : -1;
    if (i < 0) i = w.length === 1 ? left.findIndex((x) => x[0] === w) : left.findIndex((x) => x.length === 1 && x === w[0]);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

export function passwordProblem(pw: string, collegeId?: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.';
  if (collegeId && pw.toLowerCase().includes(collegeId.toLowerCase())) return 'Don’t use your College ID in the password.';
  return null;
}

export function ageProblem(dob: string, today = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Enter your date of birth.';
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date.';
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  if (today.getUTCMonth() < d.getUTCMonth() || (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())) age--;
  if (age < 14 || age > 25) return 'Students must be between 14 and 25 years old.';
  return null;
}

// ---------------------------------------------------------------- password store (Supabase Auth in production)

interface PasswordBackend {
  create(collegeId: string, studentId: string, password: string): Promise<{ authUserId: string | null; passwordHash: string }>;
  verify(cred: { authUserId: string | null; passwordHash: string; collegeId: string }, password: string): Promise<boolean>;
  set(cred: { authUserId: string | null; collegeId: string; studentId: string }, password: string): Promise<{ authUserId: string | null; passwordHash: string }>;
  ban(authUserId: string | null, banned: boolean): Promise<void>;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
function backend(): PasswordBackend {
  const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
  if (!usingSupabase() || !url || !service || !anon) {
    return {
      async create(_c, _s, pw) { return { authUserId: null, passwordHash: hashPassword(pw) }; },
      async verify(c, pw) { return !!c.passwordHash && checkPassword(pw, c.passwordHash); },
      async set(_c, pw) { return { authUserId: null, passwordHash: hashPassword(pw) }; },
      async ban() { /* local: the status field is enough */ },
    };
  }
  const admin = createClient(url, service, opts);
  const create = async (collegeId: string, studentId: string, password: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: internalLoginId(collegeId), password, email_confirm: true, // internal id: no email is ever sent
      app_metadata: { role: 'student', college_id: collegeId, student_id: studentId }, user_metadata: { kind: 'student' },
    });
    if (error || !data.user) {
      if (error && /already|registered|exists/i.test(error.message)) throw new StudentAccountError(MSG.exists);
      throw new Error(`student auth create failed: ${error?.message ?? 'no user'}`);
    }
    return { authUserId: data.user.id, passwordHash: '' };
  };
  return {
    create,
    async verify(c, pw) {
      if (!c.authUserId) return !!c.passwordHash && checkPassword(pw, c.passwordHash); // older accounts, migrated on success
      const sb = createClient(url, anon, opts);
      const { data, error } = await sb.auth.signInWithPassword({ email: internalLoginId(c.collegeId), password: pw });
      await sb.auth.signOut().catch(() => undefined); // our own session cookie is the session
      return !error && data.user?.id === c.authUserId;
    },
    async set(c, pw) {
      if (!c.authUserId) return create(c.collegeId, c.studentId, pw);
      const { error } = await admin.auth.admin.updateUserById(c.authUserId, { password: pw });
      if (error) throw new Error(`student auth password update failed: ${error.message}`);
      return { authUserId: c.authUserId, passwordHash: '' };
    },
    async ban(authUserId, banned) {
      if (!authUserId) return;
      const { error } = await admin.auth.admin.updateUserById(authUserId, { ban_duration: banned ? '876000h' : 'none' });
      if (error) console.error('[student-account] ban update failed', error.message);
    },
  };
}

// ---------------------------------------------------------------- audit + persistent rate limits

async function audit(action: (typeof studentAuthAudit)['schema']['_output']['action'], outcome: string, collegeId: string | null, ip: string | null, actor: string | null = null) {
  await studentAuthAudit.put(st(), { at: now(), action, outcome, collegeId, ip, actor }).catch((e) => console.error('[student-account] audit failed', e));
}
async function attempts(action: 'signup' | 'reset' | 'login', key: { ip?: string | null; collegeId?: string | null }, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const rows = key.collegeId ? await studentAuthAudit.list(st(), { k1: key.collegeId }) : key.ip ? await studentAuthAudit.list(st(), { k2: key.ip }) : [];
  return rows.filter((r) => r.data.action === action && r.data.at >= since).length;
}

// ---------------------------------------------------------------- sign-up

export interface SignUpInput { name: string; collegeId: string; dob: string; password: string; confirm: string; consent: boolean; website?: string }

export function signUpFieldErrors(i: SignUpInput): Record<string, string> {
  const e: Record<string, string> = {};
  const name = i.name.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\d][\p{L}\d .'-]{1,59}$/u.test(name) || name.replace(/[^\p{L}]/gu, '').length < 2) e.name = 'Enter your name as in college records (2–60 letters).';
  if (!COLLEGE_ID_RE.test(normCollegeId(i.collegeId))) e.collegeId = 'Enter your College ID, like BJC-2027-JEE-0001.';
  const age = ageProblem(i.dob);
  if (age) e.dob = age;
  const pw = passwordProblem(i.password, normCollegeId(i.collegeId));
  if (pw) e.password = pw;
  if (!e.password && i.password !== i.confirm) e.confirm = 'The two passwords don’t match.';
  if (!i.consent) e.consent = 'Please agree to the terms and privacy policy to continue.';
  return e;
}

/** Creates the account and returns the College ID to sign in with. Throws StudentAccountError with a field-safe message. */
export async function signUp(i: SignUpInput, ip: string | null): Promise<{ collegeId: string; studentId: string }> {
  const collegeId = normCollegeId(i.collegeId);
  if (i.website) { await audit('signup', 'honeypot', null, ip); throw new StudentAccountError(MSG.noMatch); }
  if ((await attempts('signup', { ip }, 3600_000)) >= 5 || (await attempts('signup', { collegeId }, 86_400_000)) >= 5) {
    await audit('signup', 'rate_limited', collegeId, ip);
    throw new StudentAccountError(MSG.tooMany);
  }
  const errs = signUpFieldErrors(i);
  if (Object.keys(errs).length) { const [f, m] = Object.entries(errs)[0]; throw new StudentAccountError(m, f); }
  const s = await getAppStore().studentByCollegeId(collegeId);
  if (!s?.collegeId || s.dob !== i.dob || !namesMatch(i.name, s.fullName)) {
    await audit('signup', 'no_match', collegeId, ip);
    throw new StudentAccountError(MSG.noMatch); // never says which field was wrong
  }
  const prev = (await studentCredentials.list(st(), { k1: s.collegeId }))[0];
  if (prev) { await audit('signup', 'exists', collegeId, ip); throw new StudentAccountError(MSG.exists); }
  const pw = await backend().create(s.collegeId, s.id, i.password);
  await studentCredentials.put(st(), { collegeId: s.collegeId, studentId: s.id, ...pw, status: 'active', statusBy: null, statusAt: null, createdAt: now(), resetCodeHash: null, resetCodeExp: null, resetCodeBy: null, resetFailed: 0, failed: 0, lockedUntil: null, email: null, emailVerifiedAt: null, emailTokenHash: null, emailTokenExp: null, verifiedPhone: null, source: 'signup' });
  await audit('signup', 'created', collegeId, ip);
  await notifyParents(s.id, s.fullName, s.collegeId);
  return { collegeId: s.collegeId, studentId: s.id };
}

/** WhatsApp to every linked parent/guardian (the in-app notice is the parent home card). */
async function notifyParents(studentId: string, name: string, collegeId: string) {
  for (const g of await getAppStore().guardiansOf(studentId)) {
    await sendTemplate({ template: 'student_account_created', to: g.phone, params: [name, collegeId, college.phones[0].display], dedupeKey: `student-account:${collegeId}:${g.phone}` }).catch((e) => console.error('[student-account] parent message failed', (e as Error).message));
  }
}

// ---------------------------------------------------------------- sign-in

const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
export async function verifyStudentLogin(idRaw: string, password: string, ip: string | null): Promise<{ ok: true; collegeId: string } | { ok: false; reason: 'invalid' | 'locked' | 'blocked' | 'unverified' }> {
  const id = idRaw.includes('@') ? idRaw.trim().toLowerCase() : normCollegeId(idRaw);
  const cred = id.includes('@') ? (await studentCredentials.list(st())).find((c) => c.data.email === id) : (await studentCredentials.list(st(), { k1: id }))[0];
  if (!cred) { await audit('login', 'unknown', id.includes('@') ? null : id, ip); return { ok: false, reason: 'invalid' }; }
  const c = cred.data;
  if (c.status !== 'active') { await audit('login', c.status, c.collegeId, ip); return { ok: false, reason: 'blocked' }; }
  if (c.lockedUntil && new Date(c.lockedUntil) > new Date()) return { ok: false, reason: 'locked' };
  if (c.source === 'self' && !c.emailVerifiedAt && !c.authUserId && c.passwordHash && !c.createdAt) return { ok: false, reason: 'unverified' };
  const b = backend();
  if (!(await b.verify(c, password))) {
    const failed = c.failed + 1;
    await studentCredentials.put(st(), { ...c, failed, lockedUntil: failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null }, cred.id);
    await audit('login', 'bad_password', c.collegeId, ip);
    return { ok: false, reason: failed >= MAX_FAILS ? 'locked' : 'invalid' };
  }
  let next = { ...c, failed: 0, lockedUntil: null };
  // an older account (hash in our store) moves into Supabase Auth on its first successful sign-in
  if (!c.authUserId && usingSupabase()) {
    try { next = { ...next, ...(await b.set(c, password)) }; } catch (e) { console.error('[student-account] migration to Supabase Auth failed', (e as Error).message); }
  }
  await studentCredentials.put(st(), next, cred.id);
  await audit('login', 'ok', c.collegeId, ip);
  return { ok: true, collegeId: c.collegeId };
}

// ---------------------------------------------------------------- block / disable / reset

async function credFor(studentId: string) {
  const s = await getAppStore().getStudent(studentId);
  if (!s?.collegeId) return null;
  const c = (await studentCredentials.list(st(), { k1: s.collegeId }))[0];
  return c ? { s, c } : { s, c: null };
}

export async function accountSummary(studentId: string) {
  const r = await credFor(studentId);
  if (!r?.c) return { exists: false as const };
  const d = r.c.data;
  return { exists: true as const, status: d.status, createdAt: d.createdAt ?? null, statusBy: d.statusBy, statusAt: d.statusAt, resetPending: !!(d.resetCodeExp && new Date(d.resetCodeExp) > new Date()), resetBy: d.resetCodeBy };
}

async function setStatus(studentId: string, status: 'active' | 'blocked' | 'disabled', by: string, action: 'block' | 'disable' | 'enable') {
  const r = await credFor(studentId);
  if (!r?.c) throw new StudentAccountError('There is no student account to change.');
  await studentCredentials.put(st(), { ...r.c.data, status, statusBy: by, statusAt: now() }, r.c.id);
  await backend().ban(r.c.data.authUserId, status !== 'active');
  if (status !== 'active') await revokeAll(st(), 'app', `cid:${r.c.data.collegeId}`, `student account ${status} by ${by}`);
  await audit(action, status, r.c.data.collegeId, null, by);
}

/** Parent: "This wasn't my child" — blocks the account at once (only the admin office can re-enable it). */
export async function parentBlock(parentPhone: string, studentId: string) {
  if (!(await getAppStore().guardiansOf(studentId)).some((g) => g.phone === parentPhone)) throw new StudentAccountError('You can only manage your own child’s account.');
  await setStatus(studentId, 'blocked', `parent ${parentPhone.slice(-4)}`, 'block');
}

export async function officeSetStatus(user: Staff, studentId: string, status: 'active' | 'disabled') {
  if (!can(user, 'guardians.manage') || user.viewedBy) throw new StudentAccountError('Only the admin office can change student accounts.');
  await setStatus(studentId, status, user.fullName, status === 'active' ? 'enable' : 'disable');
}

/** A one-time 6-digit code the student uses with their College ID to set a new password. */
async function issueCode(studentId: string, by: 'parent' | 'office', actor: string, ttlMs: number) {
  const r = await credFor(studentId);
  if (!r?.c) throw new StudentAccountError('There is no student account yet. The student can sign up first.');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await studentCredentials.put(st(), { ...r.c.data, resetCodeHash: sha(`${r.c.data.collegeId}:${code}`), resetCodeExp: new Date(Date.now() + ttlMs).toISOString(), resetCodeBy: by, resetFailed: 0 }, r.c.id);
  await audit('reset_code', by, r.c.data.collegeId, null, actor);
  return { code, collegeId: r.c.data.collegeId, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
}

export async function parentResetCode(parentPhone: string, studentId: string) {
  if (!(await getAppStore().guardiansOf(studentId)).some((g) => g.phone === parentPhone)) throw new StudentAccountError('You can only manage your own child’s account.');
  return issueCode(studentId, 'parent', `parent ${parentPhone.slice(-4)}`, 30 * 60_000);
}

export async function officeResetCode(user: Staff, studentId: string) {
  if (!can(user, 'guardians.manage') || user.viewedBy) throw new StudentAccountError('Only the admin office can reset student passwords.');
  return issueCode(studentId, 'office', user.fullName, 24 * 3600_000);
}

/** Student: College ID + one-time code + new password. The old password stops working; other devices are signed out. */
export async function resetWithCode(idRaw: string, code: string, password: string, confirm: string, ip: string | null) {
  const collegeId = normCollegeId(idRaw);
  if ((await attempts('reset', { ip }, 3600_000)) >= 10 || (await attempts('reset', { collegeId }, 3600_000)) >= 5) throw new StudentAccountError(MSG.tooMany);
  const pwErr = passwordProblem(password, collegeId);
  if (pwErr) throw new StudentAccountError(pwErr, 'password');
  if (password !== confirm) throw new StudentAccountError('The two passwords don’t match.', 'confirm');
  const cred = (await studentCredentials.list(st(), { k1: collegeId }))[0];
  const c = cred?.data;
  const ok = !!c?.resetCodeHash && !!c.resetCodeExp && new Date(c.resetCodeExp) > new Date() && c.resetFailed < 5 && /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(sha(`${collegeId}:${code}`)), Buffer.from(c.resetCodeHash));
  if (!ok) {
    if (cred && c) await studentCredentials.put(st(), { ...c, resetFailed: c.resetFailed + 1 }, cred.id);
    await audit('reset', 'bad_code', collegeId, ip);
    throw new StudentAccountError(MSG.badCode, 'code');
  }
  if (c!.status !== 'active') { await audit('reset', c!.status, collegeId, ip); throw new StudentAccountError(MSG.blocked); }
  const pw = await backend().set(c!, password);
  await studentCredentials.put(st(), { ...c!, ...pw, resetCodeHash: null, resetCodeExp: null, resetCodeBy: null, resetFailed: 0, failed: 0, lockedUntil: null }, cred!.id);
  await revokeAll(st(), 'app', `cid:${collegeId}`, 'password reset');
  await audit('reset', 'ok', collegeId, ip);
}

/** A signed-in student changes their own password (More page). */
export async function changeOwnPassword(collegeId: string, studentId: string, password: string) {
  const err = passwordProblem(password, collegeId);
  if (err) return err;
  const prev = (await studentCredentials.list(st(), { k1: collegeId }))[0];
  const pw = await backend().set({ authUserId: prev?.data.authUserId ?? null, collegeId, studentId }, password);
  if (prev) await studentCredentials.put(st(), { ...prev.data, ...pw, failed: 0, lockedUntil: null }, prev.id);
  else await studentCredentials.put(st(), { collegeId, studentId, ...pw, status: 'active', statusBy: null, statusAt: null, createdAt: now(), resetCodeHash: null, resetCodeExp: null, resetCodeBy: null, resetFailed: 0, failed: 0, lockedUntil: null, email: null, emailVerifiedAt: null, emailTokenHash: null, emailTokenExp: null, verifiedPhone: null, source: 'app' });
  return null;
}
