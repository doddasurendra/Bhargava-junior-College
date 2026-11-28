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
import { pendingSignups, studentAuthAudit, studentCredentials } from '../records/collections';
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
  exists: 'An account already exists for this College ID. Sign in or reset your password.',
  tooMany: 'Too many attempts. Please try again later.',
  blocked: 'This account is blocked. Please contact the admin office.',
  badCode: 'That code is not correct or has expired. Ask your parent or the admin office for a new one.',
} as const;

const st = () => getRecordStore();
/** Reads apply the schema defaults, so accounts saved before a field existed (e.g. status) read as active. */
async function credList(store: ReturnType<typeof getRecordStore>, f?: { k1?: string; k2?: string }) {
  return (await studentCredentials.list(store, f)).map((r) => {
    const parsed = studentCredentials.schema.safeParse(r.data);
    return { ...r, data: parsed.success ? parsed.data : r.data };
  });
}const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const now = () => new Date().toISOString();
export const internalLoginId = (collegeId: string) => `${collegeId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}@students.bjc.internal`;
/** Trim, upper-case, any dash character or space → "-", and "BJC2027JEE0007" → "BJC-2027-JEE-0007". */
export const normCollegeId = (raw: string) => {
  const s = raw.trim().toUpperCase().replace(/[‐-―−﹘﹣－_]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const m = /^([A-Z]{2,5})-?(\d{4})-?([A-Z]{2,6})-?(\d{3,5})$/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : s;
};

/** Plain YYYY-MM-DD (no time zone involved). Accepts YYYY-MM-DD and DD/MM/YYYY (also with - or .). Null if not a real date. */
export function normDob(raw: string): string | null {
  const t = raw.trim();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Name similarity 0..1: case, extra spaces, dots and word order don't matter; an initial matches a word; small
 * spelling differences count partly. Exact token match (namesMatch) = 1.
 */
export function nameSimilarity(given: string, record: string): number {
  if (namesMatch(given, record)) return 1;
  const toks = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const a = toks(given), b = toks(record);
  if (!a.length || !b.length) return 0;
  const bigrams = (w: string) => { const out: string[] = []; for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2)); return out; };
  const dice = (x: string, y: string) => {
    if (x === y) return 1;
    if (x.length < 2 || y.length < 2) return 0;
    const bx = bigrams(x), by = bigrams(y);
    let hit = 0; const pool = [...by];
    for (const g of bx) { const i = pool.indexOf(g); if (i >= 0) { hit++; pool.splice(i, 1); } }
    return (2 * hit) / (bx.length + by.length);
  };
  const left = [...b];
  let score = 0;
  for (const w of [...a].sort((x, y) => y.length - x.length)) {
    let best = -1, bestS = 0;
    left.forEach((x, i) => {
      const s = x === w ? 1 : (w.length === 1 && x[0] === w) || (x.length === 1 && w[0] === x) ? 0.9 : dice(w, x);
      if (s > bestS) { bestS = s; best = i; }
    });
    if (best >= 0 && bestS >= 0.6) { score += bestS; left.splice(best, 1); }
  }
  const tokenScore = (2 * score) / (a.length + b.length);
  const whole = dice([...a].sort().join(''), [...b].sort().join(''));
  return Math.round(Math.max(tokenScore, whole) * 1000) / 1000;
}
export const NAME_MATCH = 0.8;

// ---------------------------------------------------------------- validation (shared with the form)

