import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Staff } from '../crm/types';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: () => new Headers() }));

let dir: string;
let cwd: string;
let A: typeof import('./academics');
let M: typeof import('./mentoring');
let O: typeof import('./operations');
let F: typeof import('./accounts');
let repo: import('../crm/types').CrmRepo;
let store: import('../store/types').Store;
let app: import('../app/types').AppStore;
let outbound: () => Promise<{ template: string }[]>;

const st = (id: string, roles: Staff['roles']): Staff => ({ id, fullName: id, email: null, phone: null, roles, active: true });
const coordinator = st('staff-coord', ['academic_coordinator']);
const faculty = st('staff-fac', ['faculty']);
const otherFaculty = st('staff-fac2', ['faculty']);
const mentor = st('staff-mentor', ['class_teacher']);
const warden = st('staff-warden', ['hostel_warden']);
const accounts = st('staff-accounts', ['accounts']);
const manager = st('staff-manager', ['admission_manager']);
const management = st('staff-mgmt', ['management']);
const adminOffice = st('staff-adminoffice', ['admin_office']);

let s1: string; // girl, hosteller
let s2: string; // boy, day scholar
let batchId: string;

async function admit(phone: string, name: string, gender: 'female' | 'male', stay: 'day' | 'hostel') {
  const { leadId } = await store.captureLead({ name: `Parent of ${name}`, phone, consent: true, source: 'callback', program: 'iit-jee' });
  await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-anil', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  await repo.addPayment({ leadId, amount: 60000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: new Date().toISOString() });
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: name, dob: '2011-01-01', gender, program: 'iit-jee', stay, guardianName: 'Parent', guardianPhone: phone, loginPhone: null }, 'staff-adminoffice');
  await repo.issueCollegeId(leadId, 'staff-adminoffice');
  const s = (await app.listStudents()).find((x) => x.leadId === leadId)!;
  await app.addGuardian({ studentId: s.id, phone, name: 'Parent', relation: 'mother', addedBy: null });
  return { id: s.id, leadId };
}

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-school-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  A = await import('./academics');
  M = await import('./mentoring');
  O = await import('./operations');
  F = await import('./accounts');
  const file = await import('../store/file');
  outbound = () => file.tx((db) => db.waMessages as { template: string }[], false);
  repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  store = (await import('../store/file')).createFileStore();
  app = (await import('../app/fileStore')).createFileAppStore();
  s1 = (await admit('+919811100001', 'Asha Rao', 'female', 'hostel')).id;
  s2 = (await admit('+919811100002', 'Ravi Kumar', 'male', 'day')).id;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('batches & timetable', () => {
  it('creates a batch within the 40 cap and allots students', async () => {
    await expect(A.saveBatch(coordinator, { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 45, classTeacherId: mentor.id, active: true })).rejects.toThrow('capped');
    await expect(A.saveBatch(faculty, { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 2, classTeacherId: mentor.id, active: true })).rejects.toThrow('permission');
    const b = await A.saveBatch(coordinator, { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 2, classTeacherId: mentor.id, active: true });
    batchId = b.id;
    await A.allotStudent(coordinator, s1, batchId);
    await A.allotStudent(coordinator, s2, batchId);
    const extra = await admit('+919811100003', 'Extra Student', 'male', 'day');
    await expect(A.allotStudent(coordinator, extra.id, batchId)).rejects.toThrow('full');
  });

  it('rejects timetable clashes', async () => {
    await A.addPeriod(coordinator, { batchId, day: 1, start: '08:30', end: '09:30', subject: 'Physics', facultyId: faculty.id, room: null });
    await expect(A.addPeriod(coordinator, { batchId, day: 1, start: '09:00', end: '10:00', subject: 'Chemistry', facultyId: otherFaculty.id, room: null })).rejects.toThrow('batch already');
    expect((await A.myTimetable(faculty)).map((p) => p.subject)).toEqual(['Physics']);
  });
});

describe('attendance', () => {
  it('only teachers of the batch mark it; absentees’ parents get one alert per day', async () => {
    const date = '2026-11-02';
    await expect(A.markAttendance(otherFaculty, batchId, date, { [s1]: 'present', [s2]: 'absent' })).rejects.toThrow('don’t teach');
    await expect(A.markAttendance(faculty, batchId, date, { [s1]: 'present' })).rejects.toThrow('every student');
    await expect(A.markAttendance(faculty, batchId, '2999-01-01', { [s1]: 'present', [s2]: 'absent' })).rejects.toThrow('future');
    expect(await A.markAttendance(faculty, batchId, date, { [s1]: 'present', [s2]: 'absent' })).toEqual({ absent: 1 });
    // re-marking the same day doesn't alert again
    await A.markAttendance(faculty, batchId, date, { [s1]: 'present', [s2]: 'absent' });
    const msgs = (await outbound()).filter((m) => m.template.endsWith('absence_alert'));
    expect(msgs).toHaveLength(1);
  });
});

