'use server';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/app/portal';
import { parentBlock, parentResetCode, StudentAccountError } from '@/lib/app/studentAccount';

export interface AcctState { error?: string; message?: string; code?: string; expiresAt?: string }

/** Parent: "This wasn't my child" — blocks the student account immediately. */
export async function blockStudentAccountAction(_: AcctState, fd: FormData): Promise<AcctState> {
  const { u, p } = await requireParent();
  if (fd.get('confirm') !== 'on') return { error: 'Tick the box to confirm.' };
  try {
    await parentBlock(u.phone, p.studentId); // no revalidate: keep the confirmation on screen (the page shows Blocked on reload)
    return { message: 'The student account is blocked and signed out everywhere. It shows as blocked on the admin office’s student page; call them to unblock it.' };
  } catch (e) {
    return { error: e instanceof StudentAccountError ? e.message : 'Something went wrong. Please try again.' };
  }
}

/** Parent: one-time 6-digit code (30 minutes) the student uses on Forgot password. */
export async function parentResetCodeAction(_: AcctState): Promise<AcctState> {
  const { u, p } = await requireParent();
  try {
    const r = await parentResetCode(u.phone, p.studentId);
    return { code: r.code, expiresAt: r.expiresAt };
  } catch (e) {
    return { error: e instanceof StudentAccountError ? e.message : 'Something went wrong. Please try again.' };
  }
}
