import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-backoffice-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });

describe('back office: rules', () => {
  it('counts copies, overdue days and upcoming events', async () => {
    const B = await import('./backoffice');
    expect(B.availableCopies(3, [{ returnedOn: null }, { returnedOn: '2026-11-01' }])).toBe(2);
    expect(B.daysOverdue({ dueOn: '2026-11-01', returnedOn: null }, '2026-11-04')).toBe(3);
    expect(B.daysOverdue({ dueOn: '2026-11-05', returnedOn: null }, '2026-11-04')).toBe(0);
    expect(B.daysOverdue({ dueOn: '2026-11-01', returnedOn: '2026-11-03' }, '2026-11-04')).toBe(0);
    const ev = [{ date: '2026-11-10', endDate: null }, { date: '2026-11-01', endDate: '2026-11-06' }, { date: '2026-10-01', endDate: null }];
    expect(B.upcoming(ev, '2026-11-04').map((e) => e.date)).toEqual(['2026-11-01', '2026-11-10']);
  });
});

describe('back office: library, events, homework, exports', () => {
  it('enforces copies, permissions and teacher scoping', async () => {
    const { createFileStore } = await import('../store/file');
    const { createFileCrmRepo } = await import('../crm/fileRepo');
    const store = createFileStore();
    const repo = createFileCrmRepo();
    // one admitted student
    const { leadId } = await store.captureLead({ name: 'Parent', phone: '+919555500001', consent: true, source: 'callback', program: 'neet' });
    await repo.updateLead(leadId, { status: 'confirmed' }, []);
    for (const st of ['application', 'documents'] as const) await repo.signOffStage(leadId, st, 'staff-office', null);
    const pid = await repo.addPayment({ leadId, amount: 1000, mode: 'upi', reference: 'U1', paidOn: '2026-11-02', status: 'pending_approval', recordedBy: 'staff-frontdesk', approvedBy: null, approvedAt: null });
    await repo.decidePayment(pid, true, 'staff-accounts');
    await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
    await repo.issueReceipts(leadId, 'staff-accounts');
    await repo.createStudent(leadId, { fullName: 'Asha Rani', dob: '2011-01-01', gender: 'female', program: 'neet', stay: 'day', guardianName: 'Parent', guardianPhone: '+919555500001' }, 'staff-adminoffice');
    await repo.issueCollegeId(leadId, 'staff-adminoffice');

    const B = await import('./backoffice');
    const admin = staff('staff-adminoffice', 'admin_office');
    const { students } = await B.libraryOverview(admin);
    const sid = students[0].id;

    // library
    await expect(B.addBook(staff('staff-fac', 'faculty'), { title: 'X', author: null, subject: null, isbn: null, shelf: null, copies: 1 })).rejects.toThrow(/permission/);
    await B.addBook(admin, { title: 'NCERT Biology XI', author: 'NCERT', subject: 'Biology', isbn: null, shelf: 'B2', copies: 1 });
    const bookId = (await B.libraryOverview(admin)).books[0].id;
    await B.issueBook(admin, bookId, sid, '2026-11-01');
    await expect(B.issueBook(admin, bookId, sid, '2026-11-01')).rejects.toThrow(/No copies/);
    const view = await B.libraryOverview(admin, '2026-11-20');
    expect(view.books[0].available).toBe(0);
    expect(view.out[0]).toMatchObject({ late: 5, dueOn: '2026-11-15' });
    await B.returnBook(admin, view.out[0].id, '2026-11-20');
    await expect(B.returnBook(admin, view.out[0].id)).rejects.toThrow(/already/);
    expect((await B.libraryOverview(admin)).books[0].available).toBe(1);

    // events
    await expect(B.addEvent(staff('staff-fac', 'faculty'), { title: 'PTM', date: '2030-01-10', endDate: null, kind: 'ptm', audience: 'parents', location: null, note: null })).rejects.toThrow(/permission/);
    await expect(B.addEvent(admin, { title: 'Exams', date: '2030-01-10', endDate: '2030-01-05', kind: 'exam', audience: 'all', location: null, note: null })).rejects.toThrow(/before the start/);
    await B.addEvent(admin, { title: 'Sankranti holidays', date: '2030-01-13', endDate: '2030-01-16', kind: 'holiday', audience: 'all', location: null, note: null });
    expect((await B.listEvents('2030-01-14')).upcoming.map((e) => e.title)).toEqual(['Sankranti holidays']);

    // homework: a teacher with no batch can't set it; heads can
    await expect(B.setHomework(staff('staff-fac', 'faculty'), { batchId: 'b-none', subject: 'Physics', title: 'DPP 1', details: null, dueOn: '2030-01-01' })).rejects.toThrow(/don’t teach/);

    // exports respect permissions
    const E = await import('./exports');
    expect(await E.buildExport(staff('staff-fd', 'front_desk'), 'students')).toBeNull();
    const csv = await E.buildExport(admin, 'students');
    expect(csv).toContain('College ID,Name');
    expect(csv).toContain('Asha Rani');
    expect(csv).toContain('+919555500001'); // admin office may see phones
    const masked = await E.buildExport(staff('staff-exam', 'academic_coordinator'), 'students');
    expect(masked).toContain('******0001');
    expect(await E.buildExport(admin, 'nope')).toBeNull();
  });
});
