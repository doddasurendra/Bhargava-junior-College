import type { CrmLead, Role, Staff } from './types';

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
  'dashboard.view': ['super_admin', 'management', 'principal', 'admission_manager'],
  'inbox.reply': [...MANAGE, 'telecaller', 'admission_counsellor', 'front_desk'],
  /** see every conversation, not just the waiting queue and your own */
  'inbox.all': [...MANAGE],
  'lead.decide': [...MANAGE, 'admission_counsellor'],
  'visit.view': [...SEE_ALL_LEADS, 'telecaller', 'admission_counsellor'],
  'visit.checkin': [...MANAGE, 'front_desk', 'telecaller'],
  'visit.outcome': [...MANAGE, 'front_desk', 'admission_counsellor'],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof RULES;

export function can(user: Pick<Staff, 'roles'>, perm: Permission): boolean {
  return user.roles.some((r) => (RULES[perm] as Role[]).includes(r));
}

/** Telecallers and counsellors see only the leads they own (§7.6). */
export function canSeeLead(user: Pick<Staff, 'id' | 'roles'>, lead: Pick<CrmLead, 'ownerId'>): boolean {
  return can(user, 'lead.viewAll') || lead.ownerId === user.id;
}

export const isTelecaller = (s: Pick<Staff, 'roles'>) => s.roles.includes('telecaller');
export const isCounsellor = (s: Pick<Staff, 'roles'>) => s.roles.includes('admission_counsellor');
