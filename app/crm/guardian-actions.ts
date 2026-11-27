'use server';
import { revalidatePath } from 'next/cache';
import { addGuardian, removeGuardian, setStudentLoginPhone } from '@/lib/app/admin';
import { officeResetCode, officeSetStatus, StudentAccountError } from '@/lib/app/studentAccount';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import type { ActionState } from './actions';

async function run(leadId: string, fn: () => Promise<void>, message: string): Promise<ActionState> {
  try {
    await fn();
    revalidatePath(`/crm/leads/${leadId}`);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] guardian action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function addGuardianAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, () => addGuardian(user, leadId, { name: String(fd.get('name') ?? ''), phone: String(fd.get('phone') ?? ''), relation: String(fd.get('relation') ?? '') }), 'Guardian added; a welcome message was sent on WhatsApp.');
}

export async function studentPhoneAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const studentId = String(fd.get('studentId') ?? '');
  const phone = String(fd.get('phone') ?? '');
  try {
    await setStudentLoginPhone(user, studentId, phone);
    revalidatePath(`/crm/students/${studentId}`);
    return { ok: true, message: phone.trim() ? 'Saved (college record only; students sign in with College ID and password).' : 'Removed.' };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] student phone action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function removeGuardianAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, () => removeGuardian(user, leadId, String(fd.get('phone') ?? '')), 'App access removed.');
}

/** Admin office: disable / re-enable a student's app account (Students → Student account). */
export async function studentAccountStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const studentId = String(fd.get('studentId') ?? '');
  const status = fd.get('status') === 'active' ? 'active' : 'disabled';
  try {
    await officeSetStatus(user, studentId, status);
    revalidatePath(`/crm/students/${studentId}`);
    return { ok: true, message: status === 'active' ? 'Student account enabled.' : 'Student account disabled; the student was signed out everywhere.' };
  } catch (e) {
    if (e instanceof StudentAccountError) return { error: e.message };
    console.error('[crm] student account action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

/** Admin office: one-time 6-digit reset code, valid 24 hours (the student uses it on Forgot password). */
export async function studentAccountResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const studentId = String(fd.get('studentId') ?? '');
  try {
    const r = await officeResetCode(user, studentId); // no revalidate: the code must stay on screen
    return { ok: true, message: `One-time code ${r.code} for ${r.collegeId}, valid 24 hours. Give it to the student in person; they enter it on Forgot password? with their College ID. It is shown only now.` };
  } catch (e) {
    if (e instanceof StudentAccountError) return { error: e.message };
    console.error('[crm] student account reset failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}