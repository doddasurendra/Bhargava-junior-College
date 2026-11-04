import 'server-only';
import { reqCache as cache } from '../reqcache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildTimeline, type StageKey } from '../admission';
import { checkPassword, hashPassword } from '../auth/service';
import { checkSession, enforceDeviceLimit, listSessions, revokeSession, startSession, STUDENT_DEVICE_LIMIT } from '../auth/sessions';
import { getCrmRepo } from '../crm/repo';
import { decodeToken, encodeToken } from '../crm/session';
import { getRecordStore } from '../records';
import { alumni, consents, studentCredentials } from '../records/collections';
import { formatDateTime } from '../dates';
import { issueOtp, verifyOtp } from '../otp';
import { maskPhone } from '../phone';
import { mode, sendOtpCode, sendTemplate } from '../whatsapp/service';
import { createFileAppStore } from './fileStore';
import { createSupabaseAppStore } from './supabaseStore';
import type { AppStore, Profile } from './types';

let store: AppStore | null = null;
export function getAppStore(): AppStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? createSupabaseAppStore(url, key) : createFileAppStore();
  return store;
}

export const APP_COOKIE = 'bjc_app';
export const PROFILE_COOKIE = 'bjc_app_profile';
const APP_SESSION_S = 30 * 24 * 3600; // parents stay signed in for 30 days on their own phone

// ---------------------------------------------------------------- profiles

/**
 * Everything a verified phone can see, computed fresh on every request — so an applicant becomes a parent
 * (or student) the moment the College ID is issued, and removing a guardian takes effect immediately.
 */
export async function resolveProfiles(phone: string): Promise<Profile[]> {
  const st = getAppStore();
  // signed in with College ID + password: just that student
  if (phone.startsWith('cid:')) {
    const s = await st.studentByCollegeId(phone.slice(4));
    return s?.collegeId ? [{ key: `s:${s.id}`, kind: 'student', studentId: s.id, leadId: s.leadId, name: s.fullName, collegeId: s.collegeId }] : [];
  }
  const [guardianOf, ownStudent, applications] = await Promise.all([st.guardiansByPhone(phone), st.studentsByLoginPhone(phone), st.applicationsByPhone(phone)]);
  const profiles: Profile[] = [];
  for (const g of guardianOf) {
    const s = await st.getStudent(g.studentId);
    if (s?.collegeId) profiles.push({ key: `p:${s.id}`, kind: 'parent', studentId: s.id, leadId: s.leadId, name: s.fullName, collegeId: s.collegeId, relation: g.relation });
  }
  for (const s of ownStudent) profiles.push({ key: `s:${s.id}`, kind: 'student', studentId: s.id, leadId: s.leadId, name: s.fullName, collegeId: s.collegeId! });
  const enrolledLeads = new Set(profiles.map(leadOf));
  for (const a of applications) if (!enrolledLeads.has(a.leadId)) profiles.push({ key: `a:${a.leadId}`, kind: 'applicant', leadId: a.leadId, name: a.name });
  // §9A row 20: passed-out students moved to the alumni network
  for (const al of await alumni.list(getRecordStore(), { k1: phone })) if (al.data.approved) profiles.push({ key: `al:${al.id}`, kind: 'alumni', alumniId: al.id, name: al.data.name });
  return profiles;
}

// ---------------------------------------------------------------- auth

export interface AppUser {
  /** the verified phone, or cid:<College ID> for a College ID + password sign-in */
  phone: string;
  profiles: Profile[];
  active: Profile | null;
  sid: string;
}

export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const claims = decodeToken(cookies().get(APP_COOKIE)?.value, 'app');
  if (!claims?.sid) return null;
  const phone = claims.sub;
  // server-side session record: devices list, remote sign-out, the student device limit (§9A.4)
  if (!(await checkSession(getRecordStore(), claims.sid, 'app', phone))) return null;
  const profiles = await resolveProfiles(phone);
  const wanted = cookies().get(PROFILE_COOKIE)?.value;
  // The selected profile is only honoured if it still belongs to this phone.
  const active = profiles.find((p) => p.key === wanted) ?? profiles[0] ?? null;
  return { phone, profiles, active, sid: claims.sid };
});

export async function requireAppUser(): Promise<AppUser> {
  const u = await getAppUser();
  if (!u) redirect('/app/login');
  return u;
}

