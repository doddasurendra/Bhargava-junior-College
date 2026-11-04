import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-assistant-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });

describe('staff AI assistant (§8.2)', () => {
  it('returns the full profile for BJC-2027-JEE-0001, scopes by role, masks phones and logs every query', async () => {
    const { createFileStore } = await import('../store/file');
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const store = createFileStore();
    const repo = createFileCrmRepo();

    // Admit one student end to end (same path the verification desk uses).
    // School data import records the previous school and board (stage 1), then the web enquiry merges in.
    await repo.importLeads(
      [{ line: 2, phone: '+919444400001', studentPhone: null, studentName: 'Ravi Teja', parentName: 'K Srinivas', school: 'ZPHS Saroornagar', classLevel: 'Class 10', board: 'SSC (Telangana)', area: null, program: 'iit-jee', note: null }],
      { fileName: 'schools.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 1, invalid: 0, duplicatesInFile: 0 },
    );
    const { leadId } = await store.captureLead({ name: 'K Srinivas', phone: '+919444400001', consent: true, source: 'callback', program: 'iit-jee' });
    await repo.updateLead(leadId, { status: 'confirmed' }, []);
    await repo.signOffStage(leadId, 'application', 'staff-anil', null);
    await repo.signOffStage(leadId, 'documents', 'staff-office', null);
    const pid = await repo.addPayment({ leadId, amount: 55000, mode: 'upi', reference: 'UTR9', paidOn: '2026-11-02', status: 'pending_approval', recordedBy: 'staff-frontdesk', approvedBy: null, approvedAt: null });
    await repo.decidePayment(pid, true, 'staff-accounts');
    await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
    await repo.issueReceipts(leadId, 'staff-accounts');
    await repo.createStudent(leadId, { fullName: 'Ravi Teja', dob: '2011-05-01', gender: 'male', program: 'iit-jee', stay: 'hostel', guardianName: 'K Srinivas', guardianPhone: '+919444400001' }, 'staff-adminoffice');
    expect(await repo.issueCollegeId(leadId, 'staff-adminoffice')).toBe('BJC-2027-JEE-0001');

    const svc = await import('./service');
    const management = staff('staff-md', 'management');

    const r = await svc.ask(management, 'BJC-2027-JEE-0001');
    expect(r.kind).toBe('profile');
    if (r.kind !== 'profile') throw new Error('expected a profile');
    expect(r.profile).toMatchObject({ name: 'Ravi Teja', collegeId: 'BJC-2027-JEE-0001', program: 'iit-jee', previousSchool: 'ZPHS Saroornagar', board: 'SSC (Telangana)', stay: 'hostel', phonesMasked: false });
    expect(r.profile.guardians[0]).toEqual({ name: 'K Srinivas', relation: 'primary guardian', phone: '+919444400001' });
    expect(r.profile.fees).toMatchObject({ paid: 55000 });
    expect(r.profile.fees!.receipts).toHaveLength(1);

    // Name search finds the same student.
    expect((await svc.ask(management, 'ravi teja')).kind).toBe('profile');

    // Unknown → "not found", never invented.
    const nf = await svc.ask(management, 'BJC-2027-NEET-0999');
    expect(nf).toMatchObject({ kind: 'none' });
    expect(nf.text).toMatch(/not found/i);

    // A role without phone.view sees masked numbers and no fees.
    const coord = await svc.ask(staff('staff-exam', 'academic_coordinator'), 'BJC-2027-JEE-0001');
    if (coord.kind !== 'profile') throw new Error('expected a profile');
    expect(coord.profile.guardians[0].phone).toBe('******0001');
    expect(coord.profile.phonesMasked).toBe(true);
    expect(coord.profile.fees).toBeNull();

    // Faculty see only their own batches: this student is in none of theirs.
    expect(await svc.ask(staff('staff-fac', 'faculty'), 'BJC-2027-JEE-0001')).toMatchObject({ kind: 'none' });

    // Roles outside the list can't use it at all.
    await expect(svc.ask(staff('staff-fd', 'front_desk'), 'BJC-2027-JEE-0001')).rejects.toThrow(/can’t use/);

    // Every question is logged (who, what, when), and only heads read the log.
    const log = await svc.recentQueries(management);
    expect(log.length).toBe(5);
    expect(log.find((l) => l.query === 'BJC-2027-JEE-0001' && l.actorId === 'staff-md')).toMatchObject({ intent: 'lookup', resultCount: 1 });
    expect(await svc.recentQueries(staff('staff-exam', 'academic_coordinator'))).toEqual([]);
  });
});
