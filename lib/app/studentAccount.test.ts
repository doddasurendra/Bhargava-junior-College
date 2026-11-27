import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: () => new Map() }));

let dir: string, cwd: string;
let A: typeof import('./studentAccount');
let repo: import('../crm/types').CrmRepo;
let store: import('../store/types').Store;
const office = { id: 'staff-adminoffice', fullName: 'Admin Office', email: null, phone: null, roles: ['admin_office' as const], active: true };
const telecaller = { ...office, id: 'staff-t', fullName: 'Telecaller', roles: ['telecaller' as const] };
let n = 0;

async function admit(name: string, parent: string) {
  const { leadId } = await store.captureLead({ name: 'Parent', phone: parent, consent: true, source: 'callback', program: 'iit-jee' });
  await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-anil', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  await repo.addPayment({ leadId, amount: 50000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: '' });
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  const st = await repo.createStudent(leadId, { fullName: name, dob: '2010-06-15', gender: 'female', program: 'iit-jee', stay: 'day', guardianName: 'Parent', guardianPhone: parent, loginPhone: null }, 'staff-adminoffice');
  const collegeId = await repo.issueCollegeId(leadId, 'staff-adminoffice');
  return { collegeId, studentId: (await repo.getVerification(leadId)).student!.id ?? st };
}
const ip = () => `10.0.0.${++n}`; // a fresh IP per call keeps the per-IP limit out of the way

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-acct-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  A = await import('./studentAccount');
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('../store/file')).createFileStore();
});
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

describe('student sign-up rules', () => {
  it('matches names ignoring case, spaces, dots and initial order', () => {
    expect(A.namesMatch('k. ravi  teja', 'Ravi Teja K')).toBe(true);
    expect(A.namesMatch('Ravi Teja Kumar', 'K Ravi Teja')).toBe(true);
    expect(A.namesMatch('RAVI TEJA', 'Ravi Teja')).toBe(true);
    expect(A.namesMatch('Ravi', 'Ravi Teja')).toBe(false);
    expect(A.namesMatch('Ravi Tej', 'Ravi Teja')).toBe(false);
  });
  it('validates every field and reports each one', () => {
    const e = A.signUpFieldErrors({ name: 'R', collegeId: 'abc', dob: '2020-01-01', password: 'abcdefgh', confirm: 'x', consent: false });
    expect(Object.keys(e).sort()).toEqual(['collegeId', 'consent', 'dob', 'name', 'password']);
    expect(A.passwordProblem('abc12345')).toBeNull();
    expect(A.passwordProblem('abcdefgh')).toMatch(/letter and one number/);
    expect(A.ageProblem('0001-01-01')).toMatch(/14 and 25/);
    expect(A.ageProblem('')).toMatch(/date of birth/);
  });
});

describe('student account lifecycle (local store)', () => {
  it('sign-up needs the right name + College ID + DOB, says nothing about which was wrong, and allows one account', async () => {
    const { collegeId, studentId } = await admit('Divya Sri', '+919877700001');
    const base = { name: 'divya  sri', collegeId: collegeId.toLowerCase(), dob: '2010-06-15', password: 'mango77river', confirm: 'mango77river', consent: true };
    for (const bad of [{ dob: '2010-06-16' }, { name: 'Divya Rani' }, { collegeId: 'BJC-2027-JEE-9999' }]) await expect(A.signUp({ ...base, ...bad }, ip())).rejects.toThrow(A.MSG.noMatch);
    await expect(A.signUp({ ...base, website: 'spam' }, ip())).rejects.toThrow(A.MSG.noMatch); // honeypot
    expect(await A.signUp(base, ip())).toEqual({ collegeId, studentId });
    await expect(A.signUp(base, ip())).rejects.toThrow(A.MSG.exists);
    expect((await A.verifyStudentLogin(collegeId, 'mango77river', ip())).ok).toBe(true);
    expect(await A.verifyStudentLogin(collegeId, 'wrong-pass1', ip())).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rate limit: 5 sign-up attempts per College ID per day', async () => {
    const { collegeId } = await admit('Rate Limit', '+919877700002');
    const bad = { name: 'Rate Limit', collegeId, dob: '2010-01-01', password: 'mango77river', confirm: 'mango77river', consent: true };
    for (let i = 0; i < 5; i++) await expect(A.signUp(bad, ip())).rejects.toThrow(A.MSG.noMatch);
    await expect(A.signUp({ ...bad, dob: '2010-06-15' }, ip())).rejects.toThrow(A.MSG.tooMany);
  });

  it('parent block and admin office disable/enable stop and restore sign-in; only the right people can act', async () => {
    const parent = '+919877700003';
    const { collegeId, studentId } = await admit('Block Test', parent);
    await A.signUp({ name: 'Block Test', collegeId, dob: '2010-06-15', password: 'mango77river', confirm: 'mango77river', consent: true }, ip());
    await expect(A.parentBlock('+919877700099', studentId)).rejects.toThrow(/own child/);
    await A.parentBlock(parent, studentId);
    expect(await A.verifyStudentLogin(collegeId, 'mango77river', ip())).toEqual({ ok: false, reason: 'blocked' });
    await expect(A.officeSetStatus(telecaller, studentId, 'active')).rejects.toThrow(/admin office/);
    await A.officeSetStatus(office, studentId, 'active');
    expect((await A.verifyStudentLogin(collegeId, 'mango77river', ip())).ok).toBe(true);
    await A.officeSetStatus(office, studentId, 'disabled');
    expect((await A.accountSummary(studentId))).toMatchObject({ exists: true, status: 'disabled' });
    await A.officeSetStatus(office, studentId, 'active');
  });

  it('forgot password: parent code and office code work once; the old password stops working', async () => {
    const parent = '+919877700004';
    const { collegeId, studentId } = await admit('Reset Test', parent);
    await A.signUp({ name: 'Reset Test', collegeId, dob: '2010-06-15', password: 'mango77river', confirm: 'mango77river', consent: true }, ip());
    const p = await A.parentResetCode(parent, studentId);
    await expect(A.resetWithCode(collegeId, p.code === '000000' ? '111111' : '000000', 'lotus55pond', 'lotus55pond', ip())).rejects.toThrow(A.MSG.badCode);
    await A.resetWithCode(collegeId, p.code, 'lotus55pond', 'lotus55pond', ip());
    await expect(A.resetWithCode(collegeId, p.code, 'other55pond', 'other55pond', ip())).rejects.toThrow(A.MSG.badCode); // single use
    expect(await A.verifyStudentLogin(collegeId, 'mango77river', ip())).toEqual({ ok: false, reason: 'invalid' });
    expect((await A.verifyStudentLogin(collegeId, 'lotus55pond', ip())).ok).toBe(true);
    await expect(A.officeResetCode(telecaller, studentId)).rejects.toThrow(/admin office/);
    const o = await A.officeResetCode(office, studentId);
    expect(new Date(o.expiresAt).getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    await A.resetWithCode(collegeId, o.code, 'cedar66hill', 'cedar66hill', ip());
    expect((await A.verifyStudentLogin(collegeId, 'cedar66hill', ip())).ok).toBe(true);
  });
});
