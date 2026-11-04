'use server';
import { revalidatePath } from 'next/cache';
import { requireParent, requireStudent } from '@/lib/app/portal';
import { isIsoDate } from '@/lib/dates';
import { applyStudentLeave } from '@/lib/school/backoffice';
import { setGoal, submitSession } from '@/lib/practice/service';
import { SchoolError } from '@/lib/school/common';

export interface PracticeResult {
  error?: string;
  results?: { id: string; stem: string; options: string[]; chosen: number; answer: number; correct: boolean; xp: number; solution: string; misconception: string | null }[];
}

/** Marks a practice session instantly (Eduten-style) and stores every attempt. Students only. */
export async function submitPracticeAction(_: PracticeResult, fd: FormData): Promise<PracticeResult> {
  const { p } = await requireStudent();
  const answers: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('q:') && typeof v === 'string') answers[k.slice(2)] = Number(v);
  const setId = typeof fd.get('setId') === 'string' && fd.get('setId') ? String(fd.get('setId')) : null;
  try {
    const results = await submitSession(p.studentId, answers, setId);
    revalidatePath('/app/practice');
    return { results };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    console.error('[practice] submit failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

/** Parent applies for leave for a day-scholar child; it goes to the class teacher. */
export async function applyLeaveAction(_: { ok?: boolean; error?: string; message?: string }, fd: FormData) {
  const { u, p } = await requireParent();
  const from = String(fd.get('from') ?? '');
  const to = String(fd.get('to') ?? '') || from;
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: 'Choose valid dates.' };
  try {
    const message = await applyStudentLeave(p.studentId, u.phone, { from, to, reason: String(fd.get('reason') ?? '') });
    revalidatePath('/app/leave');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    throw e;
  }
}

export async function setGoalAction(_: { ok?: boolean; error?: string; message?: string }, fd: FormData) {
  const { p } = await requireStudent();
  const questions = Number(fd.get('questions'));
  const accuracy = Number(fd.get('accuracy'));
  if (!Number.isInteger(questions) || questions < 5 || questions > 500) return { error: 'Choose 5 to 500 questions.' };
  if (!Number.isInteger(accuracy) || accuracy < 10 || accuracy > 100) return { error: 'Choose an accuracy between 10 and 100%.' };
  const message = await setGoal(p.studentId, { questions, accuracy });
  revalidatePath('/app/practice');
  return { ok: true, message };
}
