import 'server-only';
import { redirect } from 'next/navigation';
import { getAppUser } from '../app/service';
import { getStaffSession } from '../crm/auth';
import { batchOf } from '../school/common';
import { profileOf, saveProfile } from './challenge';
import { studentActor } from './core';
import { defaultExamFor } from './path';

/**
 * Who is using Open Book. Students use it from the Student & Parent app (their College ID login); every
 * private record is keyed by their studentId and every read/write checks it. Parents get a progress summary
 * only. Staff use the CRM screens. Applicants and alumni don't have access (college-only content).
 */
export async function obStudent() {
  const u = await getAppUser();
  if (!u) redirect('/app/login');
  const p = u.active;
  if (!p || p.kind !== 'student') redirect('/app/openbook');
  const [batch, prof] = await Promise.all([batchOf(p.studentId), profileOf(p.studentId)]);
  const examId = await defaultExamFor(p.studentId);
  return {
    studentId: p.studentId, name: p.name, collegeId: p.collegeId, batchId: batch?.id ?? null, program: `${batch?.data.program ?? ''}`,
    examIds: examId === 'neet-ug' ? ['neet-ug', 'inter1-bipc', 'inter2-bipc', 'eapcet-am'] : ['jee-main', 'jee-advanced', 'inter1-mpc', 'inter2-mpc', 'eapcet-e'],
    defaultExam: examId, actor: studentActor(p.studentId, prof?.nickname ?? p.name), profile: prof ?? (await saveProfile(p.studentId, {})),
  };
}
export type ObStudent = Awaited<ReturnType<typeof obStudent>>;

/** For API routes: the signed-in student id or staff member, without redirecting. */
export async function whoIsAsking(): Promise<{ studentId: string | null; staff: Awaited<ReturnType<typeof getStaffSession>> }> {
  const [u, staff] = await Promise.all([getAppUser().catch(() => null), getStaffSession().catch(() => null)]);
  return { studentId: u?.active?.kind === 'student' ? u.active.studentId : null, staff };
}
