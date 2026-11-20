import 'server-only';
import { showCodesOnScreen } from '../localTesting';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { college } from '@/content/college';
import { hashPassword } from '../auth/service';
import { can } from '../crm/permissions';
import { CrmError } from '../crm/service';
import type { Staff } from '../crm/types';
import type { StudentRow } from '../crm/verification';
import { emailConfigured, sendEmail } from '../email';
import { issueOtp, verifyOtp, type OtpResult } from '../otp';
import { maskPhone, normalizeIndianMobile } from '../phone';
import { getRecordStore } from '../records';
import { parentLinkRequests, studentCredentials } from '../records/collections';
import { siteUrl } from '../seo';
import { sendOtpCode } from '../whatsapp/service';
import { addGuardian } from './admin';
import { getAppStore } from './service';
import { RELATIONS, type Relation } from './types';

/**
 * Student and parent self-registration (master prompt §2).
 *
 * Student: College ID + date of birth + a mobile the college already has for them (their own, or a parent's —
 * then the parent receives the code, so a parent always knows) → WhatsApp code → email + password → email
 * verification link. Sign-in with College ID (or email) + password works only after the email is verified.
 *
 * Parent: name, relation, mobile, child's College ID + date of birth → WhatsApp code to that mobile. A number
 * the college already has for the child links at once; a new number waits for the admin office, because a
 * College ID and a birthday are not secret enough to hand someone a child's records.
 */

export class RegistrationError extends Error {}

const NO_MATCH = 'We couldn’t match those details with a student. Check the College ID and date of birth, or call the college office.';
const store = () => getRecordStore();
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const EMAIL_TOKEN_MS = 48 * 3600_000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth.');
const collegeIdSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,40}$/, 'Enter the College ID / admission number.');
const phoneSchema = z.string().transform((v, ctx) => {
  const n = normalizeIndianMobile(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number.' });
    return z.NEVER;
  }
  return n;
});
const first = (e: z.ZodError) => e.issues[0]?.message ?? 'Check the form.';
function parse<T extends z.ZodTypeAny>(s: T, input: unknown): z.infer<T> {
  const r = s.safeParse(input);
  if (!r.success) throw new RegistrationError(first(r.error));
  return r.data;
}

async function matchStudent(collegeId: string, dob: string): Promise<StudentRow | null> {
  const s = await getAppStore().studentByCollegeId(collegeId);
  return s && s.collegeId && s.dob === dob ? s : null;
}

/** Sends the WhatsApp code; in local development without WhatsApp the code is also returned for the screen. */
async function sendCode(phone: string): Promise<string | undefined> {
  const code = await issueOtp(phone);
  await sendOtpCode(phone, code);
  return showCodesOnScreen() ? code : undefined;
}

export const checkCode = (phone: string, code: string): Promise<OtpResult> => verifyOtp(phone, code);

// ---------------------------------------------------------------- student

export const studentStartSchema = z.object({ collegeId: collegeIdSchema, dob: isoDate, phone: phoneSchema });

export async function startStudentRegistration(input: unknown) {
  const v = parse(studentStartSchema, input);
  const s = await matchStudent(v.collegeId, v.dob);
  if (!s) throw new RegistrationError(NO_MATCH);
  const guardians = await getAppStore().guardiansOf(s.id);
  const who = s.loginPhone === v.phone ? 'student' : guardians.some((g) => g.phone === v.phone) ? 'parent' : null;
  if (!who) throw new RegistrationError('That mobile number is not on the college’s record for this student. Use your own number given at admission, or a parent’s number (the code will go to them).');
  const cred = (await studentCredentials.list(store(), { k1: s.collegeId! }))[0];
  if (cred?.data.source === 'self' && cred.data.emailVerifiedAt) throw new RegistrationError('You are already registered. Sign in with your College ID or email and password.');
  return { studentId: s.id, phone: v.phone, who, devCode: await sendCode(v.phone) };
}

export const studentFinishSchema = z
  .object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254), password: z.string().max(200), confirm: z.string().max(200) })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The two passwords don’t match.' });
    if (v.password.length < 8) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use at least 8 characters for the password.' });
    if (/^(.)\1+$/.test(v.password) || ['password', '12345678', 'bhargava', 'qwerty'].some((w) => v.password.toLowerCase().includes(w))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That password is too easy to guess.' });
  });

/** After the code was verified (the caller holds the signed registration cookie). */
export async function finishStudentRegistration(studentId: string, phone: string, input: unknown) {
  const v = parse(studentFinishSchema, input);
  const s = await getAppStore().getStudent(studentId);
  if (!s?.collegeId) throw new RegistrationError(NO_MATCH);
  if (v.password.toLowerCase().includes(s.collegeId.toLowerCase())) throw new RegistrationError('Don’t use your College ID in the password.');
  const all = await studentCredentials.list(store());
  if (all.some((c) => c.data.email === v.email && c.data.studentId !== s.id)) throw new RegistrationError('This email is already used by another student account.');
  const prev = all.find((c) => c.data.collegeId === s.collegeId);
  const token = randomBytes(24).toString('base64url');
  await studentCredentials.put(store(), { collegeId: s.collegeId, studentId: s.id, passwordHash: hashPassword(v.password), failed: 0, lockedUntil: null, email: v.email, emailVerifiedAt: null, emailTokenHash: sha(token), emailTokenExp: new Date(Date.now() + EMAIL_TOKEN_MS).toISOString(), verifiedPhone: phone, source: 'self' }, prev?.id);
  const link = `${siteUrl}/app/verify-email?token=${token}`;
  const r = await sendEmail({ to: [v.email], subject: `${college.name}: confirm your email`, html: `<p>Hello ${s.fullName.split(' ')[0]},</p><p>Confirm your email to finish your student account (College ID ${s.collegeId}):</p><p><a href="${link}">Confirm my email</a></p><p>This link works for 48 hours. If you didn't register, ignore this email.</p>` });
  // No mailer locally: the link is printed to the server console only (never shown in the browser).
  if (!emailConfigured()) console.info(`[dev email] verification link for ${s.collegeId}: ${link}`);
  return { emailed: r.status === 'sent', maskedPhone: maskPhone(phone) };
}