export const COLLEGE_ID_RE = /^[A-Z]{2,5}-\d{4}-[A-Z]{2,6}-\d{3,5}$/;
/** Any college ID / admission number shape the college uses (letters, digits, dashes). */
export const ADMISSION_NO_RE = /^[A-Z0-9][A-Z0-9-]{3,29}$/;

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
  verify(cred: { authUserId: string | null; passwordHash: string; collegeId: string; authLogin?: string | null }, password: string): Promise<boolean>;
  set(cred: { authUserId: string | null; collegeId: string; studentId: string; authLogin?: string | null }, password: string): Promise<{ authUserId: string | null; passwordHash: string }>;
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
  const create = async (loginKey: string, studentId: string, password: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: internalLoginId(loginKey), password, email_confirm: true, // internal id: no email is ever sent
      app_metadata: { role: 'student', college_id: loginKey, student_id: studentId }, user_metadata: { kind: 'student' },
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
      const { data, error } = await sb.auth.signInWithPassword({ email: internalLoginId(c.authLogin ?? c.collegeId), password: pw });
      await sb.auth.signOut().catch(() => undefined); // our own session cookie is the session
      return !error && data.user?.id === c.authUserId;
    },
    async set(c, pw) {
      if (!c.authUserId) return create(c.authLogin ?? c.collegeId, c.studentId, pw);
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
async function attempts(action: 'signup' | 'reset' | 'login', key: { ip?: string | null; collegeId?: string | null }, sinceMs: number, failuresOnly = false) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const rows = key.collegeId ? await studentAuthAudit.list(st(), { k1: key.collegeId }) : key.ip ? await studentAuthAudit.list(st(), { k2: key.ip }) : [];
  return rows.filter((r) => r.data.action === action && r.data.at >= since && (!failuresOnly || r.data.outcome !== 'ok')).length;
}

// ---------------------------------------------------------------- sign-up

export interface SignUpInput { name: string; collegeId: string; dob: string; password: string; confirm: string; consent: boolean; website?: string }

export function signUpFieldErrors(i: SignUpInput): Record<string, string> {
  const e: Record<string, string> = {};
  const name = i.name.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\d][\p{L}\d .'-]{1,59}$/u.test(name) || name.replace(/[^\p{L}]/gu, '').length < 2) e.name = 'Enter your name as in college records (2–60 letters).';
  if (!ADMISSION_NO_RE.test(normCollegeId(i.collegeId))) e.collegeId = 'Enter your College ID or admission number, like BJC-2027-JEE-0001.';
  const dob = normDob(i.dob);
  const age = dob ? ageProblem(dob) : 'Enter a valid date of birth.';
  if (age) e.dob = age;
  const pw = passwordProblem(i.password, normCollegeId(i.collegeId));
  if (pw) e.password = pw;
  if (!e.password && i.password !== i.confirm) e.confirm = 'The two passwords don’t match.';
  if (!i.consent) e.consent = 'Please agree to the terms and privacy policy to continue.';
  return e;
}

/** A: linked and active at once · pending: B / C / E, waiting for the admin office · exists: D (no new account). */
export type SignUpResult =
  | { kind: 'active'; collegeId: string; studentId: string; name: string }
  | { kind: 'pending'; pendingId: string; name: string }
  | { kind: 'exists' };

const tempIdOf = () => `TMP-${randomInt(0, 36 ** 6).toString(36).toUpperCase().padStart(6, '0')}`;
const blankCred = { status: 'active' as const, statusBy: null, statusAt: null, resetCodeHash: null, resetCodeExp: null, resetCodeBy: null, resetFailed: 0, failed: 0, lockedUntil: null, email: null, emailVerifiedAt: null, emailTokenHash: null, emailTokenExp: null, verifiedPhone: null, isTest: false };

/**
 * Every valid sign-up succeeds (master prompt task 2). Matching is server-side only and never tells the student
 * which detail differed:
 * A record matches (College ID + DOB + name ≥ 0.8) and has no account → active, linked.
 * B no record → pending · C record exists, details differ → pending + conflict · E College ID already has an
 * account with other details → pending + conflict · D the same person already has an account → no new account.
 */
