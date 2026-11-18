'use server';
import { revalidatePath } from 'next/cache';
import { rateLimit } from '@/lib/api';
import { AuthError } from '@/lib/auth/service';
import { getRegistration } from '@/lib/auth/store';
import { requestCtx, requireStaff } from '@/lib/crm/auth';
import type { ActionState } from './actions';

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? String(fd.get(k)) : '');

/** Public: a teacher or staff member asks for an account. */
export async function registerStaffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = requestCtx();
  if (!rateLimit(`staff-register:${ctx.ip ?? 'unknown'}`, 5, 3600_000)) return { error: 'Too many registrations from this network. Try again in an hour.' };
  if (str(fd, 'website')) return { ok: true, message: 'Request received.' }; // honeypot
  try {
    const r = await getRegistration().submit(
      { fullName: str(fd, 'fullName'), employeeId: str(fd, 'employeeId'), email: str(fd, 'email'), phone: str(fd, 'phone'), department: str(fd, 'department'), designation: str(fd, 'designation'), requestedRole: str(fd, 'requestedRole'), password: str(fd, 'password'), confirm: str(fd, 'confirm') },
      ctx,
    );
    return {
      ok: true,
      message: r.emails
        ? 'Request sent. Confirm your email from the message we just sent, then wait for the administrator to approve your account. You will sign in with the email and password you chose.'
        : 'Request sent. The college administrator will verify your details and approve your account. You will then sign in with the email and password you chose.',
    };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    console.error('[register] failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function approveRegistrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireStaff('staff.manage');
  try {
    const roles = fd.getAll('roles').filter((x): x is string => typeof x === 'string');
    const s = await getRegistration().approve(actor, str(fd, 'id'), roles, requestCtx());
    revalidatePath('/crm/staff');
    return { ok: true, message: `${s.fullName} approved. They can sign in now with the password they chose.` };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
}

export async function rejectRegistrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireStaff('staff.manage');
  try {
    await getRegistration().reject(actor, str(fd, 'id'), str(fd, 'note'), requestCtx());
    revalidatePath('/crm/staff');
    return { ok: true, message: 'Request declined.' };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
}
