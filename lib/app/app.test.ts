import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeSession, encodeSession } from '../crm/session';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) }));

let dir: string;
let cwd: string;
let app: typeof import('./service');
let admin: typeof import('./admin');
let repo: import('../crm/types').CrmRepo;
let store: import('../store/types').Store;

const adminOffice = { id: 'staff-adminoffice', fullName: 'Admin Office', email: null, phone: null, roles: ['admin_office' as const], active: true };

/** Walks a lead through the whole verification gate and issues the College ID. */
async function admit(phone: string, studentName: string, program: 'iit-jee' | 'neet', stay: 'day' | 'hostel', studentPhone?: string) {
  const { leadId } = await store.captureLead({ name: 'Parent', phone, consent: true, source: 'callback', program });
  return admitLead(leadId, phone, studentName, program, stay, studentPhone);
}

async function admitLead(leadId: string, phone: string, studentName: string, program: 'iit-jee' | 'neet', stay: 'day' | 'hostel', studentPhone?: string) {
  await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-anil', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  await repo.addPayment({ leadId, amount: 50000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: '' });
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: studentName, dob: '2011-01-01', gender: 'female', program, stay, guardianName: 'Parent', guardianPhone: phone, loginPhone: studentPhone ?? null }, 'staff-adminoffice');
  const collegeId = await repo.issueCollegeId(leadId, 'staff-adminoffice');
  return { leadId, collegeId };
}

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-app-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  app = await import('./service');
  admin = await import('./admin');
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('../store/file')).createFileStore();
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('Student & Parent app', () => {
  it('app and CRM session tokens are not interchangeable', () => {
    const appToken = encodeSession('+919888800001', Date.now(), 'app');
    expect(decodeSession(appToken, Date.now(), 'app')).toBe('+919888800001');
    expect(decodeSession(appToken, Date.now(), 'crm')).toBeNull();
    expect(decodeSession(encodeSession('staff-admin'), Date.now(), 'app')).toBeNull();
  });

  it('an applicant login upgrades to a parent login when the College ID is issued', async () => {
    const phone = '+919888800001';
    await store.captureLead({ name: 'Parent', phone, consent: true, source: 'callback' });
    expect((await app.resolveProfiles(phone)).map((p) => p.kind)).toEqual(['applicant']);

    const { collegeId } = await admit(phone, 'Ravi Teja', 'iit-jee', 'hostel', '+919888800002');
    const profiles = await app.resolveProfiles(phone);
    expect(profiles).toEqual([expect.objectContaining({ kind: 'parent', name: 'Ravi Teja', collegeId })]);
    // The student signs in with their own number.
    expect((await app.resolveProfiles('+919888800002')).map((p) => p.kind)).toEqual(['student']);
    // Unknown numbers see nothing (and get no code).
    expect(await app.resolveProfiles('+919888800099')).toEqual([]);
    expect(await app.requestLoginCode('+919888800099')).toEqual({});
  });

  it('one parent switches between two children; several guardians sign in for the same child', async () => {
    const mum = '+919888800010';
    const a = await admit(mum, 'Keerthana', 'neet', 'day');
    // Siblings: the second child is a sibling lead in the same family (same phone), admitted on its own.
    const sibLead = await repo.createSibling(a.leadId, { studentName: 'Sai Charan', classLevel: 'Class 10', program: 'iit-jee', school: null }, 'staff-priya');
    await admitLead(sibLead, mum, 'Sai Charan', 'iit-jee', 'hostel');
    expect((await app.resolveProfiles(mum)).map((p) => `${p.kind}:${p.name}`).sort()).toEqual(['parent:Keerthana', 'parent:Sai Charan']);

    const dad = '+919888800011';
    await admin.addGuardian(adminOffice, a.leadId, { name: 'Father', phone: dad, relation: 'father' });
    await expect(admin.addGuardian(adminOffice, a.leadId, { name: 'Father', phone: dad, relation: 'father' })).rejects.toThrow(/already/);
    expect((await app.resolveProfiles(dad)).map((p) => p.name)).toEqual(['Keerthana']);

    await admin.removeGuardian(adminOffice, a.leadId, dad);
    expect(await app.resolveProfiles(dad)).toEqual([]);
    await expect(admin.removeGuardian(adminOffice, a.leadId, mum)).rejects.toThrow(/at least one/);
    await expect(admin.addGuardian({ ...adminOffice, roles: ['telecaller'] }, a.leadId, { name: 'X', phone: dad, relation: 'other' })).rejects.toThrow();
  });

  it('hostel check-ins alert every guardian once; day scholars and unknown IDs are rejected', async () => {
    const phone = '+919888800020';
    const h = await admit(phone, 'Harsha', 'iit-jee', 'hostel');
    await admin.addGuardian(adminOffice, h.leadId, { name: 'Mother', phone: '+919888800021', relation: 'mother' });
    const ev = { collegeId: h.collegeId, direction: 'in' as const, at: new Date().toISOString(), device: 'gate-1', eventId: 'e-1' };
    expect(await app.recordHostelMovement(ev)).toEqual({ ok: true, duplicate: false, alerted: 2 });
    expect(await app.recordHostelMovement(ev)).toEqual({ ok: true, duplicate: true, alerted: 0 });
    const day = await admit('+919888800030', 'Dayscholar', 'neet', 'day');
    expect(await app.recordHostelMovement({ ...ev, collegeId: day.collegeId, eventId: 'e-2' })).toMatchObject({ ok: false, error: 'not_a_hosteller' });
    expect(await app.recordHostelMovement({ ...ev, collegeId: 'BJC-0000', eventId: 'e-3' })).toMatchObject({ ok: false, error: 'unknown_college_id' });

    const profiles = await app.resolveProfiles(phone);
    const d = await app.profileData(profiles[0]);
    expect(d.hostel?.[0]).toMatchObject({ direction: 'in', alerted: 2 });
    expect(d.payments[0].receiptNo).toMatch(/^BJC\/2027-28\//);
    // Receipts are visible only to phones linked to that student.
    const pid = d.payments[0].id;
    expect(await app.canSeePayment({ phone, profiles, active: profiles[0], sid: 'test' }, pid)).toMatchObject({ id: pid });
    const stranger = await app.resolveProfiles('+919888800010');
    expect(await app.canSeePayment({ phone: '+919888800010', profiles: stranger, active: stranger[0], sid: 'test' }, pid)).toBeNull();
  });
});
