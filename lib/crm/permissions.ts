import { ROLES, type CrmLead, type Role, type Staff } from './types';

/**
 * Role-based access control (§7.5–7.6, §9A.3–9A.4). Each permission is granted to roles; a user gets the
 * permissions of their active role. These are the defaults: the Super Admin can change the matrix and add
 * custom roles without code (§9A.1 "admin console"), and the session loads the effective matrix into
 * `user.perms` (see lib/crm/rbac.ts).
 */
const SEE_ALL_LEADS: Role[] = ['super_admin', 'management', 'principal', 'admission_manager', 'data_executive', 'front_desk', 'admission_office', 'accounts', 'admin_office'];
const MANAGE: Role[] = ['super_admin', 'management', 'admission_manager'];
const ACADEMIC_HEADS: Role[] = ['super_admin', 'principal', 'academic_coordinator'];
const TEACHERS: Role[] = ['faculty', 'class_teacher'];

export const DEFAULT_RULES = {
  // ---- admissions CRM
  'lead.viewAll': SEE_ALL_LEADS,
  'lead.assign': MANAGE,
  'lead.qualify': MANAGE,
  'lead.call': [...MANAGE, 'telecaller', 'admission_counsellor'],
  'lead.import': [...MANAGE, 'data_executive'],
  'lead.decide': [...MANAGE, 'admission_counsellor'],
  /** raw phone numbers; telecallers see them only through click-to-call (§9A.1 field masking) */
  'phone.view': ['super_admin', 'management', 'principal', 'admission_manager', 'admission_counsellor', 'front_desk', 'admission_office', 'accounts', 'admin_office', 'data_executive'],
  'counselling.record': [...MANAGE, 'admission_counsellor'],
  'walkin.create': [...MANAGE, 'front_desk', 'telecaller', 'admission_counsellor'],
  'visit.view': [...SEE_ALL_LEADS, 'telecaller', 'admission_counsellor'],
  'visit.checkin': [...MANAGE, 'front_desk', 'telecaller'],
  'visit.outcome': [...MANAGE, 'front_desk', 'admission_counsellor'],
  'visitor.log': ['super_admin', 'front_desk', 'hostel_warden', 'admin_office'],
  'inbox.reply': [...MANAGE, 'telecaller', 'admission_counsellor', 'front_desk'],
  /** see every conversation, not just the waiting queue and your own */
  'inbox.all': [...MANAGE],
  'whatsapp.send': [...MANAGE, 'telecaller', 'admission_counsellor', 'front_desk'],
  'whatsapp.bulk': [...MANAGE, 'data_executive'],
  'whatsapp.setup': MANAGE,
  'bsat.manage': ['super_admin', 'admission_manager', 'academic_coordinator'],

  // ---- verification gate, fees, accounts
  'verify.view': [...SEE_ALL_LEADS, 'admission_counsellor'],
  'payment.record': [...MANAGE, 'accounts', 'admission_office', 'front_desk'],
  'payment.approve': ['accounts'],
  'fees.dues': ['super_admin', 'management', 'accounts'],
  'fees.export': ['super_admin', 'management', 'accounts'],
  'concession.request': ['super_admin', 'admission_manager', 'admission_counsellor', 'accounts'],
  /** concessions up to the scholarship slab (§9A.3) */
  'concession.approve.slab': ['admission_manager', 'management'],
  /** concessions above the slab */
  'concession.approve.above': ['management'],
  'refund.request': ['accounts'],
  'refund.approve': ['management'],
  'guardians.manage': [...MANAGE, 'admin_office', 'admission_office'],

  // ---- students, academics (§9A.2 rows 3, 10–12, 15)
  'students.view': ['super_admin', 'management', 'principal', 'academic_coordinator', 'admin_office', 'admission_office', 'accounts', 'faculty', 'class_teacher', 'hostel_warden', 'transport_incharge'],
  'students.manage': ['super_admin', 'admin_office'],
  'certificates.issue': ['super_admin', 'admin_office'],
  'academics.manage': [...ACADEMIC_HEADS, 'admin_office'],
  'academics.view': [...ACADEMIC_HEADS, 'management'],
  'tests.manage': [...ACADEMIC_HEADS, 'faculty'],
  'results.publish': ACADEMIC_HEADS,
  'attendance.mark': [...ACADEMIC_HEADS, ...TEACHERS],
  'materials.upload': [...ACADEMIC_HEADS, 'faculty'],
  'doubts.answer': [...ACADEMIC_HEADS, 'faculty'],
  'mentor.notes': ['super_admin', 'principal', 'class_teacher'],
  'wellbeing.view': ['super_admin', 'principal', 'class_teacher'],
  'notices.publish': ['super_admin', 'principal', 'academic_coordinator', 'admin_office', 'hostel_warden'],
  'ptm.manage': ['super_admin', 'principal', ...TEACHERS],
  'messages.reply': ['super_admin', 'principal', ...TEACHERS],
  'discipline.record': ['super_admin', 'principal', 'class_teacher'],
  'leave.request': [...TEACHERS, 'academic_coordinator', 'hostel_warden', 'transport_incharge'],
  'leave.approve': ['super_admin', 'principal'],
  'alumni.manage': ['super_admin', 'admin_office', 'data_executive'],
  'homework.assign': [...ACADEMIC_HEADS, ...TEACHERS],
  'library.manage': ['super_admin', 'admin_office'],
  'events.manage': ['super_admin', 'principal', 'academic_coordinator', 'admin_office'],

  // ---- hostel & transport (§9A.2 rows 13–14)
  'hostel.manage': ['super_admin', 'hostel_warden'],
  'outpass.approve': ['super_admin', 'hostel_warden'],
  'transport.manage': ['super_admin', 'transport_incharge'],

  // ---- management & administration
  'dashboard.view': ['super_admin', 'management', 'principal', 'admission_manager'],
  'marketing.spend': ['super_admin', 'management', 'data_executive'],
  /** login audit and everyone's 2FA status */
  'security.view': ['super_admin', 'management'],
  /** reset someone's 2FA, unlock an account */
  'security.manage': ['super_admin'],
  /** add staff, change roles, deactivate, send password resets */
  'staff.manage': ['super_admin'],
  /** edit the permission matrix and custom roles */
  'rbac.manage': ['super_admin'],
  /** "view as" another user for support, read-only and logged (§9A.4) */
  'impersonate': ['super_admin'],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof DEFAULT_RULES;
export const PERMISSIONS = Object.keys(DEFAULT_RULES) as Permission[];

/** The Super Admin always keeps these, so the matrix can't lock everyone out. */
export const LOCKED_GRANTS: { role: Role; perm: Permission }[] = (['staff.manage', 'security.manage', 'rbac.manage', 'security.view'] as Permission[]).map((perm) => ({ role: 'super_admin', perm }));

export type Matrix = Record<Permission, Role[]>;

/**
 * The Developer role has every permission, always — including ones added later — and the permission matrix
 * can't take any away (it builds and maintains the system). It requires 2FA like the Super Admin.
 */
export const DEVELOPER: Role = 'developer';
export const isDeveloper = (user: Pick<Staff, 'roles'>) => user.roles.includes(DEVELOPER);

export function permissionsFor(roles: Role[], matrix: Matrix = DEFAULT_RULES): Permission[] {
  if (roles.includes(DEVELOPER)) return [...PERMISSIONS];
  return PERMISSIONS.filter((p) => roles.some((r) => (matrix[p] as Role[]).includes(r)));
}

/** Uses the session's effective permissions when present (signed-in user), else the defaults (e.g. a lead owner). */
export function can(user: Pick<Staff, 'roles'> & { perms?: readonly string[] }, perm: Permission): boolean {
  if (user.roles.includes(DEVELOPER)) return true;
  if (user.perms) return user.perms.includes(perm);
  return user.roles.some((r) => (DEFAULT_RULES[perm] as Role[]).includes(r));
}

/** Telecallers and counsellors see only the leads they own (§7.6). */
export function canSeeLead(user: Pick<Staff, 'id' | 'roles'> & { perms?: readonly string[] }, lead: Pick<CrmLead, 'ownerId'>): boolean {
  return can(user, 'lead.viewAll') || lead.ownerId === user.id;
}

/**
 * Acceptance criteria: one user with several roles switches between them without signing out. They work in
 * one role at a time; the default is whichever comes first in ROLES (admin and management roles lead; custom
 * roles last). A requested role the user doesn't hold is ignored, so the choice can only narrow access.
 */
export function pickActiveRole(roles: Role[], wanted: string | null | undefined): Role | null {
  if (roles.length === 0) return null;
  if (wanted && (roles as string[]).includes(wanted)) return wanted as Role;
  const rank = (r: Role) => {
    const i = (ROLES as readonly string[]).indexOf(r);
    return i < 0 ? 1000 : i;
  };
  return [...roles].sort((a, b) => rank(a) - rank(b))[0];
}

export const isTelecaller = (s: Pick<Staff, 'roles'>) => s.roles.includes('telecaller');
export const isCounsellor = (s: Pick<Staff, 'roles'>) => s.roles.includes('admission_counsellor');
