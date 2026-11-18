import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Staff } from '../crm/types';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: () => new Headers() }));

let dir: string;
let cwd: string;
let R: typeof import('./registration');
let app: import('./types').AppStore;
let studentId: string;
let loginLinks: string[] = [];
const COLLEGE_PHONE = '+919822200001'; // parent on the admission record
const STUDENT_PHONE = '+919822200101';
const st = (id: string, roles: Staff['roles']): Staff => ({ id, fullName: id, email: null, phone: null, roles, active: true });
const adminOffice = st('staff-adminoffice', ['admin_office']);
const faculty = st('staff-fac', ['faculty']);
let collegeId: string;

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-appreg-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  vi.stubEnv('NODE_ENV', 'development'); // so the code comes back the way the local screen shows it
  R = await import('./registration');
  const repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  const store = (await import('../store/file')).createFileStore();
  app = (await import('./fileStore')).createFileAppStore();
  const { leadId } = await store.captureLead({ name: 'Parent', phone: COLLEGE_PHONE, consent: true, source: 'callback', program: 'neet' });
  await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-anil', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  await repo.addPayment({ leadId, amount: 60000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: new Date().toISOString() });
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: 'Meera Iyer', dob: '2010-05-14', gender: 'female', program: 'neet', stay: 'day', guardianName: 'S. Iyer', guardianPhone: COLLEGE_PHONE, loginPhone: STUDENT_PHONE }, 'staff-adminoffice');
  await repo.issueCollegeId(leadId, 'staff-adminoffice');
  const s = (await app.listStudents()).find((x) => x.leadId === leadId)!;
  studentId = s.id;
  collegeId = s.collegeId!;
  await app.addGuardian({ studentId, phone: COLLEGE_PHONE, name: 'S. Iyer', relation: 'father', addedBy: null });
  const orig = console.info;
  console.info = (m: string) => {
    if (typeof m === 'string' && m.includes('verification link')) loginLinks.push(m);
  };
  void orig;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('student self-registration', () => {
  it('needs the right College ID + date of birth and a mobile the college has for them', async () => {
    await expect(R.startStudentRegistration({ collegeId, dob: '2010-05-15', phone: STUDENT_PHONE })).rejects.toThrow('couldn’t match');
    await expect(R.startStudentRegistration({ collegeId: 'BJC-0000', dob: '2010-05-14', phone: STUDENT_PHONE })).rejects.toThrow('couldn’t match');
    await expect(R.startStudentRegistration({ collegeId, dob: '2010-05-14', phone: '9811111111' })).rejects.toThrow('not on the college’s record');
    const viaParent = await R.startStudentRegistration({ collegeId: collegeId.toLowerCase(), dob: '2010-05-14', phone: COLLEGE_PHONE });
    expect(viaParent).toMatchObject({ studentId, who: 'parent' });
    const own = await R.startStudentRegistration({ collegeId, dob: '2010-05-14', phone: '98222 00101' });
    expect(own.who).toBe('student');
    expect(own.devCode).toMatch(/^\d{6}$/);
    expect(await R.checkCode(STUDENT_PHONE, '000000')).toBe('invalid');
    expect(await R.checkCode(STUDENT_PHONE, own.devCode!)).toBe('ok');
  });

  it('creates the account, but College ID / email sign-in waits for the email link', async () => {
    await expect(R.finishStudentRegistration(studentId, STUDENT_PHONE, { email: 'meera@example.test', password: 'short', confirm: 'short' })).rejects.toThrow('8 characters');
    await expect(R.finishStudentRegistration(studentId, STUDENT_PHONE, { email: 'meera@example.test', password: 'river-mango-41', confirm: 'river-mango-42' })).rejects.toThrow('match');
    await R.finishStudentRegistration(studentId, STUDENT_PHONE, { email: 'Meera@Example.test', password: 'river-mango-41', confirm: 'river-mango-41' });
    const { studentCredentials } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const [c] = await studentCredentials.list(getRecordStore(), { k1: collegeId });
    expect(c.data).toMatchObject({ email: 'meera@example.test', emailVerifiedAt: null, source: 'self', verifiedPhone: STUDENT_PHONE });
    expect(c.data.passwordHash).not.toContain('river');
    const token = /token=([A-Za-z0-9_-]+)/.exec(loginLinks.join('\n'))![1];
    expect(await R.verifyStudentEmail('not-a-real-token-123456')).toBe('invalid');
    expect(await R.verifyStudentEmail(token)).toBe('ok');
    expect(await R.verifyStudentEmail(token)).toBe('invalid'); // single use
    await expect(R.startStudentRegistration({ collegeId, dob: '2010-05-14', phone: STUDENT_PHONE })).rejects.toThrow('already registered');
  });
});

describe('parent self-registration', () => {
  const draft = { name: 'Lata Iyer', relation: 'mother', phone: '9822200077', collegeId: '', dob: '2010-05-14' };

  it('checks the child, sends a code, and a number the college already has is told to just sign in', async () => {
    await expect(R.startParentRegistration({ ...draft, collegeId, dob: '2011-01-01' })).rejects.toThrow('couldn’t match');
    await expect(R.startParentRegistration({ ...draft, collegeId, relation: 'uncle' })).rejects.toThrow('related');
    const r = await R.startParentRegistration({ ...draft, collegeId });
    expect(r.devCode).toMatch(/^\d{6}$/);
    expect((await R.finishParentRegistration({ ...r.draft, phone: COLLEGE_PHONE })).result).toBe('already');
  });

  it('a new number waits for the admin office; only they approve; approval grants access', async () => {
    const r = await R.startParentRegistration({ ...draft, collegeId });
    expect(await R.finishParentRegistration(r.draft)).toEqual({ result: 'pending', student: 'Meera Iyer' });
    expect(await R.finishParentRegistration(r.draft)).toEqual({ result: 'pending', student: 'Meera Iyer' }); // no duplicate
    expect((await app.guardiansByPhone('+919822200077'))).toHaveLength(0);
    await expect(R.pendingParentRequests(faculty)).rejects.toThrow('admin office');
    const [req] = await R.pendingParentRequests(adminOffice);
    expect(req).toMatchObject({ name: 'Lata Iyer', relation: 'mother', phone: '+919822200077' });
    await expect(R.decideParentRequest(faculty, req.id, true, '')).rejects.toThrow('admin office');
    await R.decideParentRequest(adminOffice, req.id, true, 'Confirmed with father on call');
    expect((await app.guardiansByPhone('+919822200077')).map((g) => g.studentId)).toEqual([studentId]);
    await expect(R.decideParentRequest(adminOffice, req.id, true, '')).rejects.toThrow('already been decided');
  });

  it('a declined request needs a reason and grants nothing', async () => {
    const r = await R.startParentRegistration({ ...draft, phone: '9822200088', collegeId });
    await R.finishParentRegistration(r.draft);
    const req = (await R.pendingParentRequests(adminOffice)).find((x) => x.phone === '+919822200088')!;
    await expect(R.decideParentRequest(adminOffice, req.id, false, '')).rejects.toThrow('reason');
    await R.decideParentRequest(adminOffice, req.id, false, 'Not a guardian on our records');
    expect(await app.guardiansByPhone('+919822200088')).toHaveLength(0);
    expect((await R.requestsForPhone('+919822200088'))[0]).toMatchObject({ status: 'rejected', note: 'Not a guardian on our records' });
  });
});
