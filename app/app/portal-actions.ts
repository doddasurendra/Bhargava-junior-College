'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { rateLimit } from '@/lib/api';
import { joinAlumni, referFamily, rescheduleVisit, saveApplication, uploadDocument, recordGatewayPayment } from '@/lib/app/flows';
import { requireApplicant, requireEnrolled, requireParent, requireStudent } from '@/lib/app/portal';
import { loginWithCollegeId, recordConsent, requireAppUser, revokeAppSession, setStudentPassword } from '@/lib/app/service';
import { askDoubt, startAttempt, submitAttempt } from '@/lib/school/academics';
import { SchoolError } from '@/lib/school/common';
import { bookPtm, sendParentMessage } from '@/lib/school/mentoring';
import { addComplaint, parentDecideOutpass, requestOutpass } from '@/lib/school/operations';
import { createOrder, paymentsConfigured, publicKeyId, verifyCheckoutSignature } from '@/lib/payments';
import { duesForStudent } from '@/lib/school/accounts';

export interface AppState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

async function run(fn: () => Promise<string | void>, paths: string[]): Promise<AppState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: message || 'Done.' };
  } catch (e) {
    // let Next's redirect() through
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[app] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ---------------------------------------------------------------- sign-in & consent
export async function collegeIdLoginAction(_: AppState, fd: FormData): Promise<AppState> {
  const id = s(fd, 'collegeId') ?? '';
  const pw = typeof fd.get('password') === 'string' ? String(fd.get('password')) : '';
  if (!id || !pw) return { error: 'Enter your College ID and password.' };
  if (!rateLimit(`cid-login:${id.toUpperCase()}`, 10, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' };
  const r = await loginWithCollegeId(id.slice(0, 40), pw.slice(0, 200));
  if (r === 'locked') return { error: 'Too many wrong passwords. Try again in 15 minutes or sign in with your mobile number.' };
  if (r === 'invalid') return { error: 'College ID or password is incorrect. First time? Sign in with your mobile number and set a password in More.' };
  redirect('/app');
}

export async function consentAction(fd: FormData) {
  const u = await requireAppUser();
  if (fd.get('agree') !== 'on') redirect('/app/consent?declined=1');
  await recordConsent(u.phone);
  redirect('/app');
}

export async function setPasswordAction(_: AppState, fd: FormData): Promise<AppState> {
  const u = await requireAppUser();
  const pw = String(fd.get('password') ?? '');
  if (pw !== String(fd.get('confirm') ?? '')) return { error: 'The two passwords don’t match.' };
  const err = await setStudentPassword(u, pw);
  return err ? { error: err } : { ok: true, message: 'Password set. You can now sign in with your College ID.' };
}

export async function revokeDeviceAction(fd: FormData) {
  const u = await requireAppUser();
  await revokeAppSession(u, String(fd.get('sessionId') ?? ''));
  revalidatePath('/app/more');
}

// ---------------------------------------------------------------- student
export const submitTestAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { p } = await requireStudent();
    const testId = s(fd, 'testId') ?? '';
    const answers: Record<string, number> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith('q:') && typeof v === 'string' && v !== '') answers[k.slice(2)] = Number(v);
    let seconds: Record<string, number> = {};
    try {
      seconds = JSON.parse(String(fd.get('seconds') ?? '{}'));
    } catch {
      seconds = {};
    }
    const r = await submitAttempt(p.studentId, testId, answers, seconds);
    redirect(`/app/tests/${testId}?done=${r.late ? 'late' : '1'}`);
  }, ['/app/tests']);

export async function startTestAction(fd: FormData) {
  const { p } = await requireStudent();
  const testId = String(fd.get('testId') ?? '');
  try {
    await startAttempt(p.studentId, testId);
  } catch (e) {
    if (e instanceof SchoolError) redirect(`/app/tests/${testId}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/app/tests/${testId}`);
}

export const askDoubtAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { p } = await requireStudent();
    const text = s(fd, 'text');
    if (!text || text.length < 5) throw new SchoolError('Describe your doubt.');
    await askDoubt(p.studentId, { subject: s(fd, 'subject') ?? 'Physics', text: text.slice(0, 2000), imageUrl: null });
    return 'Sent to your teachers.';
  }, ['/app/doubts']);

export const outpassRequestAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { p } = await requireStudent();
    const from = s(fd, 'from');
    const to = s(fd, 'to');
    if (!from || !to) throw new SchoolError('Give the times.');
    await requestOutpass(p.studentId, { from: new Date(`${from}:00+05:30`).toISOString(), to: new Date(`${to}:00+05:30`).toISOString(), reason: s(fd, 'reason') ?? 'Personal' });
    return 'Requested. Your parent approves it in the app, then the warden.';
  }, ['/app/outpass']);