export async function verifyStudentEmail(token: string): Promise<'ok' | 'invalid'> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid';
  const h = sha(token);
  const c = (await studentCredentials.list(store())).find((x) => x.data.emailTokenHash === h);
  if (!c || !c.data.emailTokenExp || new Date(c.data.emailTokenExp) < new Date()) return 'invalid';
  await studentCredentials.put(store(), { ...c.data, emailVerifiedAt: new Date().toISOString(), emailTokenHash: null, emailTokenExp: null }, c.id);
  return 'ok';
}

// ---------------------------------------------------------------- parent

export const parentStartSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80),
  relation: z.enum(RELATIONS, { errorMap: () => ({ message: 'Choose how you are related to the student.' }) }),
  phone: phoneSchema,
  collegeId: collegeIdSchema,
  dob: isoDate,
});
export type ParentDraft = z.infer<typeof parentStartSchema>;

export async function startParentRegistration(input: unknown) {
  const v = parse(parentStartSchema, input);
  if (!(await matchStudent(v.collegeId, v.dob))) throw new RegistrationError(NO_MATCH);
  return { draft: v, devCode: await sendCode(v.phone) };
}

/**
 * After the parent's code was verified. 'already' = this number already has access; 'linked' = the college
 * had this number for the child, access granted now; 'pending' = waiting for the admin office.
 */
export async function finishParentRegistration(d: ParentDraft): Promise<{ result: 'already' | 'linked' | 'pending'; student: string }> {
  const s = await matchStudent(d.collegeId, d.dob);
  if (!s) throw new RegistrationError(NO_MATCH);
  const app = getAppStore();
  const guardians = await app.guardiansOf(s.id);
  if (guardians.some((g) => g.phone === d.phone)) return { result: 'already', student: s.fullName };
  if (s.guardianPhone === d.phone) {
    await app.addGuardian({ studentId: s.id, phone: d.phone, name: d.name, relation: d.relation as Relation, addedBy: null });
    await parentLinkRequests.put(store(), { phone: d.phone, name: d.name, relation: d.relation, studentId: s.id, status: 'approved', decidedBy: 'auto: number on admission record', decidedAt: new Date().toISOString(), note: null });
    return { result: 'linked', student: s.fullName };
  }
  const open = (await parentLinkRequests.list(store(), { k1: d.phone })).find((r) => r.data.studentId === s.id && r.data.status === 'pending');
  if (!open) await parentLinkRequests.put(store(), { phone: d.phone, name: d.name, relation: d.relation, studentId: s.id, status: 'pending', decidedBy: null, decidedAt: null, note: null });
  return { result: 'pending', student: s.fullName };
}

/** What a phone has asked for (shown to the parent after they verify the same phone again). */
export async function requestsForPhone(phone: string) {
  const byId = new Map((await getAppStore().listStudents()).map((s) => [s.id, s.fullName]));
  return (await parentLinkRequests.list(store(), { k1: phone })).map((r) => ({ id: r.id, student: byId.get(r.data.studentId) ?? 'Student', status: r.data.status, note: r.data.note, at: r.createdAt }));
}

// ---------------------------------------------------------------- admin office

export async function pendingParentRequests(user: Staff) {
  if (!can(user, 'guardians.manage')) throw new CrmError('Only the admin office manages parent access.');
  const app = getAppStore();
  const rows = (await parentLinkRequests.list(store(), { k2: 'pending' })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return Promise.all(rows.map(async (r) => {
    const s = await app.getStudent(r.data.studentId);
    return { id: r.id, createdAt: r.createdAt, ...r.data, student: s, guardians: s ? await app.guardiansOf(s.id) : [] };
  }));
}

export async function decideParentRequest(user: Staff, id: string, approve: boolean, note: string) {
  if (!can(user, 'guardians.manage')) throw new CrmError('Only the admin office manages parent access.');
  const r = await parentLinkRequests.get(store(), id);
  if (!r || r.data.status !== 'pending') throw new CrmError('This request has already been decided.');
  if (!approve && note.trim().length < 3) throw new CrmError('Give a reason, so the parent knows what to do.');
  const s = await getAppStore().getStudent(r.data.studentId);
  if (!s) throw new CrmError('Student not found.');
  // Approval goes through the same path as adding a guardian by hand (permission, WhatsApp welcome).
  if (approve) await addGuardian(user, s.leadId, { name: r.data.name, phone: r.data.phone, relation: r.data.relation });
  await parentLinkRequests.put(store(), { ...r.data, status: approve ? 'approved' : 'rejected', decidedBy: user.id, decidedAt: new Date().toISOString(), note: note.trim().slice(0, 300) || null }, r.id);
}
