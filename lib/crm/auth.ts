import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { can, type Permission } from './permissions';
import { getCrmRepo, usingSupabase } from './repo';
import { decodeSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE_S } from './session';
import type { Staff } from './types';

export async function getStaffSession(): Promise<Staff | null> {
  const id = decodeSession(cookies().get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const staff = await getCrmRepo().getStaff(id);
  return staff && staff.active && staff.roles.length > 0 ? staff : null;
}

/** For pages and server actions. Redirects to login when signed out; throws when not permitted. */
export async function requireStaff(perm?: Permission): Promise<Staff> {
  const staff = await getStaffSession();
  if (!staff) redirect('/crm/login');
  if (perm && !can(staff, perm)) throw new Error('You do not have permission to do this.');
  return staff;
}

function setSession(staffId: string) {
  cookies().set(SESSION_COOKIE, encodeSession(staffId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export const devLoginEnabled = () => process.env.NODE_ENV === 'development' && !usingSupabase();

/** Development only: sign in as one of the sample staff, no password. */
export async function loginAsDevStaff(staffId: string): Promise<string | null> {
  if (!devLoginEnabled()) return 'Developer sign-in is disabled.';
  const staff = await getCrmRepo().getStaff(staffId);
  if (!staff) return 'Unknown staff member.';
  setSession(staff.id);
  console.info(`[login] dev sign-in as ${staff.fullName}`);
  return null;
}

/** Supabase Auth email + password. The session itself is our own signed cookie. */
export async function loginWithPassword(email: string, password: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return 'Sign-in is not configured.';
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  await recordLogin(email, data.user?.id ?? null, !error);
  if (error || !data.user) return 'Email or password is incorrect.';
  const staff = await getCrmRepo().getStaff(data.user.id);
  if (!staff || !staff.active || staff.roles.length === 0) return 'This account has no CRM access. Contact the admin office.';
  // TODO(§9A): enforce 2FA for super_admin, management and accounts before issuing the session.
  setSession(staff.id);
  return null;
}

async function recordLogin(email: string, userId: string | null, success: boolean) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from('login_audit').insert({ email: email.toLowerCase(), user_id: userId, success });
  if (error) console.error('[login] audit write failed', error.message);
}
