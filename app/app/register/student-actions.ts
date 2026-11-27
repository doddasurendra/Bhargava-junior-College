'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { recordConsent, startStudentSession } from '@/lib/app/service';
import { resetWithCode, signUp, signUpFieldErrors, StudentAccountError } from '@/lib/app/studentAccount';
import { getLang } from '@/lib/i18n-server';
import { sErr } from '@/lib/app/signupText';

export interface FormState { error?: string; fields?: Record<string, string>; done?: string; exists?: boolean }

const ip = () => headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? String(fd.get(k)) : '');
const tr = (m: string) => sErr(getLang(), m);
const trFields = (f: Record<string, string>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, tr(v)]));

/** Single-form student sign-up: name + College ID + date of birth + password; matched against the college record. */
export async function studentSignUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const input = { name: str(fd, 'name'), collegeId: str(fd, 'collegeId'), dob: str(fd, 'dob'), password: str(fd, 'password'), confirm: str(fd, 'confirm'), consent: fd.get('consent') === 'on', website: str(fd, 'website') };
  const fields = signUpFieldErrors(input);
  if (Object.keys(fields).length && !input.website) return { fields: trFields(fields) };
  let collegeId: string;
  try {
    collegeId = (await signUp(input, ip())).collegeId;
  } catch (e) {
    if (e instanceof StudentAccountError) {
      if (e.field) return { fields: { [e.field]: tr(e.message) } };
      return { error: tr(e.message), exists: /already exists/.test(e.message) };
    }
    console.error('[student-signup] failed', e);
    return { error: tr('Something went wrong. Please try again.') };
  }
  await startStudentSession(collegeId);
  await recordConsent(`cid:${collegeId}`); // the consent box on this form is the DPDP consent
  redirect('/app?welcome=1');
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
