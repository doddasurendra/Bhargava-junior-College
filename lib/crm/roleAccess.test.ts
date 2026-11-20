import { describe, expect, it } from 'vitest';
import { permissionsFor, type Permission } from './permissions';
import type { Role } from './types';

/**
 * Master prompt §9–10: each admission and office role has its own working permissions, and none of the
 * other departments'. If someone edits the defaults, this shows exactly which promise broke.
 */
const has = (role: Role, perms: Permission[]) => perms.filter((p) => !permissionsFor([role]).includes(p));
const lacks = (role: Role, perms: Permission[]) => perms.filter((p) => permissionsFor([role]).includes(p));

const HR: Permission[] = ['staff.manage', 'staff.records', 'staff.attendance', 'rbac.manage', 'security.manage', 'impersonate'];
const MONEY: Permission[] = ['fees.dues', 'fees.export', 'payment.approve', 'refund.approve', 'concession.approve.above'];
const PRIVATE_STUDENT: Permission[] = ['wellbeing.counsel', 'mentor.notes', 'wellbeing.view'];

const CASES: { role: Role; must: Permission[]; never: Permission[] }[] = [
  { role: 'admission_manager', must: ['lead.viewAll', 'lead.assign', 'lead.qualify', 'lead.decide', 'dashboard.view', 'concession.approve.slab'], never: [...HR, 'payment.approve', 'refund.approve', 'hostel.manage', 'transport.manage', ...PRIVATE_STUDENT] },
  { role: 'telecaller', must: ['lead.call', 'walkin.create', 'visit.checkin'], never: ['lead.viewAll', 'lead.assign', 'phone.view', ...HR, ...MONEY, 'students.view', ...PRIVATE_STUDENT] },
  { role: 'admission_counsellor', must: ['lead.call', 'lead.decide', 'counselling.record', 'visit.outcome', 'inbox.reply'], never: ['lead.viewAll', 'lead.assign', ...HR, ...MONEY, ...PRIVATE_STUDENT] },
  { role: 'front_desk', must: ['visitor.log', 'visit.checkin', 'visit.outcome', 'walkin.create'], never: ['lead.assign', 'lead.decide', ...HR, ...MONEY, 'students.view', ...PRIVATE_STUDENT] },
  { role: 'admission_office', must: ['verify.view', 'guardians.manage', 'payment.record'], never: ['payment.approve', 'lead.assign', ...HR, 'hostel.manage', ...PRIVATE_STUDENT] },
  { role: 'accounts', must: ['payment.approve', 'fees.dues', 'fees.export', 'refund.request', 'concession.request'], never: ['refund.approve', 'lead.assign', ...HR, 'hostel.manage', 'transport.manage', 'attendance.mark', ...PRIVATE_STUDENT] },
  { role: 'admin_office', must: ['students.manage', 'certificates.issue', 'notices.publish', 'staff.records', 'staff.attendance', 'guardians.manage', 'library.manage'], never: ['staff.manage', 'rbac.manage', 'payment.approve', 'refund.approve', ...PRIVATE_STUDENT] },
  { role: 'hostel_warden', must: ['hostel.manage', 'outpass.approve', 'visitor.log', 'notices.publish'], never: [...HR, ...MONEY, 'transport.manage', 'lead.viewAll', ...PRIVATE_STUDENT] },
  { role: 'transport_incharge', must: ['transport.manage', 'students.view'], never: [...HR, ...MONEY, 'hostel.manage', 'lead.viewAll', ...PRIVATE_STUDENT] },
  { role: 'data_executive', must: ['lead.import', 'marketing.spend', 'notices.publish', 'events.manage', 'sessions.manage'], never: [...HR, ...MONEY, 'students.view', ...PRIVATE_STUDENT] },
  { role: 'sports_coach', must: ['sports.manage'], never: [...HR, ...MONEY, 'students.view', 'lead.viewAll', ...PRIVATE_STUDENT] },
  { role: 'student_counsellor', must: ['wellbeing.counsel', 'wellbeing.helplines'], never: [...HR, ...MONEY, 'lead.viewAll', 'mentor.notes'] },
  { role: 'faculty', must: ['attendance.mark', 'tests.manage', 'students.view', 'leave.request'], never: [...HR, ...MONEY, 'results.publish', 'leave.approve', 'wellbeing.counsel'] },
];

describe('admission and office roles (master prompt §9–10)', () => {
  for (const c of CASES) {
    it(`${c.role}: has its own tools and nothing from other departments`, () => {
      expect(has(c.role, c.must)).toEqual([]);
      expect(lacks(c.role, c.never)).toEqual([]);
    });
  }

  it('every employee can apply for leave and see their own attendance; only leadership approves', () => {
    for (const c of CASES) expect(permissionsFor([c.role]).includes('leave.request')).toBe(true);
    expect(lacks('admin_office', ['leave.approve'])).toEqual([]);
    expect(has('principal', ['leave.approve', 'staff.attendance', 'staff.records'])).toEqual([]);
  });
});

describe('leadership: institution-wide read access (master prompt §3 level 1)', () => {
  it('principal and management can view hostel, transport and the audit log, but cannot run them', () => {
    for (const r of ['principal', 'management'] as Role[]) {
      expect(has(r, ['hostel.view', 'transport.view', 'security.view', 'students.view', 'staff.records'])).toEqual([]);
      expect(lacks(r, ['hostel.manage', 'transport.manage', 'outpass.approve', 'security.manage', 'staff.manage'])).toEqual([]);
    }
  });
  it('teachers and other departments do not get hostel/transport views', () => {
    for (const r of ['faculty', 'class_teacher', 'accounts', 'telecaller', 'sports_coach'] as Role[]) expect(lacks(r, ['hostel.view', 'transport.view', 'security.view'])).toEqual([]);
    expect(lacks('hostel_warden', ['transport.view'])).toEqual([]);
    expect(lacks('transport_incharge', ['hostel.view'])).toEqual([]);
  });
});
