import { z } from 'zod';
import type { RecordStore } from '../records/types';
import { DEFAULT_RULES, LOCKED_GRANTS, PERMISSIONS, type Matrix, type Permission } from './permissions';
import { ROLE_LABELS, ROLES, type Role } from './types';

/**
 * The editable permission matrix and custom roles (§9A.1 "admin console to create custom roles and edit
 * permissions without code", §9A.4 RBAC). Stored as one settings record; framework-free.
 */
export const SETTINGS = 'settings';
const RBAC_ID = 'rbac';

export interface CustomRole {
  key: `custom_${string}`;
  label: string;
  description: string | null;
}

export interface RbacConfig {
  matrix: Matrix;
  customRoles: CustomRole[];
  updatedBy: string | null;
  updatedAt: string | null;
}

const roleKey = z.string().regex(/^custom_[a-z0-9_]{2,30}$/);
const storedSchema = z.object({
  grants: z.record(z.array(z.string())),
  customRoles: z.array(z.object({ key: roleKey, label: z.string().trim().min(2).max(60), description: z.string().trim().max(200).nullable() })).max(40),
  updatedBy: z.string().nullable(),
});

export class RbacError extends Error {}

const builtin = new Set<string>(ROLES);

function withLocks(m: Matrix): Matrix {
  const out = { ...m };
  for (const { role, perm } of LOCKED_GRANTS) if (!(out[perm] as Role[]).includes(role)) out[perm] = [...(out[perm] as Role[]), role];
  return out;
}

export async function loadRbac(store: RecordStore): Promise<RbacConfig> {
  const r = await store.get<unknown>(SETTINGS, RBAC_ID);
  const parsed = r ? storedSchema.safeParse(r.data) : null;
  if (!parsed?.success) return { matrix: DEFAULT_RULES as Matrix, customRoles: [], updatedBy: null, updatedAt: null };
  const known = new Set<string>([...ROLES, ...parsed.data.customRoles.map((c) => c.key)]);
  const matrix = Object.fromEntries(PERMISSIONS.map((p) => [p, (parsed.data.grants[p] ?? (DEFAULT_RULES[p] as string[])).filter((x) => known.has(x))])) as Matrix;
  for (const c of parsed.data.customRoles) ROLE_LABELS[c.key] = c.label;
  return { matrix: withLocks(matrix), customRoles: parsed.data.customRoles as CustomRole[], updatedBy: parsed.data.updatedBy, updatedAt: r!.updatedAt };
}

export const slugRole = (label: string) => `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)}` as const;

/** Saves the matrix. Unknown roles/permissions are dropped; the Super Admin's locked grants always stay. */
export async function saveRbac(store: RecordStore, actor: { id: string; perms?: readonly string[] }, next: { grants: Record<string, string[]>; customRoles: CustomRole[] }) {
  if (!actor.perms?.includes('rbac.manage')) throw new RbacError('Only the Super Admin can change permissions.');
  const roles = storedSchema.shape.customRoles.safeParse(next.customRoles);
  if (!roles.success) throw new RbacError('Custom role names must be 2–60 characters.');
  const keys = roles.data.map((r) => r.key);
  if (new Set(keys).size !== keys.length) throw new RbacError('Two custom roles have the same name.');
  if (keys.some((k) => builtin.has(k))) throw new RbacError('A custom role can’t reuse a built-in role.');
  const known = new Set<string>([...ROLES, ...keys]);
  const grants = Object.fromEntries(PERMISSIONS.map((p) => [p, [...new Set((next.grants[p] ?? []).filter((r) => known.has(r)))]]));
  const matrix = withLocks(grants as Matrix);
  await store.put(SETTINGS, { id: RBAC_ID, k1: 'rbac', k2: null, data: { grants: matrix, customRoles: roles.data, updatedBy: actor.id } });
  for (const c of roles.data) ROLE_LABELS[c.key] = c.label;
  return { matrix, customRoles: roles.data as CustomRole[] };
}

/** Which grants differ from the defaults — for the audit entry and the "changed" markers. */
export function diffFromDefaults(m: Matrix): { perm: Permission; added: Role[]; removed: Role[] }[] {
  return PERMISSIONS.map((perm) => {
    const d = DEFAULT_RULES[perm] as Role[];
    const cur = m[perm] as Role[];
    return { perm, added: cur.filter((r) => !d.includes(r)), removed: d.filter((r) => !cur.includes(r)) };
  }).filter((x) => x.added.length || x.removed.length);
}