export async function signUp(i: SignUpInput, ip: string | null): Promise<SignUpResult> {
  const collegeId = normCollegeId(i.collegeId);
  if (i.website) { await audit('signup', 'honeypot', null, ip); throw new StudentAccountError('Something went wrong. Please try again.'); }
  if ((await attempts('signup', { ip }, 3600_000)) >= 5 || (await attempts('signup', { collegeId }, 86_400_000)) >= 5) {
    await audit('signup', 'rate_limited', collegeId, ip);
    throw new StudentAccountError(MSG.tooMany);
  }
  const errs = signUpFieldErrors(i);
  if (Object.keys(errs).length) { const [f, m] = Object.entries(errs)[0]; throw new StudentAccountError(m, f); }
  const dob = normDob(i.dob)!;
  const name = i.name.trim().replace(/\s+/g, ' ');
  const same = (n: string, d: string) => d === dob && nameSimilarity(name, n) >= NAME_MATCH;

  const s = await getAppStore().studentByCollegeId(collegeId);
  const creds = await credList(st(), { k1: s?.collegeId ?? collegeId });
  const realCred = s ? creds.find((c) => c.data.studentId === s.id) : undefined;
  const pendings = (await pendingSignups.list(st(), { k1: collegeId })).filter((p) => p.data.status === 'pending');

  // D: this person already has an account (linked, or an earlier pending sign-up with the same details)
  if ((s && realCred && same(s.fullName, s.dob)) || pendings.some((p) => same(p.data.fullName, p.data.dob))) {
    await audit('signup', 'exists', collegeId, ip);
    return { kind: 'exists' };
  }
  // A: matching record without an account
  if (s?.collegeId && !realCred && same(s.fullName, s.dob)) {
    const pw = await backend().create(s.collegeId, s.id, i.password);
    await studentCredentials.put(st(), { ...blankCred, collegeId: s.collegeId, studentId: s.id, ...pw, createdAt: now(), source: 'signup', pendingId: null, authLogin: null });
    await audit('signup', 'created', collegeId, ip);
    await notifyParents(s.id, s.fullName, s.collegeId);
    return { kind: 'active', collegeId: s.collegeId, studentId: s.id, name: s.fullName };
  }
  // B / C / E: a pending account of its own, never linked to anyone else's record
  const kase: 'B' | 'C' | 'E' = !s && !pendings.length ? 'B' : s && !realCred ? 'C' : 'E';
  const conflictType = kase === 'B' ? null : kase === 'C' ? 'record_mismatch' : s ? 'duplicate_account' : 'duplicate_signup';
  const tempId = tempIdOf();
  const rec = await pendingSignups.put(st(), { fullName: name, collegeId, dob, tempId, case: kase, conflictType, conflictStudentId: s?.id ?? null, status: 'pending', linkedStudentId: null, resolution: null, decidedBy: null, decidedAt: null, isTest: false, source: 'self-signup', createdAt: now(), messages: [] });
  const pendingStudentId = `pending-${rec.id}`;
  try {
    const pw = await backend().create(tempId, pendingStudentId, i.password);
    await studentCredentials.put(st(), { ...blankCred, collegeId, studentId: pendingStudentId, ...pw, createdAt: now(), source: 'self-signup', pendingId: rec.id, authLogin: tempId });
  } catch (e) {
    await pendingSignups.remove(st(), rec.id).catch(() => undefined);
    throw e;
  }
  await audit('signup', `pending_${kase}`, collegeId, ip);
  return { kind: 'pending', pendingId: rec.id, name };
}
/** WhatsApp to every linked parent/guardian (the in-app notice is the parent home card). */
async function notifyParents(studentId: string, name: string, collegeId: string) {
  for (const g of await getAppStore().guardiansOf(studentId)) {
    await sendTemplate({ template: 'student_account_created', to: g.phone, params: [name, collegeId, college.phones[0].display], dedupeKey: `student-account:${collegeId}:${g.phone}` }).catch((e) => console.error('[student-account] parent message failed', (e as Error).message));
  }
}

// ---------------------------------------------------------------- sign-in

