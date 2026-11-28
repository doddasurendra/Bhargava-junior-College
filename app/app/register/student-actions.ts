'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { recordConsent, startPendingSession, startStudentSession } from '@/lib/app/service';
import { resetWithCode, signUp, signUpFieldErrors, StudentAccountError } from '@/lib/app/studentAccount';
import { getLang } from '@/lib/i18n-server';
import { sErr } from '@/lib/app/signupText';

export interface FormState { error?: string; fields?: Record<string, string>; done?: string; exists?: boolean; /** case D: friendly information, not an error */ info?: 'exists' }

const ip = () => headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? String(fd.get(k)) : '');
const tr = (m: string) => sErr(getLang(), m);
const trFields = (f: Record<string, string>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, tr(v)]));

/** Single-form student sign-up. Every valid sign-up succeeds: linked at once (A), pending verification (B/C/E), or 'you already have an account' (D). */
export async function studentSignUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const input = { name: str(fd, 'name'), collegeId: str(fd, 'collegeId'), dob: str(fd, 'dob'), password: str(fd, 'password'), confirm: str(fd, 'confirm'), consent: fd.get('consent') === 'on', website: str(fd, 'website') };
  const fields = signUpFieldErrors(input);
  if (Object.keys(fields).length && !input.website) return { fields: trFields(fields) };
  let r: Awaited<ReturnType<typeof signUp>>;
  try {
    r = await signUp(input, ip());
  } catch (e) {
    if (e instanceof StudentAccountError) {
      if (e.field) return { fields: { [e.field]: tr(e.message) } };
      return { error: tr(e.message) };
    }
    console.error('[student-signup] failed', e);
    return { error: tr('Something went wrong. Please try again.') };
  }
  if (r.kind === 'exists') return { info: 'exists' };
  // the consent box on this form is the DPDP consent
  if (r.kind === 'active') {
    await startStudentSession(r.collegeId);
    await recordConsent(`cid:${r.collegeId}`);
    redirect('/app?welcome=1');
  }
  await startPendingSession(r.pendingId);
  await recordConsent(`pend:${r.pendingId}`);
  redirect('/app?welcome=pending');
}

/** Forgot password: College ID + one-time code (from a parent or the admin office) + new password. */
export async function studentResetAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!/^\d{6}$/.test(str(fd, 'code').trim())) return { fields: { code: tr('Enter the 6-digit code.') } };
  try {
    await resetWithCode(str(fd, 'collegeId'), str(fd, 'code').trim(), str(fd, 'password'), str(fd, 'confirm'), ip());
    return { done: 'ok' };
  } catch (e) {
    if (e instanceof StudentAccountError) return e.field ? { fields: { [e.field]: tr(e.message) } } : { error: tr(e.message) };
    console.error('[student-reset] failed', e);
    return { error: tr('Something went wrong. Please try again.') };
  }
}
