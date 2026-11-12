'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireEnrolled, requireStudent } from '@/lib/app/portal';
import { SchoolError } from '@/lib/school/common';
import * as SP from '@/lib/studentLife/sports';
import * as SE from '@/lib/studentLife/sessions';
import * as W from '@/lib/studentLife/wellbeing';
import * as OB from '@/lib/studentLife/openbook';
import type { AppState } from './portal-actions';

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

async function run(fn: () => Promise<string>, paths: string[]): Promise<AppState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[app student-life] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ---------------------------------------------------------------- sports
export async function signUpSportForm(fd: FormData) {
  const { p } = await requireStudent();
  await SP.signUp(p.studentId, String(fd.get('sport') ?? '')).catch(() => undefined);
  revalidatePath('/app/sports');
}

// ---------------------------------------------------------------- sessions
export async function registerSessionForm(fd: FormData) {
  const { u, p } = await requireEnrolled();
  const id = String(fd.get('sessionId') ?? '');
  await SE.register(id, p.kind === 'student' ? { kind: 'student', studentId: p.studentId } : { kind: 'parent', phone: u.phone, studentId: p.studentId }).catch((e) => console.info('[sessions]', (e as Error).message));
  revalidatePath('/app/sessions');
}
export const feedbackAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    const { u, p } = await requireEnrolled();
    await SE.giveFeedback(String(fd.get('sessionId') ?? ''), p.kind === 'student' ? p.studentId : u.phone, Number(fd.get('rating') ?? 0), s(fd, 'comment'));
    return 'Thank you for your feedback.';
  }, ['/app/sessions']);

// ---------------------------------------------------------------- wellbeing (student only)
export async function wellbeingConsentForm(fd: FormData) {
  const { p } = await requireStudent();
  await W.giveConsent(p.studentId, fd.get('share') === 'on');
  revalidatePath('/app/wellbeing');
}
export const checkinAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    const { p } = await requireStudent();
    const r = await W.submitCheckin(p.studentId, { mood: Number(fd.get('mood')), sleepHours: Number(fd.get('sleep')), stress: Number(fd.get('stress')), note: s(fd, 'note') });
    return r.safety ? r.safety.message : 'Saved. Only you and the college counsellor can see your check-ins.';
  }, ['/app/wellbeing']);
export async function deleteCheckinForm(fd: FormData) {
  const { p } = await requireStudent();
  await W.deleteMyCheckin(p.studentId, String(fd.get('id') ?? '')).catch(() => undefined);
  revalidatePath('/app/wellbeing');
}
export const bookCounsellorAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    const { p } = await requireStudent();
    await W.bookCounsellor(p.studentId, { date: String(fd.get('date') ?? ''), time: String(fd.get('time') ?? ''), mode: fd.get('mode') === 'call' ? 'call' : 'in_person', topic: s(fd, 'topic') });
    return 'Requested. The counsellor will confirm the slot. This booking is private.';
  }, ['/app/wellbeing']);
/** Anonymous: the ticket is kept only in this phone's cookie, so the answer can be shown back without a name. */
export const askAnonAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    await requireStudent();
    const text = s(fd, 'text');
    if (!text || text.length < 5) throw new SchoolError('Write your question.');
    const r = await W.askAnonymously(text.slice(0, 1000));
    const jar = cookies();
    const prev = (jar.get('bjc_anon')?.value ?? '').split('.').filter(Boolean).slice(-9);
    jar.set('bjc_anon', [...prev, r.ticket].join('.'), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/app', maxAge: 60 * 60 * 24 * 120 });
    return r.safety ? r.safety.message : 'Sent anonymously. The answer will appear here.';
  }, ['/app/wellbeing']);

// ---------------------------------------------------------------- open-book
export async function startOpenBookForm(fd: FormData) {
  const { p } = await requireStudent();
  const id = String(fd.get('assignmentId') ?? '');
  try {
    await OB.startAttempt(p.studentId, id, fd.get('pledge') === 'on');
  } catch (e) {
    redirect(`/app/open-book?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect(`/app/open-book/${id}`);
}
export const submitOpenBookAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    const { p } = await requireStudent();
    const answers: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith('a:') && typeof v === 'string') answers[k.slice(2)] = v;
    await OB.submitAttempt(p.studentId, String(fd.get('assignmentId') ?? ''), answers);
    return 'Submitted. Your teacher will mark it with the rubric.';
  }, ['/app/open-book']);
export const bigAnswerAction = async (_: AppState, fd: FormData) =>
  run(async () => {
    const { p } = await requireStudent();
    const text = s(fd, 'text');
    if (!text || text.length < 20) throw new SchoolError('Explain in a few sentences.');
    await OB.answerBigQuestion(p.studentId, String(fd.get('questionId') ?? ''), text);
    return 'Answer posted. The best explanations are featured each week.';
  }, ['/app/open-book']);
