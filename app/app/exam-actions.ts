'use server';
import { redirect } from 'next/navigation';
import { closedSave, closedSubmit, recordEvent, startClosedAttempt } from '@/lib/openbook/closedExam';
import { OpenBookError } from '@/lib/openbook/core';
import { obStudent } from '@/lib/openbook/session';

type R<T = unknown> = { error?: string; data?: T };
async function run<T>(fn: () => Promise<T>): Promise<R<T>> {
  try { return { data: await fn() }; } catch (e) {
    if (e instanceof OpenBookError) return { error: e.message };
    console.error('[exam] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

/** Starts (or resumes on the same device) and opens the exam screen. */
export async function startExamAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  let id: string;
  try { id = await startClosedAttempt(me.studentId, me.batchId, String(fd.get('mockId') ?? ''), String(fd.get('deviceId') ?? '')); } catch (e) {
    if (e instanceof OpenBookError) return { error: e.message };
    throw e;
  }
  redirect(`/app/exam/${id}`);
}

export async function saveExamAction(attemptId: string, deviceId: string, patch: { answers?: Record<string, string[]>; review?: string[]; time?: Record<string, number> }) {
  const me = await obStudent();
  return run(() => closedSave(me.studentId, attemptId, deviceId, patch));
}

export async function submitExamAction(attemptId: string, deviceId: string, auto: boolean) {
  const me = await obStudent();
  return run(() => closedSubmit(me.studentId, me.batchId, attemptId, deviceId, auto));
}

export async function examEventAction(attemptId: string, deviceId: string, kind: 'blur' | 'hidden' | 'fullscreen_exit') {
  const me = await obStudent();
  return run(() => recordEvent(me.studentId, me.batchId, attemptId, deviceId, kind));
}
