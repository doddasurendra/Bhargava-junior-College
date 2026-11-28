'use server';
import { revalidatePath } from 'next/cache';
import { requireStudent } from '@/lib/app/portal';
import { SchoolError } from '@/lib/school/common';
import { requestMeeting } from '@/lib/school/mentorMeetings';
import type { AppState } from './portal-actions';

export async function requestMeetingAction(_: AppState, fd: FormData): Promise<AppState> {
  try {
    const { p } = await requireStudent();
    const reason = String(fd.get('reason') ?? '').trim();
    if (reason.length < 3) return { error: 'Write a line about what you want to discuss.' };
    await requestMeeting(p.studentId, reason);
    revalidatePath('/app/mentor');
    return { ok: true, message: 'Request sent. Your mentor will set a time.' };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    console.error('[mentor request] failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