/** Human labels for the matrix screen, grouped by module. */
export const PERMISSION_INFO: Record<Permission, { module: string; label: string }> = {
  'lead.viewAll': { module: 'Admissions', label: 'See all leads (not only their own)' },
  'lead.assign': { module: 'Admissions', label: 'Allocate and reassign leads' },
  'lead.qualify': { module: 'Admissions', label: 'Qualify leads Hot/Warm/Cold/Invalid' },
  'lead.call': { module: 'Admissions', label: 'Log calls and follow-ups' },
  'lead.import': { module: 'Admissions', label: 'Import lead lists' },
  'lead.decide': { module: 'Admissions', label: 'Record admission decisions' },
  'phone.view': { module: 'Admissions', label: 'See raw phone numbers (others use click-to-call)' },
  'counselling.record': { module: 'Admissions', label: 'Record counselling sessions' },
  'walkin.create': { module: 'Admissions', label: 'Enter walk-in leads' },
  'visit.view': { module: 'Admissions', label: 'See campus visits' },
  'visit.checkin': { module: 'Admissions', label: 'Mark visit Arrived / No-show' },
  'visit.outcome': { module: 'Admissions', label: 'Record visit outcomes' },
  'visitor.log': { module: 'Front office', label: 'Visitor log and gate passes' },
  'inbox.reply': { module: 'Admissions', label: 'Reply in the chat inbox' },
  'inbox.all': { module: 'Admissions', label: 'See every chat conversation' },
  'whatsapp.send': { module: 'Messaging', label: 'Send WhatsApp templates to a lead' },
  'whatsapp.bulk': { module: 'Messaging', label: 'Send WhatsApp campaigns' },
  'whatsapp.setup': { module: 'Messaging', label: 'WhatsApp and AI assistant settings' },
  'bsat.manage': { module: 'Admissions', label: 'Manage BSAT' },
  'verify.view': { module: 'Fees & verification', label: 'See the verification gate' },
  'payment.record': { module: 'Fees & verification', label: 'Record payments' },
  'payment.approve': { module: 'Fees & verification', label: 'Approve offline payments' },
  'fees.dues': { module: 'Fees & verification', label: 'Instalment schedules, dues and reminders' },
  'fees.export': { module: 'Fees & verification', label: 'Collection reports and Tally export' },
  'concession.request': { module: 'Fees & verification', label: 'Request a fee concession' },
  'concession.approve.slab': { module: 'Fees & verification', label: 'Approve concessions up to the scholarship slab' },
  'concession.approve.above': { module: 'Fees & verification', label: 'Approve concessions above the slab' },
  'refund.request': { module: 'Fees & verification', label: 'Request refunds' },
  'refund.approve': { module: 'Fees & verification', label: 'Approve refunds' },
  'guardians.manage': { module: 'Students', label: 'Manage parent app logins (guardians)' },
  'students.view': { module: 'Students', label: 'See student records' },
  'students.manage': { module: 'Students', label: 'Edit student records, alumni moves' },
  'certificates.issue': { module: 'Students', label: 'Issue ID cards and certificates (TC, bonafide)' },
  'academics.manage': { module: 'Academics', label: 'Batches, sections, timetable' },
  'academics.view': { module: 'Academics', label: 'Academic dashboard across batches' },
  'tests.manage': { module: 'Academics', label: 'Create tests and enter marks' },
  'results.publish': { module: 'Academics', label: 'Publish results and rank lists' },
  'attendance.mark': { module: 'Academics', label: 'Take attendance' },
  'materials.upload': { module: 'Academics', label: 'Upload notes, DPPs, recordings' },
  'doubts.answer': { module: 'Academics', label: 'Answer student doubts' },
  'mentor.notes': { module: 'Mentoring', label: 'Mentor notes and parent call log' },
  'wellbeing.view': { module: 'Mentoring', label: 'Wellbeing check-ins' },
  'notices.publish': { module: 'Communication', label: 'Publish notices and circulars' },
  'ptm.manage': { module: 'Communication', label: 'PTM slots' },
  'messages.reply': { module: 'Communication', label: 'Reply to parent messages' },
  'discipline.record': { module: 'Academics', label: 'Discipline records' },
  'leave.request': { module: 'Staff', label: 'Request leave' },
  'leave.approve': { module: 'Staff', label: 'Approve staff leave' },
  'alumni.manage': { module: 'Students', label: 'Alumni network' },
  'homework.assign': { module: 'Academics', label: 'Set homework and assignments (own batches)' },
  'library.manage': { module: 'Library', label: 'Library books, issue and return' },
  'events.manage': { module: 'Communication', label: 'Events calendar' },
  'hostel.manage': { module: 'Hostel', label: 'Rooms, night attendance, sick room, complaints' },
  'outpass.approve': { module: 'Hostel', label: 'Approve out-passes' },
  'transport.manage': { module: 'Transport', label: 'Buses, routes, bus attendance' },
  'dashboard.view': { module: 'Management', label: 'Management dashboard and 7 PM report' },
  'marketing.spend': { module: 'Management', label: 'Marketing spend (cost per lead)' },
  'security.view': { module: 'Administration', label: 'Login audit and 2FA status' },
  'security.manage': { module: 'Administration', label: 'Reset 2FA, unlock accounts' },
  'staff.manage': { module: 'Administration', label: 'Staff accounts' },
  'rbac.manage': { module: 'Administration', label: 'Permission matrix and custom roles' },
  impersonate: { module: 'Administration', label: '“View as” another staff member (read-only)' },
};
