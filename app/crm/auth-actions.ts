'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from '@/lib/auth/service';
import { getAuthService } from '@/lib/auth/store';
import { seal } from '@/lib/auth/totp';
import { clearSession, getPendingMfa, getStaffSession, requestCtx, requireStaff, setActiveRole, setSession } from '@/lib/crm/auth';
import { pickActiveRole } from '@/lib/crm/permissions';
import { decodeToken, RC_COOKIE, SESSION_COOKIE } from '@/lib/crm/session';
import type { ActionState } from './actions';

const code = (fd: FormData) => String(fd.get('code') ?? '').trim().slice(0, 20);

/** Freshly made recovery codes ride in a sealed 5-minute cookie to the page that shows them once. */
function stashRecoveryCodes(codes: string[]) {
  cookies().set(RC_COOKIE, seal(JSON.stringify(codes)), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/crm/account', maxAge: 5 * 60 });
}

async function guard(fn: () => Promise<ActionState | void>, paths: string[] = []): Promise<ActionState> {
  try {
    const r = await fn();
    for (const p of paths) revalidatePath(p);
    return r ?? { ok: true, message: 'Saved.' };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e; // includes Next's redirect signal
  }
}

// ---------------------------------------------------------------- sign-in, step 2

export async function mfaVerifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const staffId = getPendingMfa();
  if (!staffId) return { error: 'Your sign-in timed out. Start again.' };
  const r = await getAuthService().secondFactor(staffId, code(fd), requestCtx());
  if (r.kind === 'error') return { error: r.message };
  setSession(r.staffId, r.sv, true);
  redirect(r.method === 'recovery' ? `/crm/account?recovery=${r.recoveryLeft}` : '/crm');
}

/** Confirms the first code from a newly added authenticator — at sign-in, or from My account. */
export async function mfaEnrolAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const staffId = getPendingMfa() ?? (await getStaffSession())?.id;
  if (!staffId) return { error: 'Your sign-in timed out. Start again.' };
  const r = await getAuthService().confirmEnrolment(staffId, code(fd), requestCtx());
  if (r.kind === 'error') return { error: r.message };
  setSession(r.staffId, r.sv, true);
  stashRecoveryCodes(r.codes);
  redirect('/crm/account/recovery-codes');
}

export async function cancelMfaAction() {
  clearSession();
  redirect('/crm/login');
}

// ---------------------------------------------------------------- role switch

export async function switchRoleAction(fd: FormData) {
  const user = await requireStaff();
  const all = user.allRoles ?? user.roles;
  const wanted = String(fd.get('role') ?? '');
  const to = pickActiveRole(all, wanted);
  if (!to || to !== wanted) redirect('/crm'); // not one of theirs: ignore
  if (to !== user.roles[0]) {
    setActiveRole(to);
    await getAuthService().roleSwitched(user.id, user.roles[0], to, requestCtx());
  }
  // The new role may not see the current page, so land on the task list.
  redirect('/crm');
}

// ---------------------------------------------------------------- my account

export async function regenerateCodesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const res = await guard(async () => {
    stashRecoveryCodes(await getAuthService().regenerateRecoveryCodes(user.id, code(fd), requestCtx()));
  });
  if (res.error) return res;
  redirect('/crm/account/recovery-codes');
}

export async function disable2faAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  return guard(async () => {
    await getAuthService().disable2fa(user.id, code(fd), requestCtx());
    return { ok: true, message: 'Two-step verification is off.' };
  }, ['/crm/account']);
}

export async function signOutEverywhereAction(_: ActionState): Promise<ActionState> {
  const user = await requireStaff();
  const mfa = decodeToken(cookies().get(SESSION_COOKIE)?.value, 'crm')?.mfa ?? false;
  const sv = await getAuthService().signOutEverywhere(user.id, requestCtx());
  setSession(user.id, sv, mfa);
  return { ok: true, message: 'Signed out of every other browser and device.' };
}

export async function dismissCodesAction() {
  await requireStaff();
  cookies().delete({ name: RC_COOKIE, path: '/crm/account' });
  redirect('/crm/account');
}

// ---------------------------------------------------------------- security (Super Admin)

export async function adminReset2faAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('security.manage');
  return guard(async () => {
    await getAuthService().adminReset2fa(user, String(fd.get('staffId') ?? ''), String(fd.get('reason') ?? ''), requestCtx());
    return { ok: true, message: 'Two-step verification reset. They’re signed out and will set it up again at next sign-in.' };
  }, ['/crm/security']);
}

export async function adminUnlockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('security.manage');
  return guard(async () => {
    await getAuthService().adminUnlock(user, String(fd.get('staffId') ?? ''), requestCtx());
    return { ok: true, message: 'Unlocked.' };
  }, ['/crm/security']);
}