describe('online test', () => {
  let testId: string;
  it('scores with negative marking, enforces one attempt and the clock, then ranks', async () => {
    const t = await A.createTest(faculty, { batchId, title: 'Physics WT-1', date: '2026-11-02', mode: 'online', durationMin: 10, maxMarks: 8, subjects: ['Physics'] });
    testId = t.id;
    await A.addQuestion(faculty, testId, { subject: 'Physics', chapter: 'Kinematics', text: 'v = u + ?', options: ['at', 'a/t', 't/a', 'a+t'], answer: 0 });
    await A.addQuestion(faculty, testId, { subject: 'Physics', chapter: 'Kinematics', text: 'SI unit of force?', options: ['joule', 'newton', 'watt', 'pascal'], answer: 1 });
    const qs = (await A.batchTests(batchId))[0].questions;

    const now = new Date('2026-11-02T05:00:00Z');
    await A.startAttempt(s1, testId, now);
    const r1 = await A.submitAttempt(s1, testId, { [qs[0].id]: 0, [qs[1].id]: 1 }, {}, new Date(now.getTime() + 5 * 60_000));
    expect(r1).toMatchObject({ score: 8, late: false });
    await expect(A.submitAttempt(s1, testId, {}, {}, now)).rejects.toThrow('already submitted');
    await expect(A.startAttempt(s1, testId, now)).rejects.toThrow('already submitted');

    await A.startAttempt(s2, testId, now);
    const r2 = await A.submitAttempt(s2, testId, { [qs[0].id]: 2, [qs[1].id]: 1 }, {}, new Date(now.getTime() + 30 * 60_000));
    expect(r2).toMatchObject({ late: true, score: 0 }); // after the time limit: answers not accepted

    await expect(A.addQuestion(faculty, testId, { subject: 'Physics', chapter: 'x', text: 'late q', options: ['a', 'b', 'c', 'd'], answer: 0 })).rejects.toThrow('already taken');
    await expect(A.publishTest(faculty, testId)).rejects.toThrow('exam cell');
    await A.publishTest(coordinator, testId);
    const ranks = await A.rankList(testId);
    expect(ranks.map((r) => [r.name, r.rank])).toEqual([['Asha Rao', 1], ['Ravi Kumar', 2]]);
    const mine = await A.studentResults(s1);
    expect(mine[0]).toMatchObject({ score: 8, rank: 1, percentile: 100, of: 2 });
  });
});

describe('mentoring', () => {
  it('caps mentees, keeps notes private unless shared, and raises early warnings', async () => {
    await M.assignMentor(coordinator, mentor.id, s1);
    await M.assignMentor(coordinator, mentor.id, s2);
    await M.addMentorNote(mentor, { studentId: s1, kind: 'one_to_one', note: 'Strong in mechanics.', shareWithParent: true });
    await M.addMentorNote(mentor, { studentId: s1, kind: 'note', note: 'Private observation.', shareWithParent: false });
    expect((await M.sharedNotes(s1)).map((n) => n.note)).toEqual(['Strong in mechanics.']);
    await M.recordCheckIn(mentor, { studentId: s2, month: '2026-11', stress: 2, sleep: 3, note: null });
    const list = await M.myMentees(mentor);
    const ravi = list.find((r) => r.student!.id === s2)!;
    expect(ravi.warnings.join(' ')).toMatch(/stress 2\/5/);
    expect(list[0].student!.id).toBe(s2); // warnings first
    await expect(M.addMentorNote(faculty, { studentId: s1, kind: 'note', note: 'x', shareWithParent: false })).rejects.toThrow('permission');
  });

  it('PTM booking is only with the class teacher or mentor, one family per slot', async () => {
    await M.addPtmSlots(mentor, '2099-01-10', ['10:00', '10:15'], 15);
    const slots = await M.openSlotsFor(s1);
    expect(slots).toHaveLength(2);
    await M.bookPtm('+919811100001', s1, slots[0].id);
    await expect(M.bookPtm('+919811100002', s2, slots[0].id)).rejects.toThrow('just taken');
  });

  it('parent messages reach the mentor, who replies', async () => {
    await M.sendParentMessage('+919811100001', s1, 'How is Asha doing in chemistry?');
    expect((await M.staffInbox(mentor))[0]).toMatchObject({ studentId: s1, unread: 1 });
    await M.replyToParent(mentor, s1, 'Improving steadily.');
    expect((await M.thread(s1)).map((m) => m.from)).toEqual(['parent', 'staff']);
    expect((await M.staffInbox(mentor))[0].unread).toBe(0);
  });

  it('sends the Sunday report to every guardian once', async () => {
    const r = await M.sendWeeklyReports('2026-11-08');
    expect(r.students).toBe(2);
    await M.sendWeeklyReports('2026-11-08');
    const sent = (await outbound()).filter((m) => m.template.endsWith('weekly_report'));
    expect(sent).toHaveLength(2);
  });
});

