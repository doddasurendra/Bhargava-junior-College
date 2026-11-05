'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { SchoolError } from '@/lib/school/common';
import { setChapterStatus, type ChapterStatus } from '@/lib/school/syllabus';
import type { ActionState } from './actions';

export async function setChapterStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  try {
    const message = await setChapterStatus(user, { batchId: String(fd.get('batchId') ?? ''), subject: String(fd.get('subject') ?? ''), chapter: String(fd.get('chapter') ?? ''), status: String(fd.get('status') ?? '') as ChapterStatus });
    revalidatePath('/crm/syllabus');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    console.error('[syllabus] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