const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
export async function verifyStudentLogin(idRaw: string, password: string, ip: string | null): Promise<{ ok: true; collegeId: string; subject: string } | { ok: false; reason: 'invalid' | 'locked' | 'blocked' | 'unverified' }> {
  const id = idRaw.includes('@') ? idRaw.trim().toLowerCase() : normCollegeId(idRaw);
  const all = id.includes('@') ? (await credList(st())).filter((c) => c.data.email === id) : await credList(st(), { k1: id });
  if (!all.length) { await audit('login', 'unknown', id.includes('@') ? null : id, ip); return { ok: false, reason: 'invalid' }; }
  // One College ID can have a linked account and pending sign-ups (cases C/E): the password says whose it is.
  // Linked accounts are tried first; blocked / disabled ones never sign in.
  const ordered = [...all].sort((a, b) => Number(!!a.data.pendingId) - Number(!!b.data.pendingId));
  const b = backend();
  let lastBad: (typeof all)[number] | null = null;
  for (const cred of ordered) {
    const c = cred.data;
    if (c.lockedUntil && new Date(c.lockedUntil) > new Date()) { if (all.length === 1) return { ok: false, reason: 'locked' }; continue; }
    if (c.source === 'self' && !c.emailVerifiedAt && !c.authUserId && c.passwordHash && !c.createdAt) return { ok: false, reason: 'unverified' };
    if (!(await b.verify(c, password))) { lastBad = cred; continue; }
    if (c.status !== 'active') { await audit('login', c.status, c.collegeId, ip); return { ok: false, reason: 'blocked' }; }
    let next = { ...c, failed: 0, lockedUntil: null };
    // an older account (hash in our store) moves into Supabase Auth on its first successful sign-in
    if (!c.authUserId && usingSupabase()) {
      try { next = { ...next, ...(await b.set(c, password)) }; } catch (e) { console.error('[student-account] migration to Supabase Auth failed', (e as Error).message); }
    }
    await studentCredentials.put(st(), next, cred.id);
    await audit('login', 'ok', c.collegeId, ip);
    return { ok: true, collegeId: c.collegeId, subject: c.pendingId ? `pend:${c.pendingId}` : `cid:${c.collegeId}` };
  }
  if (lastBad) {
    const c = lastBad.data;
    const failed = c.failed + 1;
    await studentCredentials.put(st(), { ...c, failed, lockedUntil: failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null }, lastBad.id);
    await audit('login', 'bad_password', c.collegeId, ip);
    return { ok: false, reason: failed >= MAX_FAILS ? 'locked' : 'invalid' };
  }
  return { ok: false, reason: 'locked' };
}
// ---------------------------------------------------------------- block / disable / reset

async function credFor(studentId: string) {
  const s = await getAppStore().getStudent(studentId);
  if (!s?.collegeId) return null;
  const c = (await credList(st(), { k1: s.collegeId })).find((x) => x.data.studentId === studentId);
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
  // wrong codes only: a correct, single-use code from a parent or the office is not an attack
  if ((await attempts('reset', { ip }, 3600_000, true)) >= 10 || (await attempts('reset', { collegeId }, 3600_000, true)) >= 5) throw new StudentAccountError(MSG.tooMany);
  const pwErr = passwordProblem(password, collegeId);
  if (pwErr) throw new StudentAccountError(pwErr, 'password');
  if (password !== confirm) throw new StudentAccountError('The two passwords don’t match.', 'confirm');
  const creds = await credList(st(), { k1: collegeId });
  const cred = creds.find((x) => x.data.resetCodeHash && x.data.resetCodeHash === sha(`${collegeId}:${code}`)) ?? creds.find((x) => !x.data.pendingId) ?? creds[0];
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
  const prev = (await credList(st(), { k1: collegeId })).find((x) => x.data.studentId === studentId);
  const pw = await backend().set({ authUserId: prev?.data.authUserId ?? null, collegeId, studentId, authLogin: prev?.data.authLogin ?? null }, password);
  if (prev) await studentCredentials.put(st(), { ...prev.data, ...pw, failed: 0, lockedUntil: null }, prev.id);
  else await studentCredentials.put(st(), { ...blankCred, collegeId, studentId, ...pw, createdAt: now(), source: 'app', pendingId: null, authLogin: null });
  return null;
}
