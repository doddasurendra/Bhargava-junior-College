'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { SchoolError } from '@/lib/school/common';
import * as S from '@/lib/school/staffAttendance';
import type { ActionState } from './actions';

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? String(fd.get(k)).trim() : '');

async function run(fn: () => Promise<string>, paths: string[]): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof SchoolError) return { error: e.message };
    if (e instanceof Error && /permission/i.test(e.message)) return { error: e.message };
    console.error('[staff] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export const checkInAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    void fd;
    return `Checked in at ${await S.checkIn(await requireStaff())}.`;
  }, ['/crm/my-attendance']);

export const checkOutAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    void fd;
    return `Checked out at ${await S.checkOut(await requireStaff())}.`;
  }, ['/crm/my-attendance']);

export const markStaffAction = async (_: ActionState, fd: FormData) =>
  run(async () => {
    await S.markStaff(await requireStaff('staff.attendance'), str(fd, 'staffId'), str(fd, 'date'), str(fd, 'status'), str(fd, 'reason'));
    return 'Saved. The change is recorded with your name and reason.';
  }, ['/crm/staff-attendance']);