/**
 * Sends a code only to numbers that have something to see, but answers the same either way so the login
 * form can't be used to find out who is a student or applicant.
 */
export async function requestLoginCode(phone: string): Promise<{ devCode?: string }> {
  const profiles = await resolveProfiles(phone);
  if (profiles.length === 0) {
    console.info(`[app] login code requested for unknown number ${maskPhone(phone)}`);
    return {};
  }
  const code = await issueOtp(phone);
  await sendOtpCode(phone, code);
  return process.env.NODE_ENV === 'development' && mode().kind === 'dev' ? { devCode: code } : {};
}

export async function completeLogin(phone: string, code: string): Promise<'ok' | 'invalid' | 'expired' | 'locked'> {
  const r = await verifyOtp(phone, code);
  if (r !== 'ok') return r;
  await startAppSession(phone);
  return 'ok';
}

async function startAppSession(subject: string) {
  const h = headers();
  const sid = await startSession(getRecordStore(), { kind: 'app', subject, ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null, userAgent: h.get('user-agent') });
  // Students may use at most two devices (§9A.4); the least recently used one is signed out.
  if ((await resolveProfiles(subject)).some((p) => p.kind === 'student')) await enforceDeviceLimit(getRecordStore(), 'app', subject, STUDENT_DEVICE_LIMIT);
  cookies().set(APP_COOKIE, encodeToken({ sub: subject, sid }, 'app', APP_SESSION_S), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: APP_SESSION_S });
}

/**
 * Developer console, local development only: open the Student & Parent portal as a number that already has
 * portal access (a guardian or a student), without an OTP. Refused outside `next dev`; the caller must also
 * check that a Developer is signed in. Recorded in the session list like any other sign-in.
 */
export async function devOpenPortalAs(phone: string) {
  if (process.env.NODE_ENV !== 'development') throw new Error('Only available in local development.');
  if ((await resolveProfiles(phone)).length === 0) throw new Error('That number has no portal access.');
  await startAppSession(phone);
}

export async function logout() {
  const sid = decodeToken(cookies().get(APP_COOKIE)?.value, 'app')?.sid;
  if (sid) await revokeSession(getRecordStore(), sid, 'signed out');
  cookies().delete(APP_COOKIE);
  cookies().delete(PROFILE_COOKIE);
}

// ---------------------------------------------------------------- College ID + password (students, §9A.2)

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

/** Same answer for an unknown College ID and a wrong password; lockout after 5 failures. */
export async function loginWithCollegeId(collegeIdRaw: string, password: string): Promise<'ok' | 'invalid' | 'locked'> {
  const collegeId = collegeIdRaw.trim().toUpperCase();
  const store = getRecordStore();
  const cred = (await studentCredentials.list(store, { k1: collegeId }))[0];
  if (!cred) return 'invalid';
  if (cred.data.lockedUntil && new Date(cred.data.lockedUntil) > new Date()) return 'locked';
  if (!checkPassword(password, cred.data.passwordHash)) {
    const failed = cred.data.failed + 1;
    await studentCredentials.put(store, { ...cred.data, failed, lockedUntil: failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null }, cred.id);
    return failed >= MAX_FAILS ? 'locked' : 'invalid';
  }
  await studentCredentials.put(store, { ...cred.data, failed: 0, lockedUntil: null }, cred.id);
  await startAppSession(`cid:${collegeId}`);
  return 'ok';
}

/** A student signed in with OTP sets (or changes) the password for College ID sign-in. */
export async function setStudentPassword(u: AppUser, password: string): Promise<string | null> {
  const p = u.active;
  if (p?.kind !== 'student') return 'Only students set a College ID password.';
  if (password.length < 8 || password.length > 200) return 'Use 8 to 200 characters.';
  if (/^(.)\1+$/.test(password) || password.toLowerCase().includes(p.collegeId.toLowerCase())) return 'That password is too easy to guess.';
  const store = getRecordStore();
  const prev = (await studentCredentials.list(store, { k1: p.collegeId }))[0];
  await studentCredentials.put(store, { collegeId: p.collegeId, studentId: p.studentId, passwordHash: hashPassword(password), failed: 0, lockedUntil: null }, prev?.id);
  return null;
}

// ---------------------------------------------------------------- DPDP consent at first login (§9A.4)

