'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { isIsoDate } from '@/lib/dates';
import { chaptersOf, SUBJECTS, type Difficulty, type Subject } from '@/lib/practice/bank';
import * as P from '@/lib/practice/service';
import { SchoolError } from '@/lib/school/common';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const req = (fd: FormData, k: string, label: string) => {
  const v = s(fd, k);
  if (!v) throw new SchoolError(`${label} is required.`);
  return v;
};
/** "Subject|Chapter" from the chapter picker, validated against the bank. */
const chapterOf = (fd: FormData) => {
  const [subject, chapter] = req(fd, 'chapter', 'Chapter').split('|');
  if (!SUBJECTS.includes(subject as Subject) || !chaptersOf(subject as Subject).includes(chapter)) throw new SchoolError('Choose a chapter.');
  return { subject, chapter };
};
const count = (fd: FormData) => Math.min(30, Math.max(3, Number(fd.get('count') ?? 5) || 5));

async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath('/crm/practice');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[practice] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export const assignSetAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(async () => {
    const d = req(fd, 'difficulty', 'Level');
    if (!['easy', 'medium', 'hard'].includes(d)) throw new SchoolError('Choose a level.');
    return P.assignSet(user, { batchId: req(fd, 'batchId', 'Batch'), ...chapterOf(fd), difficulty: d as Difficulty, count: count(fd) });
  });
};

export const differentiateAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => P.differentiateSet(user, { batchId: req(fd, 'batchId', 'Batch'), ...chapterOf(fd), count: count(fd) }));
};

export const addLessonAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(async () => {
    const date = req(fd, 'date', 'Date');
    if (!isIsoDate(date)) throw new SchoolError('Date: use a valid date.');
    return P.addLesson(user, { batchId: req(fd, 'batchId', 'Batch'), subject: req(fd, 'subject', 'Subject'), topic: req(fd, 'topic', 'Topic'), date, notes: s(fd, 'notes') });
  });
};

export const toggleLessonAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => P.toggleLesson(user, req(fd, 'id', 'Lesson')));
};

export const shareReportAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => P.shareWithParent(user, req(fd, 'studentId', 'Student')));
};
