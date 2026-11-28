'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { SchoolError } from '@/lib/school/common';
import * as M from '@/lib/school/mentorMeetings';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : ''; };
async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath('/crm/mentor');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[mentor meetings] failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export const scheduleMeetingAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await M.scheduleMeeting(await requireStaff(), { studentId: s(fd, 'studentId'), date: s(fd, 'date'), time: s(fd, 'time'), mode: s(fd, 'mode') || 'in_person', agenda: s(fd, 'agenda') }); return 'Meeting scheduled. The student and parents see it in the app.'; });
export const setMeetingTimeAction = async (_: ActionState, fd: FormData) =>
  run(async () => { await M.setMeetingTime(await requireStaff(), s(fd, 'id'), s(fd, 'date'), s(fd, 'time'), s(fd, 'mode') || 'in_person'); return 'Time set.'; });
export const closeMeetingAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const status = s(fd, 'status');
    if (!['held', 'missed', 'cancelled'].includes(status)) throw new SchoolError('Pick what happened.');
    await M.closeMeeting(await requireStaff(), s(fd, 'id'), status as 'held' | 'missed' | 'cancelled', s(fd, 'outcome') || null, fd.get('share') === 'on');
    return status === 'held' ? 'Saved. The outcome was added to the mentor notes.' : 'Saved.';
  });
