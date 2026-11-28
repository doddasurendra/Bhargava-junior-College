'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import * as A from '@/lib/app/pendingAdmin';
import { importStudents } from '@/lib/app/studentImport';
import { StudentAccountError } from '@/lib/app/studentAccount';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath('/crm/students');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof StudentAccountError) return { error: e.message };
    console.error('[signup-admin] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export const verifyLinkAction = async (_: ActionState, fd: FormData) => run(async () => { const st = await A.verifyAndLink(await requireStaff(), s(fd, 'id'), s(fd, 'studentId')); return `Verified and linked to ${st.fullName} (${st.collegeId}). The account is active.`; });
export const mergeAction = async (_: ActionState, fd: FormData) => run(async () => { const st = await A.mergeSignup(await requireStaff(), s(fd, 'id'), s(fd, 'studentId')); return `Merged into ${st.fullName} (${st.collegeId}); the older account was disabled.`; });
export const createNewAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await A.createFromSignup(await requireStaff(), s(fd, 'id'), { collegeId: s(fd, 'collegeId'), program: s(fd, 'program'), gender: s(fd, 'gender'), stay: s(fd, 'stay'), guardianName: s(fd, 'guardianName'), guardianPhone: s(fd, 'guardianPhone') });
    return 'Student created from the sign-up and linked. The account is active.';
  });
export const rejectAction = async (_: ActionState, fd: FormData) => run(async () => { await A.rejectSignup(await requireStaff(), s(fd, 'id'), s(fd, 'reason')); return 'Sign-up rejected; the account was disabled.'; });
export const messageAction = async (_: ActionState, fd: FormData) => run(async () => { await A.messageSignup(await requireStaff(), s(fd, 'id'), s(fd, 'text')); return 'Message sent. The student sees it on their home screen.'; });
export const markTestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const isTest = s(fd, 'test') === '1';
    const pendingIds = fd.getAll('pendingIds').map(String).filter(Boolean);
    const studentIds = fd.getAll('studentIds').map(String).filter(Boolean);
    if (!pendingIds.length && !studentIds.length) throw new StudentAccountError('Tick at least one row.');
    await A.markTest(await requireStaff(), { pendingIds, studentIds }, isTest);
    return `${pendingIds.length + studentIds.length} record(s) ${isTest ? 'marked as test' : 'no longer marked as test'}.`;
  });
export const deleteTestAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    if (s(fd, 'confirm') !== 'DELETE') throw new StudentAccountError('Type DELETE to confirm.');
    const r = await A.deleteTestSignups(await requireStaff(), Number(s(fd, 'count')));
    return `Deleted ${r.signups} test sign-up(s) and ${r.accounts} test account(s). Student records were not touched.`;
  });
export const addStudentAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const u = await requireStaff();
    const input = A.validateNewStudent({ fullName: s(fd, 'fullName'), collegeId: s(fd, 'collegeId'), dob: s(fd, 'dob'), gender: s(fd, 'gender'), program: s(fd, 'program'), stay: s(fd, 'stay'), guardianName: s(fd, 'guardianName'), guardianPhone: s(fd, 'guardianPhone'), relation: s(fd, 'relation') });
    const r = await A.addStudent(u, input);
    return `Student added (${input.collegeId}).${r.linked ? ' A matching pending sign-up was linked and is now active.' : ''}${r.conflicts ? ' A pending sign-up with other details went to Conflicts.' : ''}`;
  });
export const importStudentsAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    const f = fd.get('file');
    if (!(f instanceof File) || !f.size) throw new StudentAccountError('Choose an Excel (.xlsx) or CSV file.');
    if (f.size > 5 * 1024 * 1024) throw new StudentAccountError('The file is larger than 5 MB.');
    const r = await importStudents(await requireStaff(), f.name, Buffer.from(await f.arrayBuffer()));
    return `Import done: ${r.total} rows · ${r.created} new · ${r.linked} pending sign-ups linked · ${r.conflicts} conflicts · ${r.existing} already present · ${r.failed} failed. See the report below.`;
  });
