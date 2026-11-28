import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: () => new Map() }));

let dir: string, cwd: string;
let T: typeof import('./attendanceTools');
let P: typeof import('./performance');
let A: typeof import('./academics');
let C: typeof import('../records/collections');
let store: () => import('../records/types').RecordStore;
const head = { id: 'staff-ac', fullName: 'Coordinator', email: null, phone: null, roles: ['academic_coordinator' as const], active: true };
const teacher = { id: 'staff-fac', fullName: 'Physics Teacher', email: null, phone: null, roles: ['faculty' as const], active: true };
let batchId = '';
const S = ['s1', 's2', 's3'];

beforeAll(async () => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-ana-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  C = await import('../records/collections');
  store = (await import('../records')).getRecordStore;
  T = await import('./attendanceTools');
  P = await import('./performance');
  A = await import('./academics');
  // students are read through the app store; stub them in the CRM file repo
  const repo = (await import('../crm/fileRepo')).createFileCrmRepo();
  const { createFileStore } = await import('../store/file');
  const st = createFileStore();
  for (const [i, name] of ['Asha Rao', 'Ravi Kumar', 'Meena S'].entries()) {
    const { leadId } = await st.captureLead({ name: 'Parent', phone: `+91988880010${i}`, consent: true, source: 'callback', program: 'iit-jee' });
    // admitted through the verification gate, as real students are (analytics count students with a College ID)
    await repo.updateLead(leadId, { status: 'confirmed', stage: 'counselling' }, []);
    await repo.signOffStage(leadId, 'application', 'staff-anil', null);
    await repo.signOffStage(leadId, 'documents', 'staff-office', null);
    await repo.addPayment({ leadId, amount: 50000, mode: 'cash', reference: null, paidOn: '2026-11-02', status: 'approved', recordedBy: 'staff-accounts', approvedBy: 'staff-accounts', approvedAt: '' });
    await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
    await repo.issueReceipts(leadId, 'staff-accounts');
    await repo.createStudent(leadId, { fullName: name, dob: '2010-01-01', gender: 'female', program: 'iit-jee', stay: 'day', guardianName: 'P', guardianPhone: `+91988880010${i}`, loginPhone: null }, 'x');
    await repo.issueCollegeId(leadId, 'staff-adminoffice');
    S[i] = (await repo.getVerification(leadId)).student!.id;
  }
  const b = await C.batches.put(store(), { name: 'JEE-1A', program: 'iit-jee', year: 1, section: 'A', capacity: 40, classTeacherId: null, studentIds: S, active: true });
  batchId = b.id;
  await C.timetable.put(store(), { batchId, day: 1, start: '09:00', end: '10:00', subject: 'Physics', facultyId: teacher.id, room: null });
});
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

describe('attendance analytics', () => {
  it('computes today, range %, late as present, leave excluded, and the below-threshold list', async () => {
    const day = (d: string, marks: string[]) => C.attendance.put(store(), { batchId, date: d, period: 'day', marks: Object.fromEntries(S.map((s, i) => [s, marks[i]])), remarks: {}, markedBy: head.id, notifiedAbsent: [], corrections: [] });
    const { todayIST, addDays } = await import('../dates');
    const t = todayIST();
    await day(addDays(t, -2), ['present', 'absent', 'present']);
    await day(addDays(t, -1), ['late', 'absent', 'leave']);
    await day(t, ['present', 'present', 'absent']);
    const a = await T.attendanceAnalytics(head, { from: addDays(t, -10), to: t, threshold: 75 });
    expect(a.totalStudents).toBe(3);
    expect(a.today_).toMatchObject({ present: 2, absent: 1, unmarked: 0 });
    expect(a.overall).toMatchObject({ present: 4, late: 1, absent: 3, leave: 1 });
    expect(a.overall.pct).toBe(62.5); // (4+1)/(4+1+3)
    const s2 = a.students.find((x) => x.id === S[1])!;
    expect(s2.pct).toBe(33); // 1 of 3
    expect(a.below.map((x) => x.id).sort()).toEqual([S[1], S[2]].sort()); // s3: present, leave, absent = 1/2 = 50%
    // low-attendance alert: recomputed on the server, one message per family per day, staff-only
    const f = { from: addDays(t, -10), to: t, threshold: 75 };
    await expect(T.notifyLowAttendance({ ...head, roles: ['telecaller'] } as never, f)).rejects.toThrow(/permission/);
    expect(await T.notifyLowAttendance(head, f)).toEqual({ sent: 2, skipped: 0, students: 2 });
    expect(await T.notifyLowAttendance(head, f)).toEqual({ sent: 0, skipped: 2, students: 2 });
    const msg = (await C.messages.list(store(), { k1: S[1] }))[0].data;
    expect(msg).toMatchObject({ from: 'staff', staffId: head.id });
    expect(msg.text).toMatch(/^Attendance alert: .*33% \(required 75%\): 2 absent/);
    expect(await C.messages.list(store(), { k1: S[0] })).toHaveLength(0); // above threshold: nothing sent
  });

  it('subject registers stay separate; teachers only take subjects they teach; old corrections need approval', async () => {
    const { todayIST, addDays } = await import('../dates');
    const t = todayIST();
    await expect(T.markSubjectAttendance(teacher, batchId, t, 'Chemistry', {})).rejects.toThrow(/don’t teach Chemistry/);
    await T.markSubjectAttendance(teacher, batchId, t, 'Physics', { [S[0]]: 'present', [S[1]]: 'absent', [S[2]]: 'present' });
    const a = await T.attendanceAnalytics(head, { from: t, to: t });
    expect(a.subjectWise).toEqual([expect.objectContaining({ subject: 'Physics', present: 2, absent: 1 })]);
    expect(a.today_.absent).toBe(1); // still the daily register only
    // an old daily register: the teacher's change becomes a request
    const old = addDays(t, -20);
    await C.attendance.put(store(), { batchId, date: old, period: 'day', marks: Object.fromEntries(S.map((s) => [s, 'absent'])), remarks: {}, markedBy: head.id, notifiedAbsent: S, corrections: [] });
    await expect(A.markAttendance(teacher, batchId, old, Object.fromEntries(S.map((s) => [s, 'present'])), {}, '')).rejects.toThrow(/reason/);
    const r = await A.markAttendance(teacher, batchId, old, { [S[0]]: 'present', [S[1]]: 'absent', [S[2]]: 'absent' }, {}, 'Medical certificate shown');
    expect(r.requested).toBe(1);
    const [req] = await T.pendingCorrections(head);
    await expect(T.decideCorrection(teacher, req.id, 'approve', null)).rejects.toThrow(/academic coordinator/);
    await T.decideCorrection(head, req.id, 'approve', null);
    const reg = (await C.attendance.list(store(), { k1: batchId, k2: old }))[0];
    expect(reg.data.marks[S[0]]).toBe('present');
    expect(reg.data.corrections.at(-1)?.by).toBe(head.id);
  });
});

