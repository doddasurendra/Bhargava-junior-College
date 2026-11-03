import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService, getPasswordVerifier } from '../auth/store';
import type { Ctx, FirstStep } from '../auth/service';
import { can, pickActiveRole, type Permission } from './permissions';
import { getCrmRepo, usingSupabase } from './repo';
import { decodeToken, encodeToken, MFA_COOKIE, MFA_MAX_AGE_S, ROLE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_S } from './session';
import type { Role, Staff } from './types';

export function requestCtx(): Ctx {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

export async function getStaffSession(): Promise<Staff | null> {
  const claims = decodeToken(cookies().get(SESSION_COOKIE)?.value, 'crm');
  if (!claims) return null;
  const staff = await getCrmRepo().getStaff(claims.sub);
  if (!staff || !staff.active || staff.roles.length === 0) return null;
  // 2FA and session checks use every role the person holds, before narrowing to the active one.
  if (!(await getAuthService().sessionValid(staff, claims))) return null;
  const active = pickActiveRole(staff.roles, cookies().get(ROLE_COOKIE)?.value)!;
  return { ...staff, roles: [active], allRoles: staff.roles };
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

export function setSession(staffId: string, sv: number, mfa: boolean) {
  cookies().set(SESSION_COOKIE, encodeToken({ sub: staffId, sv, mfa }, 'crm', SESSION_MAX_AGE_S), cookieOpts(SESSION_MAX_AGE_S));
  cookies().delete(MFA_COOKIE);
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(MFA_COOKIE);
  cookies().delete(ROLE_COOKIE);
}

/** Password accepted, second factor still to come. */
export function getPendingMfa(): string | null {
  return decodeToken(cookies().get(MFA_COOKIE)?.value, 'mfa')?.sub ?? null;
}

export const devLoginEnabled = () => process.env.NODE_ENV === 'development' && !usingSupabase();

/** null = signed in · 'mfa' = go to the 2FA step · otherwise an error message */
function finishFirstStep(r: FirstStep): string | 'mfa' | null {
  if (r.kind === 'error') return r.message;
  cookies().delete(ROLE_COOKIE); // a fresh sign-in starts in the default role
  if (r.kind === 'mfa') {
    cookies().delete(SESSION_COOKIE);
    cookies().set(MFA_COOKIE, encodeToken({ sub: r.staffId }, 'mfa', MFA_MAX_AGE_S), cookieOpts(MFA_MAX_AGE_S));
    return 'mfa';
  }
  setSession(r.staffId, r.sv, false);
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
