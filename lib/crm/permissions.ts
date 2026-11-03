import { ROLES, type CrmLead, type Role, type Staff } from './types';

/**
 * Permissions per brief §7.5–7.6. A user with several roles gets the union of them.
 * TODO: reconcile with §9A (login types and rules) once that section is available.
 */
const SEE_ALL_LEADS: Role[] = ['super_admin', 'management', 'principal', 'admission_manager', 'data_executive', 'front_desk', 'admission_office', 'accounts', 'admin_office'];
const MANAGE: Role[] = ['super_admin', 'management', 'admission_manager'];

const RULES = {
  'lead.viewAll': SEE_ALL_LEADS,
  'lead.assign': MANAGE,
  'lead.qualify': MANAGE,
  'lead.call': [...MANAGE, 'telecaller', 'admission_counsellor'],
  'lead.import': [...MANAGE, 'data_executive'],
  'verify.view': [...SEE_ALL_LEADS, 'admission_counsellor'],
  'payment.record': [...MANAGE, 'accounts', 'admission_office', 'front_desk'],
  'payment.approve': ['accounts'],
  'whatsapp.send': [...MANAGE, 'telecaller', 'admission_counsellor', 'front_desk'],
  'whatsapp.bulk': [...MANAGE, 'data_executive'],
  'whatsapp.setup': MANAGE,
  'guardians.manage': [...MANAGE, 'admin_office', 'admission_office'],
  'dashboard.view': ['super_admin', 'management', 'principal', 'admission_manager'],
  'inbox.reply': [...MANAGE, 'telecaller', 'admission_counsellor', 'front_desk'],
  /** see every conversation, not just the waiting queue and your own */
  'inbox.all': [...MANAGE],
  'lead.decide': [...MANAGE, 'admission_counsellor'],
  'visit.view': [...SEE_ALL_LEADS, 'telecaller', 'admission_counsellor'],
  'visit.checkin': [...MANAGE, 'front_desk', 'telecaller'],
  'visit.outcome': [...MANAGE, 'front_desk', 'admission_counsellor'],
  /** login audit and everyone's 2FA status */
  'security.view': ['super_admin', 'management'],
  /** reset someone's 2FA, unlock an account */
  'security.manage': ['super_admin'],
  /** add staff, change roles, deactivate, send password resets */
  'staff.manage': ['super_admin'],
  /** ad spend per source for cost per lead (§8, §9A content/marketing manager) */
  'marketing.spend': ['super_admin', 'management', 'data_executive'],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof RULES;

export function can(user: Pick<Staff, 'roles'>, perm: Permission): boolean {
  return user.roles.some((r) => (RULES[perm] as Role[]).includes(r));
}

/** Telecallers and counsellors see only the leads they own (§7.6). */
export function canSeeLead(user: Pick<Staff, 'id' | 'roles'>, lead: Pick<CrmLead, 'ownerId'>): boolean {
  return can(user, 'lead.viewAll') || lead.ownerId === user.id;
}

/**
 * Acceptance criteria: one user with several roles switches between them without signing out. They work in
 * one role at a time; the default is whichever comes first in ROLES (admin and management roles lead). A requested role the
 * user doesn't hold is ignored, so the choice can only narrow what they can do.
 */
export function pickActiveRole(roles: Role[], wanted: string | null | undefined): Role | null {
  if (roles.length === 0) return null;
  if (wanted && (roles as string[]).includes(wanted)) return wanted as Role;
  return [...roles].sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b))[0];
}

export const isTelecaller = (s: Pick<Staff, 'roles'>) => s.roles.includes('telecaller');
export const isCounsellor = (s: Pick<Staff, 'roles'>) => s.roles.includes('admission_counsellor');
