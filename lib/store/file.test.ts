import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Store } from './types';

let dir: string;
let cwd: string;
let store: Store;

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-store-'));
  process.chdir(dir); // file store resolves .data/ against cwd at import time
  store = (await import('./file')).createFileStore();
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const base = { name: 'Parent', consent: true as const };

describe('file store', () => {
  it('dedupes leads by phone and keeps history', async () => {
    const a = await store.captureLead({ ...base, phone: '+919000000001', source: 'callback' });
    const b = await store.captureLead({ ...base, phone: '+919000000001', source: 'brochure', program: 'neet' });
    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(false);
    expect(b.leadId).toBe(a.leadId);
    const [rec] = await store.findAdmissions('+919000000001');
    expect(rec?.program).toBe('neet');
  });

  it('siblings: own lead per child under the primary; web, import and tracking all respect the family', async () => {
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const repo = createFileCrmRepo();
    const phone = '+919000000050';
    const { leadId: primary } = await store.captureLead({ ...base, name: 'Lakshmi', phone, source: 'callback', program: 'iit-jee', studentName: 'Ravi' });
    await repo.updateLead(primary, { ownerId: 'staff-priya', category: 'hot' }, []);

    const sib = await repo.createSibling(primary, { studentName: 'Ramya', classLevel: 'Class 10', program: 'neet', school: 'ZPHS' }, 'staff-priya');
    const sibLead = await repo.getLead(sib);
    expect(sibLead).toMatchObject({ phone, siblingOf: primary, ownerId: 'staff-priya', studentName: 'Ramya', program: 'neet', firstSource: 'sibling', category: null, stage: 'enquiry' });
    // A sibling of a sibling still hangs off the family root.
    const third = await repo.createSibling(sib, { studentName: 'Ravi Jr', classLevel: null, program: null, school: null }, 'staff-priya');
    expect((await repo.getLead(third))?.siblingOf).toBe(primary);
    expect((await repo.familyOf(sib)).map((l) => l.studentName)).toEqual(['Ravi', 'Ramya', 'Ravi Jr']);

    // A new web enquiry from the same number still merges into the primary, not a sibling.
    const again = await store.captureLead({ ...base, phone, source: 'brochure' });
    expect(again).toEqual({ leadId: primary, isNew: false });
    // So does an import row.
    await repo.importLeads([{ line: 2, phone, studentPhone: null, studentName: 'x', parentName: 'y', school: null, classLevel: null, board: null, area: null, program: null, note: null }], { fileName: 'f.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 1, invalid: 0, duplicatesInFile: 0 });
    expect((await repo.getLead(sib))?.lastSource).toBe('sibling');

    // Track admission shows every child.
    expect((await store.findAdmissions(phone)).map((r) => r.studentName)).toEqual(['Ravi', 'Ramya', 'Ravi Jr']);
  });

  it('enforces slot capacity, including under concurrent bookings', async () => {
    const book = (i: number) => store.createVisit({ ...base, phone: `+91900000${String(100 + i)}`, date: '2026-11-05', slot: '10:00', familySize: 1 });
    const results = await Promise.allSettled([0, 1, 2, 3, 4, 5, 6].map(book));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason.code).toBe('slot_full');
    expect((await store.slotBookings('2026-11-05'))['10:00']).toBe(5);
  });

  it('imports: creates new leads, merges into existing ones without overwriting', async () => {
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const repo = createFileCrmRepo();
    await store.captureLead({ ...base, name: 'Web Parent', phone: '+919111111111', source: 'callback', program: 'neet' });
    const rec = (p: Partial<import('../crm/importer').ImportRecord>) => ({ line: 2, phone: '', studentPhone: null, studentName: null, parentName: null, school: null, classLevel: null, board: null, area: null, program: null, note: null, ...p });
    expect(await repo.findExistingPhones(['+919111111111', '+919222222222'])).toEqual(new Set(['+919111111111']));
    const res = await repo.importLeads(
      [
        rec({ phone: '+919111111111', studentName: 'Imported Student', program: 'iit-jee', school: 'ZPHS' }),
        rec({ line: 3, phone: '+919222222222', studentPhone: '+919333333333', studentName: 'New Kid', parentName: 'New Parent' }),
      ],
      { fileName: 'school.csv', source: 'school_data', actorId: 'staff-manager', totalRows: 3, invalid: 1, duplicatesInFile: 0 },
    );
    expect(res).toMatchObject({ created: 1, merged: 1 });
    const [merged] = await repo.listLeads({ q: '9111111111' });
    expect(merged).toMatchObject({ contactName: 'Web Parent', studentName: 'Imported Student', program: 'neet', school: 'ZPHS', lastSource: 'school_data' });
    // A later web enquiry from the student's own phone is recognised as the same family.
    expect(await repo.findExistingPhones(['+919333333333'])).toEqual(new Set(['+919333333333']));
    const [batch] = await repo.listImportBatches();
    expect(batch).toMatchObject({ fileName: 'school.csv', created: 1, merged: 1, invalid: 1 });
  });

  it('verification gate: refuses the College ID until every step is signed off, numbers atomically', async () => {
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const repo = createFileCrmRepo();
    const mk = async (phone: string) => {
      const { leadId } = await store.captureLead({ ...base, phone, source: 'callback', program: 'iit-jee' });
      await repo.updateLead(leadId, { status: 'confirmed' }, []);
      return leadId;
    };
    const a = await mk('+919444444441');
    await expect(repo.issueCollegeId(a, 'staff-adminoffice')).rejects.toThrow(/Not all steps/);
    await expect(repo.issueReceipts(a, 'staff-accounts')).rejects.toThrow(/Fee payment/);

    await repo.signOffStage(a, 'application', 'staff-anil', null);
    await expect(repo.signOffStage(a, 'application', 'staff-anil', null)).rejects.toThrow(/already/);
    await repo.signOffStage(a, 'documents', 'staff-office', null);
    const pid = await repo.addPayment({ leadId: a, amount: 55000, mode: 'upi', reference: 'UTR1', paidOn: '2026-11-02', status: 'pending_approval', recordedBy: 'staff-frontdesk', approvedBy: null, approvedAt: null });
    await repo.decidePayment(pid, true, 'staff-accounts');
    await expect(repo.decidePayment(pid, false, 'staff-accounts')).rejects.toThrow(/already been decided/);
    await repo.signOffStage(a, 'fee', 'staff-accounts', null);
    expect(await repo.issueReceipts(a, 'staff-accounts')).toEqual(['BJC/2027-28/00001']);
    await repo.createStudent(a, { fullName: 'Ravi Teja', dob: '2011-05-01', gender: 'male', program: 'iit-jee', stay: 'hostel', guardianName: 'K Srinivas', guardianPhone: '+919444444441' }, 'staff-adminoffice');
    await expect(repo.issueCollegeId(a, 'staff-adminoffice')).resolves.toBe('BJC-2027-JEE-0001');
    await expect(repo.issueCollegeId(a, 'staff-adminoffice')).rejects.toThrow(/already been issued/);

    const l = await repo.getLead(a);
    expect(l).toMatchObject({ status: 'admitted', stage: 'college_id', nextFollowUpAt: null });
    const v = await repo.getVerification(a);
    expect(v.signOffs.map((s) => s.stage)).toEqual(['application', 'documents', 'fee', 'receipt', 'student_record', 'college_id']);
    expect(v.student?.collegeId).toBe('BJC-2027-JEE-0001');
  });

  it('reversal: cascades, removes the student record, keeps receipts, blocked after College ID', async () => {
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const repo = createFileCrmRepo();
    const { leadId: b } = await store.captureLead({ ...base, phone: '+919444444442', source: 'callback', program: 'neet' });
    await repo.updateLead(b, { status: 'confirmed', stage: 'counselling' }, []);
    await repo.signOffStage(b, 'application', 'staff-anil', null);
    await repo.signOffStage(b, 'documents', 'staff-office', null);
    await repo.addPayment({ leadId: b, amount: 1000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: '' });
    await repo.signOffStage(b, 'fee', 'staff-accounts', null);
    const [receipt] = await repo.issueReceipts(b, 'staff-accounts');
    await repo.createStudent(b, { fullName: 'Wrong Name', dob: '2011-01-01', gender: 'female', program: 'neet', stay: 'day', guardianName: 'G', guardianPhone: '+919444444442' }, 'staff-adminoffice');

    await expect(repo.requestReversal(b, 'college_id', 'x', 'staff-manager')).rejects.toThrow(/not signed/);
    const r1 = await repo.requestReversal(b, 'application', 'Student name misspelt', 'staff-anil');
    await expect(repo.requestReversal(b, 'application', 'again', 'staff-anil')).rejects.toThrow(/already waiting/);
    expect(await repo.decideReversal(r1, true, 'staff-manager', 'ok')).toEqual(['application', 'student_record']);
    await expect(repo.decideReversal(r1, true, 'staff-manager', null)).rejects.toThrow(/already been decided/);

    let v = await repo.getVerification(b);
    expect(v.signOffs.map((s) => s.stage).sort()).toEqual(['documents', 'fee', 'receipt']);
    expect(v.student).toBeNull();
    expect((await repo.getLead(b))?.stage).toBe('receipt');

    const r2 = await repo.requestReversal(b, 'fee', 'Wrong amount approved', 'staff-accounts');
    expect(await repo.decideReversal(r2, true, 'staff-manager', null)).toEqual(['fee', 'receipt']);
    v = await repo.getVerification(b);
    expect(v.payments[0].receiptNo).toBe(receipt); // issued receipt numbers stay valid
    expect((await repo.getLead(b))?.stage).toBe('documents');

    // Rejection leaves the sign-off in place.
    const r3 = await repo.requestReversal(b, 'documents', 'Check TC again', 'staff-office');
    expect(await repo.decideReversal(r3, false, 'staff-manager', 'TC is fine')).toEqual([]);
    expect((await repo.getVerification(b)).signOffs.map((s) => s.stage)).toEqual(['documents']);
  });

  it('issues one hall ticket per lead', async () => {
    const r1 = await store.registerBsat({ ...base, phone: '+919000000009', stream: 'MPC', sessionId: '2026-11-16-campus' });
    const r2 = await store.registerBsat({ ...base, phone: '+919000000009', stream: 'MPC', sessionId: '2026-11-30-online' });
    expect(r1.hallTicket).toMatch(/^BSAT27-\d{5}$/);
    expect(r2).toEqual({ hallTicket: r1.hallTicket, alreadyRegistered: true });
  });
});