describe('chapter-wise performance', () => {
  it('finds strong and weak chapters, trend and recommendations from real answers only', async () => {
    const q = (id: string, chapter: string, topic = '') => ({ id, subject: 'Physics', chapter, topic, text: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answer: 0, marks: 4, negative: 1 });
    const questions = [q('k1', 'Kinematics'), q('k2', 'Kinematics'), q('k3', 'Kinematics'), q('l1', 'Laws of Motion', 'Friction'), q('l2', 'Laws of Motion', 'Friction'), q('l3', 'Laws of Motion', 'Newton 3rd law')];
    const { scoreAttempt } = await import('./logic');
    let d = 1;
    for (const ans of [{ k1: 0, k2: 0, k3: 0, l1: 1, l2: 2, l3: 0 }, { k1: 0, k2: 0, k3: 1, l1: 1, l2: 1, l3: -1 }]) {
      const t = await C.tests.put(store(), { batchId, title: `Weekly ${d}`, date: `2026-1${d}-01`, mode: 'online', durationMin: 30, maxMarks: 24, subjects: ['Physics'], examType: 'weekly', questions, published: true, createdBy: head.id });
      const s = scoreAttempt({ questions, maxMarks: 24 }, ans);
      await C.testResults.put(store(), { testId: t.id, studentId: S[0], ...s, answers: ans, secondsPerQuestion: {}, startedAt: 'x', submittedAt: new Date().toISOString() });
      d++;
    }
    const p = (await P.studentPerformance(S[0]))!;
    expect(p.exams).toHaveLength(2);
    expect(p.strong.map((c) => c.chapter)).toEqual(['Kinematics']); // 5 of 6 right
    expect(p.weak.map((c) => c.chapter)).toEqual(['Laws of Motion']); // 1 right of 5 tried, 1 skipped
    expect(p.weakTopics[0].topic).toBe('Laws of Motion › Friction');
    expect(p.recommendations[0]).toMatch(/^Revise Laws of Motion/);
    expect(p.bySubject[0]).toMatchObject({ subject: 'Physics', max: 48 });
    const c = await P.classPerformance(head, batchId);
    expect(c.examTrend).toHaveLength(2);
    expect(c.top[0].id).toBe(S[0]);
    await expect(P.classPerformance({ ...teacher, roles: ['telecaller' as never] }, batchId)).rejects.toThrow();
  });
});

describe('sports teams and certificates', () => {
  it('coach builds a team (real students only, captain must be a member); student sees it; certificate is a PDF', async () => {
    const SP = await import('../studentLife/sports');
    const { sportsCertificatePdf } = await import('../studentLife/certificatePdf');
    const coach = { id: 'staff-coach', fullName: 'Coach', email: null, phone: null, roles: ['sports_coach' as const], active: true };
    await expect(SP.addTeam(head, { name: 'XI', sport: 'Football', coach: 'Mr. R' })).rejects.toThrow(/Sports Coach/);
    await expect(SP.addTeam(coach, { name: 'XI', sport: 'Rugby', coach: 'Mr. R' })).rejects.toThrow(/from the list/);
    const team = await SP.addTeam(coach, { name: 'BJC Football XI', sport: 'Football', coach: 'Mr. R' });
    await expect(SP.addTeam(coach, { name: 'bjc football xi', sport: 'Football', coach: 'X' })).rejects.toThrow(/already exists/);
    await expect(SP.setTeamMembers(coach, team.id, [S[0]], S[1])).rejects.toThrow(/captain must be/);
    const saved = await SP.setTeamMembers(coach, team.id, [S[0], S[1], 'not-a-student', S[0]], S[1]);
    expect(saved.data.memberIds).toEqual([S[0], S[1]]);
    expect(await SP.teamsOf(S[1])).toEqual([{ name: 'BJC Football XI', sport: 'Football', coach: 'Mr. R', captain: true }]);
    expect(await SP.teamsOf(S[2])).toEqual([]);
    const ach = await SP.addAchievement(coach, { studentId: S[0], title: 'Winners', medal: 'gold', event: 'Inter-college football', date: '2026-11-20' });
    const a = (await SP.achievementById(ach.id))!;
    expect(a).toMatchObject({ name: 'Asha Rao', medal: 'gold' });
    expect((await SP.achievementsOf(S[0]))[0].id).toBe(ach.id);
    const pdf = await sportsCertificatePdf(a);
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF');
  });
});