export const complaintAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { p } = await requireStudent();
    const cat = s(fd, 'category');
    await addComplaint(`student:${p.studentId}`, { studentId: p.studentId, category: cat === 'food' || cat === 'room' || cat === 'cleanliness' || cat === 'safety' ? cat : 'other', text: s(fd, 'text') ?? '' });
    return 'Sent to the warden.';
  }, ['/app/outpass']);

// ---------------------------------------------------------------- parent
export const parentOutpassAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { u } = await requireParent();
    await parentDecideOutpass(u.phone, s(fd, 'id') ?? '', fd.get('decision') === 'approve');
    return fd.get('decision') === 'approve' ? 'Approved. The warden gives the final approval.' : 'Declined.';
  }, ['/app/outpass']);

export const bookPtmAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { u, p } = await requireParent();
    await bookPtm(u.phone, p.studentId, s(fd, 'slotId') ?? '');
    return 'Booked. See you then.';
  }, ['/app/ptm']);

export const messageTeacherAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { u, p } = await requireParent();
    const text = s(fd, 'text');
    if (!text) throw new SchoolError('Write a message.');
    await sendParentMessage(u.phone, p.studentId, text.slice(0, 2000));
    return 'Sent.';
  }, ['/app/messages']);

/** Starts a Razorpay checkout for the next instalment (or a chosen amount up to what is due). */
export async function startPaymentAction(_: unknown, fd: FormData): Promise<{ error?: string; order?: { id: string; amount: number; key: string; name: string; leadId: string } }> {
  const { p } = await requireEnrolled();
  if (!paymentsConfigured()) return { error: 'Online payment is not switched on yet. Please pay at the college office.' };
  const d = await duesForStudent(p.studentId);
  const next = d?.rows.find((r) => r.outstanding > 0);
  if (!next) return { error: 'Nothing is due right now.' };
  const order = await createOrder(next.outstanding, `${p.collegeId}-${next.due}`, { leadId: p.leadId, studentId: p.studentId });
  return { order: { id: order.id, amount: order.amount, key: publicKeyId()!, name: p.name, leadId: p.leadId } };
}

export async function confirmPaymentAction(fd: FormData) {
  const { p } = await requireEnrolled();
  const orderId = String(fd.get('orderId') ?? '');
  const paymentId = String(fd.get('paymentId') ?? '');
  const signature = String(fd.get('signature') ?? '');
  const amount = Number(fd.get('amount') ?? 0) / 100;
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) redirect('/app/fees?paid=invalid');
  await recordGatewayPayment(p.leadId, amount, paymentId, String(fd.get('method') ?? 'upi'));
  redirect('/app/fees?paid=1');
}

// ---------------------------------------------------------------- applicant
export const applicationAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { u, p } = await requireApplicant();
    const submit = fd.get('submit') === '1';
    await saveApplication(p.leadId, u.phone, Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'submit')), submit);
    return submit ? 'Application submitted. The admission office will verify it.' : 'Saved as a draft.';
  }, ['/app/apply', '/app']);

export const uploadDocAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { p } = await requireApplicant();
    const file = fd.get('file');
    if (!(file instanceof File)) throw new SchoolError('Choose a file.');
    await uploadDocument(p.leadId, s(fd, 'key') ?? '', file);
    return 'Uploaded. The admission office will verify it.';
  }, ['/app/documents']);

export const rescheduleAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const { u, p } = await requireApplicant();
    await rescheduleVisit(p.leadId, p.name, u.phone, s(fd, 'date') ?? '', s(fd, 'slot') ?? '');
    return 'Visit rescheduled. You’ll get a WhatsApp confirmation.';
  }, ['/app']);

// ---------------------------------------------------------------- alumni
export const alumniAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const u = await requireAppUser();
    const year = Number(fd.get('passedOut'));
    if (!s(fd, 'name') || !Number.isInteger(year) || year < 2000 || year > 2100) throw new SchoolError('Enter your name and the year you passed out.');
    await joinAlumni(u.phone, { name: s(fd, 'name')!, passedOut: year, nowAt: s(fd, 'nowAt'), course: s(fd, 'course'), mentorWilling: fd.get('mentor') === 'on', story: s(fd, 'story'), studentId: null });
    return 'Saved. The college approves alumni profiles before they appear.';
  }, ['/app/alumni']);

export const referAction = async (_: AppState, fd: FormData): Promise<AppState> =>
  run(async () => {
    const u = await requireAppUser();
    const me = u.profiles.find((x) => x.kind === 'alumni')?.name ?? u.active?.name ?? 'an alumnus';
    if (!s(fd, 'name') || !s(fd, 'phone')) throw new SchoolError('Give the family’s name and mobile number.');
    await referFamily(me, { name: s(fd, 'name')!, phone: s(fd, 'phone')!, note: s(fd, 'note') });
    return 'Thank you. An admission counsellor will call them.';
  }, ['/app/alumni']);
