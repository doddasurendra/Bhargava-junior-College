'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { decideCorrection, markSubjectAttendance, notifyLowAttendance } from '@/lib/school/attendanceTools';
import { isIsoDate } from '@/lib/dates';
import { SchoolError } from '@/lib/school/common';
import { aiStudentSummary, canReadStudent, studentPerformance } from '@/lib/school/performance';
import { AiNotConfigured } from '@/lib/openbook/llm';
import { OpenBookError } from '@/lib/openbook/core';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

async function run(fn: () => Promise<string>, paths: string[] = []): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError || e instanceof AiNotConfigured) return { error: e.message };
    console.error('[analytics] action failed', e);
    // AI errors carry a safe, specific message (no credit, model unavailable, busy)
    if (e instanceof OpenBookError) return { error: e.message };
    return { error: 'Something went wrong. Please try again.' };
  }
}

/** Subject-wise (period) register. */
export const markSubjectAttendanceAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff('attendance.mark');
    const marks: Record<string, string> = {};
    const remarks: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v !== 'string') continue;
      if (k.startsWith('m:')) marks[k.slice(2)] = v;
      else if (k.startsWith('r:')) remarks[k.slice(2)] = v;
    }
    const subject = s(fd, 'subject');
    if (!subject) throw new SchoolError('Choose the subject.');
    const r = await markSubjectAttendance(user, s(fd, 'batchId') ?? '', s(fd, 'date') ?? '', subject, marks, remarks, s(fd, 'reason') ?? '');
    if (r.requested) return `Correction request sent for approval (${r.requested} change${r.requested === 1 ? '' : 's'}).`;
    return r.corrected === null ? `${subject} attendance saved.` : r.corrected === 0 ? 'No marks changed.' : `${subject} register corrected: ${r.corrected} change${r.corrected === 1 ? '' : 's'} recorded.`;
  }, ['/crm/academics/batch', '/crm/analytics']);

/** Academic head: approve / reject an attendance correction request. */
export const decideCorrectionAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff();
    const decision = s(fd, 'decision') === 'approve' ? 'approve' : 'reject';
    await decideCorrection(user, s(fd, 'id') ?? '', decision, s(fd, 'note'));
    return decision === 'approve' ? 'Approved: the register is corrected and the change is logged.' : 'Rejected.';
  }, ['/crm/analytics', '/crm/academics/overview']);

/** Optional AI wording of a student's computed analysis (needs ANTHROPIC_API_KEY). */
export const aiSummaryAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const user = await requireStaff();
    const id = s(fd, 'studentId') ?? '';
    if (!(await canReadStudent(user, id))) throw new SchoolError('You can’t see this student.');
    const p = await studentPerformance(id);
    if (!p || !p.exams.length) throw new SchoolError('No published results yet, so there is nothing to summarise.');
    const r = await aiStudentSummary(p);
    return `${r.summary}${r.focus.length ? `\n\nFocus: ${r.focus.join(' · ')}` : ''}`;
  });

export async function notifyLowAttendanceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const g = (k: string) => String(fd.get(k) ?? '');
    if (!isIsoDate(g('from')) || !isIsoDate(g('to'))) return { error: 'Pick a valid date range first.' };
    const r = await notifyLowAttendance(await requireStaff(), { from: g('from'), to: g('to'), batchId: g('batch') || null, subject: g('subject') || null, threshold: Math.min(100, Math.max(1, Number(g('threshold')) || 75)) });
    return { ok: true, message: `Sent to ${r.sent} famil${r.sent === 1 ? 'y' : 'ies'} in the app's Messages${r.skipped ? `; ${r.skipped} already alerted today` : ''}.` };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    console.error('[low attendance] failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}