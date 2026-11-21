import type { Role, Staff } from '../crm/types';

/**
 * Knowledge Hub access model (§0.4, §20). Every article, file, chunk and centre carries ONE access level and
 * one sensitivity label. A viewer may read an item only when BOTH allow it. The same check runs on every
 * screen, every download and — before anything reaches the AI — on every retrieved chunk (§20 "AI permission
 * filter"). Data lives in the service-role-only `records` table (RLS on, no policies: the browser can never
 * read it directly), so this server check is the only door.
 */

export const LEVELS = ['public', 'student', 'parent', 'faculty', 'subject_head', 'principal', 'management', 'admissions', 'accounts', 'admin'] as const;
export type Level = (typeof LEVELS)[number];

export const SENSITIVITY = ['public', 'internal', 'confidential', 'restricted'] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];

export type Viewer =
  | { kind: 'public' }
  | { kind: 'student'; studentId: string; collegeId?: string | null }
  | { kind: 'parent'; studentIds: string[]; phone: string }
  | { kind: 'staff'; user: Staff; subjectHeadOf?: string[] };

const STAFF_BASE: Level[] = ['public', 'student', 'parent'];
const TEACHING: Role[] = ['faculty', 'class_teacher', 'academic_coordinator', 'sports_coach', 'student_counsellor', 'hostel_warden'];
const ADMISSIONS: Role[] = ['admission_manager', 'admission_counsellor', 'telecaller', 'front_desk', 'admission_office', 'data_executive'];

/** The levels one role may read. */
export function levelsForRole(role: Role, subjectHead = false): Level[] {
  if (role === 'developer' || role === 'super_admin' || role === 'management') return [...LEVELS];
  const out = new Set<Level>(STAFF_BASE);
  if (TEACHING.includes(role)) out.add('faculty');
  if (subjectHead) {
    out.add('faculty');
    out.add('subject_head');
  }
  if (role === 'principal') ['faculty', 'subject_head', 'principal', 'admissions'].forEach((l) => out.add(l as Level));
  if (ADMISSIONS.includes(role)) out.add('admissions');
  if (role === 'accounts') out.add('accounts');
  if (role === 'admin_office') out.add('admin');
  if (role === 'transport_incharge') out.add('admin');
  return [...out];
}

export function allowedLevels(v: Viewer): Level[] {
  switch (v.kind) {
    case 'public':
      return ['public'];
    case 'student':
      return ['public', 'student'];
    case 'parent':
      return ['public', 'parent'];
    case 'staff': {
      // only the ACTIVE role counts (a multi-role user works in one role at a time)
      const role = v.user.roles[0];
      return role ? levelsForRole(role, (v.subjectHeadOf ?? []).length > 0) : ['public'];
    }
  }
}

const isLeader = (v: Viewer) => v.kind === 'staff' && ['developer', 'super_admin', 'management', 'principal'].includes(v.user.roles[0]);

/** Sensitivity on top of the level: confidential never reaches families; restricted only leadership or the owner. */
export function sensitivityAllows(v: Viewer, s: Sensitivity, ownerId?: string | null) {
  if (s === 'public' || s === 'internal') return s === 'public' || v.kind === 'staff' || v.kind === 'student' || v.kind === 'parent';
  if (v.kind !== 'staff') return false;
  if (s === 'confidential') return true;
  return isLeader(v) || (!!ownerId && ownerId === v.user.id);
}

export interface Guarded {
  access: Level;
  sensitivity: Sensitivity;
  ownerId?: string | null;
}

export function canRead(v: Viewer, item: Guarded) {
  if (!allowedLevels(v).includes(item.access)) return false;
  // "internal" means "signed-in people only": never the anonymous website
  if (item.sensitivity === 'internal' && v.kind === 'public') return false;
  return sensitivityAllows(v, item.sensitivity, item.ownerId);
}

/** Watermark downloads of confidential and restricted PDFs (§20). */
export const needsWatermark = (s: Sensitivity) => s === 'confidential' || s === 'restricted';

export const viewerKey = (v: Viewer) => (v.kind === 'staff' ? `staff:${v.user.id}` : v.kind === 'student' ? `student:${v.studentId}` : v.kind === 'parent' ? `parent:${v.phone}` : 'public');
export const viewerRole = (v: Viewer) => (v.kind === 'staff' ? v.user.roles[0] ?? 'staff' : v.kind);

/** Mask any Indian mobile number in text sent to people (or the public bot) who don't need it (§20 PII). */
export function maskPhones(text: string) {
  return text.replace(/(\+?91[\s-]?)?([6-9]\d)\d{4}(\d{4})\b/g, (_m, cc, a, b) => `${cc ?? ''}${a}XXXX${b}`);
}
