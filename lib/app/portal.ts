import 'server-only';
import { redirect } from 'next/navigation';
import { getCrmRepo } from '../crm/repo';
import { SchoolError } from '../school/common';
import type { Profile } from './types';
import { requireAppUser, type AppUser } from './service';

/**
 * Scoping for the Student & Parent app (§9A.3: parents see only their linked children; students only their
 * own data). Every portal page and action goes through one of these.
 */
export type Enrolled = Extract<Profile, { kind: 'parent' | 'student' }>;

export async function requireEnrolled(): Promise<{ u: AppUser; p: Enrolled }> {
  const u = await requireAppUser();
  const p = u.active;
  if (!p || (p.kind !== 'parent' && p.kind !== 'student')) redirect('/app');
  return { u, p };
}

export async function requireStudent(): Promise<{ u: AppUser; p: Extract<Profile, { kind: 'student' }> }> {
  const { u, p } = await requireEnrolled();
  if (p.kind !== 'student') throw new SchoolError('This is for the student’s own login.');
  return { u, p };
}

export async function requireParent(): Promise<{ u: AppUser; p: Extract<Profile, { kind: 'parent' }> }> {
  const { u, p } = await requireEnrolled();
  if (p.kind !== 'parent') throw new SchoolError('This is for parents and guardians.');
  return { u, p };
}

export async function requireApplicant(): Promise<{ u: AppUser; p: Extract<Profile, { kind: 'applicant' }> }> {
  const u = await requireAppUser();
  const p = u.active;
  if (p?.kind !== 'applicant') redirect('/app');
  return { u, p };
}

/** Upcoming visit for an applicant, to show and to reschedule. */
export async function applicantVisit(leadId: string) {
  return (await getCrmRepo().getLeadHistory(leadId)).visits.filter((v) => v.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}
