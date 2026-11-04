import 'server-only';
import { getAppStore } from '../app/service';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import type { StudentRow } from '../crm/verification';
import { getRecordStore } from '../records';
import { batches, buses, hostelRooms, mentorships, timetable } from '../records/collections';
import type { Rec } from '../records/types';

/** Shared scoping for the school portals (§9A.4 data scoping: faculty their batches, mentors their students). */
export class SchoolError extends Error {}

export const store = () => getRecordStore();

export type Batch = Rec<(typeof batches)['schema']['_output']>;

export async function allStudents(): Promise<StudentRow[]> {
  return getAppStore().listStudents();
}

export async function allBatches() {
  return (await batches.list(store())).sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function batchOf(studentId: string): Promise<Batch | null> {
  return (await allBatches()).find((b) => b.data.active && b.data.studentIds.includes(studentId)) ?? null;
}

/** Batches a teacher teaches (timetable) or is class teacher of. */
export async function myBatchIds(user: Pick<Staff, 'id'>): Promise<Set<string>> {
  const [periods, all] = await Promise.all([timetable.list(store(), { k2: user.id }), allBatches()]);
  return new Set([...periods.map((p) => p.data.batchId), ...all.filter((b) => b.data.classTeacherId === user.id).map((b) => b.id)]);
}

export async function canTeachBatch(user: Staff, batchId: string) {
  if (can(user, 'academics.manage')) return true;
  return (await myBatchIds(user)).has(batchId);
}

export async function requireTeaches(user: Staff, batchId: string) {
  if (!(await canTeachBatch(user, batchId))) throw new SchoolError('You don’t teach this batch.');
}

export async function menteeIds(mentorId: string) {
  return new Set((await mentorships.list(store(), { k1: mentorId })).map((m) => m.data.studentId));
}

/**
 * Which students this staff member may see: everyone (heads, office), or only their own (faculty → their
 * batches, mentors → mentees and their class, warden → hostellers, transport → students on their buses).
 */
export async function visibleStudentIds(user: Staff): Promise<Set<string> | 'all'> {
  if (!can(user, 'students.view')) return new Set();
  const role = user.roles[0];
  if (['faculty', 'class_teacher'].includes(role)) {
    const ids = new Set<string>();
    const mine = await myBatchIds(user);
    for (const b of await allBatches()) if (mine.has(b.id)) b.data.studentIds.forEach((s) => ids.add(s));
    if (role === 'class_teacher') (await menteeIds(user.id)).forEach((s) => ids.add(s));
    return ids;
  }
  if (role === 'hostel_warden') return new Set((await allStudents()).filter((s) => s.stay === 'hostel').map((s) => s.id));
  if (role === 'transport_incharge') return new Set((await buses.list(store())).flatMap((b) => b.data.studentIds));
  return 'all';
}

export async function requireSeesStudent(user: Staff, studentId: string) {
  const v = await visibleStudentIds(user);
  if (v !== 'all' && !v.has(studentId)) throw new SchoolError('Student not found.');
}

export async function studentsById() {
  return new Map((await allStudents()).map((s) => [s.id, s]));
}

export async function roomOf(studentId: string) {
  return (await hostelRooms.list(store())).find((r) => r.data.studentIds.includes(studentId)) ?? null;
}

export const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;
