'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { createClosedExam } from '@/lib/openbook/closedExam';
import { OpenBookError } from '@/lib/openbook/core';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const n = (fd: FormData, k: string) => { const v = s(fd, k); return v === null ? null : Number(v); };
const list = (fd: FormData, k: string) => (s(fd, k) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
/** <input type="datetime-local"> is college time (IST). */
const ist = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? new Date(`${v}:00+05:30`).toISOString() : null);

export async function createExamAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireStaff();
  try {
    if (!s(fd, 'title')) throw new OpenBookError('Give the exam a title.');
    const subjects = fd.getAll('subjects').map(String).filter(Boolean);
    const id = await createClosedExam(u, s(fd, 'batchId') ?? '', {
      title: s(fd, 'title') ?? '', examId: s(fd, 'examId') ?? '', subjects, chapters: list(fd, 'chapters'), concepts: [],
      count: n(fd, 'count') ?? 30, difficulty: null, minutes: n(fd, 'minutes'), marks: n(fd, 'marks'), negative: n(fd, 'negative'),
      source: s(fd, 'source') === 'pattern' ? 'pattern' : 'pool',
    }, {
      fullscreen: fd.get('fullscreen') === 'on', maxFocusLoss: Math.max(0, Math.min(20, n(fd, 'maxFocusLoss') ?? 3)), shuffleQuestions: fd.get('shuffleQuestions') === 'on', shuffleOptions: fd.get('shuffleOptions') === 'on',
      singleDevice: fd.get('singleDevice') === 'on', showAnswers: fd.get('showAnswers') === 'on', opensAt: ist(s(fd, 'opensAt')), closesAt: ist(s(fd, 'closesAt')),
    });
    revalidatePath('/crm/exams');
    return { ok: true, message: `Exam created (id ${id.slice(0, 8)}). Students of the batch see it under Closed-book exams.` };
  } catch (e) {
    if (e instanceof OpenBookError) return { error: e.message };
    console.error('[exam] create failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
