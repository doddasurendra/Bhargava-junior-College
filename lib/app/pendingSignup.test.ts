import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: () => new Map() }));

let dir: string, cwd: string;
let A: typeof import('./studentAccount');
let P: typeof import('./pendingAdmin');
let repo: import('../crm/types').CrmRepo;
let store: import('../store/types').Store;
const office = { id: 'staff-adminoffice', fullName: 'Admin Office', email: null, phone: null, roles: ['admin_office' as const], active: true };
const superAdmin = { ...office, id: 'staff-super', fullName: 'Super Admin', roles: ['super_admin' as const] };
const telecaller = { ...office, id: 'staff-t', fullName: 'Telecaller', roles: ['telecaller' as const] };
let n = 0;
const ip = () => `10.1.0.${++n}`;
const pw = { password: 'mango77river', confirm: 'mango77river', consent: true };

async function admit(name: string, parent: string, dob = '2010-06-15') {
  const { leadId } = await store.captureLead({ name: 'Parent', phone: parent, consent: true, source: 'callback', program: 'iit-jee' });
  await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-anil', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  await repo.addPayment({ leadId, amount: 50000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: '' });
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: name, dob, gender: 'female', program: 'iit-jee', stay: 'day', guardianName: 'Parent', guardianPhone: parent, loginPhone: null }, 'staff-adminoffice');
  const collegeId = await repo.issueCollegeId(leadId, 'staff-adminoffice');
  return { collegeId, studentId: (await repo.getVerification(leadId)).student!.id };
}

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-pend-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  A = await import('./studentAccount');
  P = await import('./pendingAdmin');
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('../store/file')).createFileStore();
});
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

