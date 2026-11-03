import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildTimeline, type StageKey } from '../admission';
import { getCrmRepo } from '../crm/repo';
import { decodeSession, encodeSession } from '../crm/session';
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
  const [guardianOf, ownStudent, applications] = await Promise.all([st.guardiansByPhone(phone), st.studentsByLoginPhone(phone), st.applicationsByPhone(phone)]);
  const profiles: Profile[] = [];
  for (const g of guardianOf) {
    const s = await st.getStudent(g.studentId);
    if (s?.collegeId) profiles.push({ key: `p:${s.id}`, kind: 'parent', studentId: s.id, leadId: s.leadId, name: s.fullName, collegeId: s.collegeId, relation: g.relation });
  }
  for (const s of ownStudent) profiles.push({ key: `s:${s.id}`, kind: 'student', studentId: s.id, leadId: s.leadId, name: s.fullName, collegeId: s.collegeId! });
  const enrolledLeads = new Set(profiles.map((p) => p.leadId));
  for (const a of applications) if (!enrolledLeads.has(a.leadId)) profiles.push({ key: `a:${a.leadId}`, kind: 'applicant', leadId: a.leadId, name: a.name });
  return profiles;
}

// ---------------------------------------------------------------- auth

export interface AppUser {
  phone: string;
  profiles: Profile[];
  active: Profile | null;
}

export async function getAppUser(): Promise<AppUser | null> {
  const phone = decodeSession(cookies().get(APP_COOKIE)?.value, Date.now(), 'app');
  if (!phone) return null;
  const profiles = await resolveProfiles(phone);
  const wanted = cookies().get(PROFILE_COOKIE)?.value;
  // The selected profile is only honoured if it still belongs to this phone.
  const active = profiles.find((p) => p.key === wanted) ?? profiles[0] ?? null;
  return { phone, profiles, active };
}

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
  cookies().set(APP_COOKIE, encodeSession(phone, Date.now(), 'app', APP_SESSION_S), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: APP_SESSION_S });
  return 'ok';
}

export function logout() {
  cookies().delete(APP_COOKIE);
  cookies().delete(PROFILE_COOKIE);
}

export async function switchProfile(key: string) {
  const u = await requireAppUser();
  if (u.profiles.some((p) => p.key === key)) cookies().set(PROFILE_COOKIE, key, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: APP_SESSION_S });
}

// ---------------------------------------------------------------- data for a profile

export async function profileData(p: Profile) {
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
  return u.profiles.some((p) => p.leadId === payment.leadId) ? payment : null;
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