export const CONSENT_VERSION = '2026-11';
export const CONSENT_PURPOSES = ['Admission and academic records', 'Fee payments and receipts', 'Attendance, hostel and transport alerts on WhatsApp', 'Progress reports to parents and guardians'];

export async function hasConsent(subject: string) {
  return (await consents.list(getRecordStore(), { k1: subject, k2: CONSENT_VERSION })).length > 0;
}

export async function recordConsent(subject: string) {
  if (await hasConsent(subject)) return;
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  await consents.put(getRecordStore(), { phone: subject, version: CONSENT_VERSION, purposes: CONSENT_PURPOSES, at: new Date().toISOString(), ip });
}

export async function appSessions(u: AppUser) {
  return listSessions(getRecordStore(), 'app', u.phone);
}

export async function revokeAppSession(u: AppUser, id: string) {
  if (id === u.sid) return;
  if ((await appSessions(u)).some((s) => s.id === id)) await revokeSession(getRecordStore(), id, 'signed out remotely');
}

export async function switchProfile(key: string) {
  const u = await requireAppUser();
  if (u.profiles.some((p) => p.key === key)) cookies().set(PROFILE_COOKIE, key, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: APP_SESSION_S });
}

// ---------------------------------------------------------------- data for a profile

export const leadOf = (p: Profile): string | null => (p.kind === 'alumni' ? null : p.leadId);

export async function profileData(profile: Profile) {
  // alumni have no admission record in the app; their portal is /app/alumni
  if (profile.kind === 'alumni') return { lead: null, student: null, payments: [], timeline: [], counsellor: null, upcomingVisit: null, hostel: null, guardians: [] };
  const p = profile;
  const repo = getCrmRepo();
  const [lead, verification, history] = await Promise.all([repo.getLead(p.leadId), repo.getVerification(p.leadId), repo.getLeadHistory(p.leadId)]);
  const student = verification.student;
  const owner = lead?.ownerId ? await repo.getStaff(lead.ownerId) : null;
  const events = verification.signOffs.map((s) => ({ stage: s.stage as StageKey, at: s.at, owner: null }));
  if (lead) events.push({ stage: 'enquiry', at: lead.createdAt, owner: null });
  const upcomingVisit = history.visits.filter((v) => v.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return {
    lead,
    student,
    payments: verification.payments.filter((x) => x.status !== 'rejected'),
    timeline: lead ? buildTimeline(lead.stage, events) : [],
    counsellor: owner ? owner.fullName.split(' ')[0] : null,
    upcomingVisit,
    hostel: student?.stay === 'hostel' ? await getAppStore().hostelEvents(student.id, 20) : null,
    guardians: student ? await getAppStore().guardiansOf(student.id) : [],
  };
}

export async function canSeePayment(u: AppUser, paymentId: string) {
  const payment = await getCrmRepo().getPayment(paymentId);
  if (!payment?.receiptNo) return null;
  return u.profiles.some((p) => leadOf(p) === payment.leadId) ? payment : null;
}

// ---------------------------------------------------------------- hostel movements (biometric)

/** Brief §3.4: biometric entry and exit, with a WhatsApp alert to parents on every check-in and check-out. */
export async function recordHostelMovement(e: { collegeId: string; direction: 'in' | 'out'; at: string; device: string; eventId: string }) {
  const st = getAppStore();
  const student = await st.studentByCollegeId(e.collegeId);
  if (!student) return { ok: false as const, error: 'unknown_college_id' };
  if (student.stay !== 'hostel') return { ok: false as const, error: 'not_a_hosteller' };
  const event = await st.addHostelEvent({ studentId: student.id, direction: e.direction, at: e.at, device: e.device, deviceEventId: e.eventId });
  if (!event) return { ok: true as const, duplicate: true, alerted: 0 };
  let alerted = 0;
  const first = student.fullName.split(' ')[0];
  for (const g of await st.guardiansOf(student.id)) {
    const r = await sendTemplate({ template: 'hostel_movement', to: g.phone, params: [first, e.direction === 'in' ? 'checked in to' : 'checked out of', formatDateTime(e.at)], leadId: student.leadId, dedupeKey: `hostel:${event.id}:${g.phone}` });
    if (r.status === 'sent') alerted++;
  }
  await st.markAlerted(event.id, alerted);
  return { ok: true as const, duplicate: false, alerted };
}