describe('hostel', () => {
  it('keeps blocks separate, enforces room capacity, and runs the out-pass chain student → parent → warden', async () => {
    const room = await O.saveRoom(warden, { block: 'girls', room: 'G-101', ac: true, capacity: 3 });
    await expect(O.allotRoom(warden, s2, room.id)).rejects.toThrow('hostellers');
    await O.allotRoom(warden, s1, room.id);
    const boys = await O.saveRoom(warden, { block: 'boys', room: 'B-101', ac: false, capacity: 4 });
    await expect(O.allotRoom(warden, s1, boys.id)).rejects.toThrow('separate');

    const from = new Date(Date.now() + 3600_000).toISOString();
    const to = new Date(Date.now() + 5 * 3600_000).toISOString();
    const op = await O.requestOutpass(s1, { from, to, reason: 'Family function' });
    await expect(O.requestOutpass(s1, { from, to, reason: 'Again' })).rejects.toThrow('already');
    await expect(O.wardenDecideOutpass(warden, op.id, true, null)).rejects.toThrow('parent must approve');
    await expect(O.parentDecideOutpass('+919811100002', op.id, true)).rejects.toThrow('not found');
    await O.parentDecideOutpass('+919811100001', op.id, true);
    await O.wardenDecideOutpass(warden, op.id, true, null);
    await O.markReturned(warden, op.id);
    expect((await O.outpassesFor(s1))[0].status).toBe('returned');
  });
});

describe('accounts', () => {
  it('computes dues from the schedule and approved payments', async () => {
    await F.saveSchedule(accounts, s1, [
      { due: '2026-06-01', amount: 50000, label: 'Instalment 1' },
      { due: '2026-09-01', amount: 50000, label: 'Instalment 2' },
    ]);
    const d = await F.duesForStudent(s1, '2026-11-02');
    expect(d).toMatchObject({ outstanding: 40000, overdue: 40000 });
  });

  it('routes concessions: manager up to the slab, management above; nobody approves their own', async () => {
    const lead = (await app.listStudents()).find((s) => s.id === s1)!.leadId;
    const small = await F.requestFeeChange(manager, { kind: 'concession', leadId: lead, amount: 13500, reason: 'Sibling' }); // 10% of tuition
    expect(small.data.level).toBe('slab');
    await expect(F.decideFeeChange(manager, small.id, true, null)).rejects.toThrow('Someone else');
    const big = await F.requestFeeChange(accounts, { kind: 'concession', leadId: lead, amount: 100000, reason: 'Hardship' });
    expect(big.data.level).toBe('above');
    await expect(F.decideFeeChange(manager, big.id, true, null)).rejects.toThrow('Management');
    await F.decideFeeChange(management, big.id, true, 'Approved by chairman');
    await expect(F.requestFeeChange(accounts, { kind: 'refund', leadId: lead, amount: 999999, reason: 'x' })).rejects.toThrow('exceed');
  });
});

describe('admin office', () => {
  it('numbers certificates and issues a TC only once', async () => {
    const c1 = await O.issueCertificate(adminOffice, { studentId: s1, kind: 'bonafide', purpose: 'Bank account', conduct: null });
    const c2 = await O.issueCertificate(adminOffice, { studentId: s2, kind: 'bonafide', purpose: 'Passport', conduct: null });
    expect(c1.data.number).toMatch(/^BJC\/BF\/\d{4}\/0001$/);
    expect(c2.data.number).toMatch(/0002$/);
    await O.issueCertificate(adminOffice, { studentId: s2, kind: 'tc', purpose: null, conduct: 'Good' });
    await expect(O.issueCertificate(adminOffice, { studentId: s2, kind: 'tc', purpose: null, conduct: 'Good' })).rejects.toThrow('already');
    await expect(O.issueCertificate(faculty, { studentId: s1, kind: 'study', purpose: null, conduct: null })).rejects.toThrow('permission');
  });
});