describe('student sign-up never fails for valid details', () => {
  it('B unknown College ID → pending; D same again → exists; same ID other person → pending conflict; limited profile', async () => {
    const r = await A.signUp({ name: 'Kiran Kumar', collegeId: 'BJC-2027-JEE-0007', dob: '28/11/2010', ...pw }, ip());
    expect(r.kind).toBe('pending');
    const id = (r as { pendingId: string }).pendingId;
    const { pendingSignups } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const rec = (await pendingSignups.get(getRecordStore(), id))!.data;
    expect(rec).toMatchObject({ case: 'B', dob: '2010-11-28', status: 'pending', source: 'self-signup', conflictStudentId: null });
    expect(await A.signUp({ name: 'kiran  kumar', collegeId: 'bjc2027jee0007', dob: '2010-11-28', ...pw }, ip())).toEqual({ kind: 'exists' });
    const other = await A.signUp({ name: 'Someone Different', collegeId: 'BJC-2027-JEE-0007', dob: '2010-01-01', password: 'lotus55pond', confirm: 'lotus55pond', consent: true }, ip());
    expect(other.kind).toBe('pending');
    expect((await pendingSignups.get(getRecordStore(), (other as { pendingId: string }).pendingId))!.data).toMatchObject({ case: 'E', conflictType: 'duplicate_signup' });
    // each password signs into its own account; the pending profile has its own id and no record behind it
    const login = await A.verifyStudentLogin('BJC-2027-JEE-0007', 'mango77river', ip());
    expect(login).toEqual({ ok: true, collegeId: 'BJC-2027-JEE-0007', subject: `pend:${id}` });
    const { resolveProfiles } = await import('./service');
    expect(await resolveProfiles(`pend:${id}`)).toEqual([expect.objectContaining({ kind: 'student', studentId: `pending-${id}`, pending: true })]);
    expect((await A.verifyStudentLogin('BJC-2027-JEE-0007', 'lotus55pond', ip())).ok).toBe(true);
  });

  it('C record details differ → pending + conflict, never linked; E record has an account → pending + duplicate conflict', async () => {
    const { collegeId, studentId } = await admit('Meena Kumari', '+919877710001');
    const c = await A.signUp({ name: 'Meena Kumari', collegeId, dob: '2011-01-01', ...pw }, ip());
    expect(c.kind).toBe('pending');
    const { pendingSignups } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    expect((await pendingSignups.get(getRecordStore(), (c as { pendingId: string }).pendingId))!.data).toMatchObject({ case: 'C', conflictType: 'record_mismatch', conflictStudentId: studentId });
    expect(await A.accountSummary(studentId)).toEqual({ exists: false }); // the real record has no account yet
    expect((await A.signUp({ name: 'Meena Kumari', collegeId, dob: '15/06/2010', ...pw }, ip())).kind).toBe('active'); // the real student (A)
    const e = await A.signUp({ name: 'Imposter Name', collegeId, dob: '2010-06-15', ...pw }, ip());
    expect((await pendingSignups.get(getRecordStore(), (e as { pendingId: string }).pendingId))!.data).toMatchObject({ case: 'E', conflictType: 'duplicate_account' });
    const q = await P.signupQueue(office);
    expect(q.conflicts.map((x) => x.id)).toEqual(expect.arrayContaining([(c as { pendingId: string }).pendingId, (e as { pendingId: string }).pendingId]));
    await expect(P.signupQueue(telecaller)).rejects.toThrow(/admin office/);
  });

  it('admin office verifies & links: the same sign-in now opens the real student; only the office may do it', async () => {
    const { collegeId, studentId } = await admit('Latha Devi', '+919877710002');
    const r = await A.signUp({ name: 'Latha Devi', collegeId, dob: '2010-06-16', ...pw }, ip()); // DOB typo → C
    const id = (r as { pendingId: string }).pendingId;
    await expect(P.verifyAndLink(telecaller, id, studentId)).rejects.toThrow(/admin office/);
    const q = await P.signupQueue(office);
    expect(q.pending.find((x) => x.id === id)!.suggestions[0]).toMatchObject({ id: studentId });
    await P.verifyAndLink(office, id, studentId);
    const { resolveProfiles } = await import('./service');
    expect(await resolveProfiles(`pend:${id}`)).toEqual([expect.objectContaining({ kind: 'student', studentId, collegeId })]);
    expect(await A.accountSummary(studentId)).toMatchObject({ exists: true, status: 'active' });
    expect(await P.verificationNotice(studentId)).toMatchObject({ text: expect.stringMatching(/verified/) });
    await expect(P.verifyAndLink(office, id, studentId)).rejects.toThrow(/already handled/);
  });

  it('import: a pending sign-up is linked and activated when the real record arrives; re-import adds no duplicates', async () => {
    const r = await A.signUp({ name: 'Arjun Rao', collegeId: 'BJC-2027-JEE-0042', dob: '2010-03-05', ...pw }, ip());
    const id = (r as { pendingId: string }).pendingId;
    const { importStudents } = await import('./studentImport');
    const csv = 'college_id,full_name,dob,gender,program,stay,guardian_name,guardian_phone\nBJC-2027-JEE-0042,Arjun Rao,05/03/2010,M,MPC,Day,Ramesh Rao,9876500042\nBJC-2027-JEE-0043,New Student,2010-04-04,female,neet,hostel,Parent Two,9876500043\nBAD,,,,,,,\n';
    await expect(importStudents(telecaller, 'students.csv', Buffer.from(csv))).rejects.toThrow(/admin office/);
    await expect(importStudents(office, 'students.csv', Buffer.from('name,dob\nx,2010-01-01\n'))).rejects.toThrow(/Missing column/);
    const rep = await importStudents(office, 'students.csv', Buffer.from(csv));
    expect(rep).toMatchObject({ total: 3, created: 2, linked: 1, conflicts: 0, existing: 0, failed: 1 });
    const { resolveProfiles } = await import('./service');
    expect(await resolveProfiles(`pend:${id}`)).toEqual([expect.objectContaining({ kind: 'student', collegeId: 'BJC-2027-JEE-0042' })]);
    const again = await importStudents(office, 'students.csv', Buffer.from(csv));
    expect(again).toMatchObject({ created: 0, existing: 2, failed: 1 });
    // a new student can now register and is matched at once
    expect((await A.signUp({ name: 'New Student', collegeId: 'BJC-2027-JEE-0043', dob: '2010-04-04', ...pw }, ip())).kind).toBe('active');
  });

  it('test data: only test-marked sign-ups are deleted, only by the Super Admin, with a matching count', async () => {
    const t1 = await A.signUp({ name: 'Test One', collegeId: 'BJC-2027-NEET-0901', dob: '2010-02-02', ...pw }, ip());
    const keep = await A.signUp({ name: 'Real Pending', collegeId: 'BJC-2027-NEET-0902', dob: '2010-02-03', ...pw }, ip());
    await P.markTest(office, { pendingIds: [(t1 as { pendingId: string }).pendingId] }, true);
    await expect(P.deleteTestSignups(office, 2)).rejects.toThrow(/Super Admin/);
    const pv = await P.testSignupsPreview(superAdmin);
    expect(pv).toMatchObject({ signups: 1, accounts: 1 });
    await expect(P.deleteTestSignups(superAdmin, 5)).rejects.toThrow(/changed/);
    expect(await P.deleteTestSignups(superAdmin, 2)).toEqual({ signups: 1, accounts: 1 });
    const q = await P.signupQueue(office);
    expect(q.pending.map((x) => x.id)).toContain((keep as { pendingId: string }).pendingId);
    expect(q.pending.map((x) => x.id)).not.toContain((t1 as { pendingId: string }).pendingId);
    expect((await A.verifyStudentLogin('BJC-2027-NEET-0901', 'mango77river', ip())).ok).toBe(false);
  });

  it('pending accounts may open only general pages', async () => {
    const { pendingAllowed } = await import('./pendingAccess');
    for (const ok of ['/app', '/app/openbook', '/app/openbook/flashcards', '/app/practice', '/app/knowledge', '/app/notices', '/app/more']) expect(pendingAllowed(ok), ok).toBe(true);
    for (const no of ['/app/attendance', '/app/results', '/app/fees', '/app/hostel', '/app/mentor', '/app/report-card', '/app/timetable', '/app/messages', '/app/openbookx']) expect(pendingAllowed(no), no).toBe(false);
  });
});
