'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { isIsoDate } from '@/lib/dates';
import * as B from '@/lib/school/backoffice';
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
const date = (fd: FormData, k: string, label: string) => {
  const v = req(fd, k, label);
  if (!isIsoDate(v)) throw new SchoolError(`${label}: use a valid date.`);
  return v;
};

async function run(fn: () => Promise<string>, paths: string[]): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[backoffice] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export const addBookAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.addBook(user, { title: req(fd, 'title', 'Title'), author: s(fd, 'author'), subject: s(fd, 'subject'), isbn: s(fd, 'isbn'), shelf: s(fd, 'shelf'), copies: Number(fd.get('copies') ?? 1) }), ['/crm/library']);
};

export const issueBookAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.issueBook(user, req(fd, 'bookId', 'Book'), req(fd, 'studentId', 'Student')), ['/crm/library']);
};

export const returnBookAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.returnBook(user, req(fd, 'loanId', 'Loan')), ['/crm/library']);
};

export const addEventAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(async () => {
    const end = s(fd, 'endDate');
    if (end && !isIsoDate(end)) throw new SchoolError('End date: use a valid date.');
    return B.addEvent(user, { title: req(fd, 'title', 'Title'), date: date(fd, 'date', 'Date'), endDate: end, kind: req(fd, 'kind', 'Type'), audience: req(fd, 'audience', 'For'), location: s(fd, 'location'), note: s(fd, 'note') });
  }, ['/crm/events']);
};

export const removeEventAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.removeEvent(user, req(fd, 'id', 'Event')), ['/crm/events']);
};

export const setHomeworkAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.setHomework(user, { batchId: req(fd, 'batchId', 'Batch'), subject: req(fd, 'subject', 'Subject'), title: req(fd, 'title', 'Title'), details: s(fd, 'details'), dueOn: date(fd, 'dueOn', 'Due date') }), ['/crm/homework']);
};

export const decideStudentLeaveAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.decideStudentLeave(user, req(fd, 'id', 'Application'), fd.get('decision') === 'approve', s(fd, 'note')), ['/crm/homework']);
};

export const removeHomeworkAction = async (_: ActionState, fd: FormData) => {
  const user = await requireStaff();
  return run(() => B.removeHomework(user, req(fd, 'id', 'Homework')), ['/crm/homework']);
};
