import 'server-only';
import { reqCache as cache } from '../reqcache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService, getPasswordVerifier } from '../auth/store';
import type { Ctx, FirstStep } from '../auth/service';
import { checkSession, revokeSession, startSession, STAFF_IDLE_MS } from '../auth/sessions';
import { getRecordStore } from '../records';
import { can, permissionsFor, pickActiveRole, type Permission } from './permissions';
import { loadRbac } from './rbac';
import { getCrmRepo, usingSupabase } from './repo';
import { decodeToken, encodeToken, MFA_COOKIE, MFA_MAX_AGE_S, ROLE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_S, VIEWAS_COOKIE, VIEWAS_MAX_AGE_S } from './session';
import type { Role, Staff } from './types';

export function requestCtx(): Ctx {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

/** The signed-in person, before any "view as". */
async function realSession(): Promise<(Staff & { sid: string }) | null> {
  const claims = decodeToken(cookies().get(SESSION_COOKIE)?.value, 'crm');
  if (!claims?.sid) return null;
  const staff = await getCrmRepo().getStaff(claims.sub);
  if (!staff || !staff.active || staff.roles.length === 0) return null;
  // 2FA and session-version checks use every role the person holds, before narrowing to the active one.
  if (!(await getAuthService().sessionValid(staff, claims))) return null;
  // server-side record: remote logout and the 30-minute inactivity timeout (§9A.1)
  if (!(await checkSession(getRecordStore(), claims.sid, 'staff', staff.id, new Date(), STAFF_IDLE_MS))) return null;
  return { ...staff, sid: claims.sid };
}

async function withRole(staff: Staff, wanted: string | undefined): Promise<Staff> {
  const active = pickActiveRole(staff.roles, wanted)!;
  const { matrix } = await loadRbac(getRecordStore());
  return { ...staff, roles: [active], allRoles: staff.roles, perms: permissionsFor([active], matrix) };
}

/**
 * The signed-in staff member as the app should treat them: their active role and its effective permissions.
 * While a Super Admin is "viewing as" someone, this is that person (read-only; see middleware).
 * Cached per request.
 */
export const getStaffSession = cache(async (): Promise<Staff | null> => {
  const me = await realSession();
  if (!me) return null;
  const view = decodeToken(cookies().get(VIEWAS_COOKIE)?.value, 'viewas');
  if (view && view.sid === me.sid) {
    const myPerms = (await withRole(me, cookies().get(ROLE_COOKIE)?.value)).perms ?? [];
    const target = myPerms.includes('impersonate') ? await getCrmRepo().getStaff(view.sub) : null;
    if (target?.active && target.roles.length) return { ...(await withRole(target, undefined)), viewedBy: me.id };
  }
  return withRole(me, cookies().get(ROLE_COOKIE)?.value);
});

/** The person actually signed in, even during "view as" (for stopping it, and for the banner). */
export async function getRealStaff(): Promise<Staff | null> {
  const me = await realSession();
  return me ? withRole(me, cookies().get(ROLE_COOKIE)?.value) : null;
}

/** Not signed: it can only pick among roles the user already holds (checked on every request). */
export function setActiveRole(role: Role) {
  cookies().set(ROLE_COOKIE, role, cookieOpts(SESSION_MAX_AGE_S));
}

/** For pages and server actions. Redirects to login when signed out; throws when not permitted. */
export async function requireStaff(perm?: Permission): Promise<Staff> {
  const staff = await getStaffSession();
  if (!staff) redirect('/crm/login');
  if (perm && !can(staff, perm)) throw new Error('You do not have permission to do this.');
  return staff;
}

const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge });

/** Issues the session cookie; starts a new server-side session record unless one is passed in. */
export async function setSession(staffId: string, sv: number, mfa: boolean, sid?: string) {
  const id = sid ?? (await startSession(getRecordStore(), { kind: 'staff', subject: staffId, ...requestCtx() }));
  cookies().set(SESSION_COOKIE, encodeToken({ sub: staffId, sv, mfa, sid: id }, 'crm', SESSION_MAX_AGE_S), cookieOpts(SESSION_MAX_AGE_S));
  cookies().delete(MFA_COOKIE);
  return id;
}

export function currentSid(): string | undefined {
  return decodeToken(cookies().get(SESSION_COOKIE)?.value, 'crm')?.sid;
}

export async function clearSession() {
  const sid = currentSid();
  if (sid) await revokeSession(getRecordStore(), sid, 'signed out');
  cookies().delete(SESSION_COOKIE);
  cookies().delete(MFA_COOKIE);
  cookies().delete(ROLE_COOKIE);
  cookies().delete(VIEWAS_COOKIE);
}

/** Start "view as" (Super Admin support, §9A.4): bound to the current session, expires after 30 minutes. */
export function startViewAs(targetId: string) {
  const sid = currentSid();
  if (!sid) return;
  cookies().set(VIEWAS_COOKIE, encodeToken({ sub: targetId, sid }, 'viewas', VIEWAS_MAX_AGE_S), cookieOpts(VIEWAS_MAX_AGE_S));
}

export function stopViewAs() {
  cookies().delete(VIEWAS_COOKIE);
}

/** Password accepted, second factor still to come. */
export function getPendingMfa(): string | null {
  return decodeToken(cookies().get(MFA_COOKIE)?.value, 'mfa')?.sub ?? null;
}

export const devLoginEnabled = () => process.env.NODE_ENV === 'development' && !usingSupabase();

/** null = signed in · 'mfa' = go to the 2FA step · otherwise an error message */
async function finishFirstStep(r: FirstStep): Promise<string | 'mfa' | null> {
  if (r.kind === 'error') return r.message;
  cookies().delete(ROLE_COOKIE); // a fresh sign-in starts in the default role
  cookies().delete(VIEWAS_COOKIE);
  if (r.kind === 'mfa') {
    cookies().delete(SESSION_COOKIE);
    cookies().set(MFA_COOKIE, encodeToken({ sub: r.staffId }, 'mfa', MFA_MAX_AGE_S), cookieOpts(MFA_MAX_AGE_S));
    return 'mfa';
  }
  await setSession(r.staffId, r.sv, false);
  return null;
}

/** Development only: sign in as one of the sample staff without a password. 2FA still applies. */
export async function loginAsDevStaff(staffId: string): Promise<string | 'mfa' | null> {
  if (!devLoginEnabled()) return 'Developer sign-in is disabled.';
  return finishFirstStep(await getAuthService().devLogin(staffId, requestCtx()));
}

export async function loginWithPassword(email: string, password: string): Promise<string | 'mfa' | null> {
  const verify = getPasswordVerifier();
  if (!verify) return 'Sign-in is not configured.';
  return finishFirstStep(await getAuthService().passwordLogin(email, password, verify, requestCtx()));
}
