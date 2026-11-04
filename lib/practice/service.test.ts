import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string;
let cwd: string;

beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-practice-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

const staff = (id: string, role: string) => ({ id, fullName: id, email: null, phone: null, roles: [role] as never, active: true });

async function admit(phone: string, name: string) {
  const { createFileStore } = await import('../store/file');
  const { createFileCrmRepo } = await import('../crm/fileRepo');
  const store = createFileStore();
  const repo = createFileCrmRepo();
  const { leadId } = await store.captureLead({ name: 'Parent', phone, consent: true, source: 'callback', program: 'iit-jee' });
  await repo.updateLead(leadId, { status: 'confirmed' }, []);
  await repo.signOffStage(leadId, 'application', 'staff-office', null);
  await repo.signOffStage(leadId, 'documents', 'staff-office', null);
  const pid = await repo.addPayment({ leadId, amount: 1000, mode: 'upi', reference: `R${phone}`, paidOn: '2026-11-02', status: 'pending_approval', recordedBy: 'staff-frontdesk', approvedBy: null, approvedAt: null });
  await repo.decidePayment(pid, true, 'staff-accounts');
  await repo.signOffStage(leadId, 'fee', 'staff-accounts', null);
  await repo.issueReceipts(leadId, 'staff-accounts');
  await repo.createStudent(leadId, { fullName: name, dob: '2011-01-01', gender: 'female', program: 'iit-jee', stay: 'day', guardianName: 'Parent', guardianPhone: phone }, 'staff-adminoffice');
  await repo.issueCollegeId(leadId, 'staff-adminoffice');
  return (await repo.getVerification(leadId)).student!.id;
}

describe('practice: student → teacher → parent', () => {
  it('marks and stores attempts, finds shared misconceptions, differentiates, shares a report', async () => {
    const s1 = await admit('+919666611001', 'Asha');
    const s2 = await admit('+919666611002', 'Ravi');
    const { getRecordStore } = await import('../records');
    const { batches } = await import('../records/collections');
    const batch = await batches.put(getRecordStore(), { name: 'JEE A', program: 'iit-jee', year: 1, section: 'A', capacity: 40, classTeacherId: 'staff-ct', studentIds: [s1, s2], active: true });

    const { QUESTIONS } = await import('./bank');
    const P = await import('./service');
    const q = QUESTIONS.find((x) => x.id === 'p-kin-0')!;
    const wrong = (q.answer + 1) % 4;
    const today = '2026-11-04';

    // Both students make the same mistake; Asha also gets one right.
    const r1 = await P.submitSession(s1, { [q.id]: wrong, 'p-kin-1': QUESTIONS.find((x) => x.id === 'p-kin-1')!.answer }, null, today);
    expect(r1.find((r) => r.id === q.id)).toMatchObject({ correct: false, misconception: q.misconceptions[wrong] });
    expect(r1.find((r) => r.id === 'p-kin-1')).toMatchObject({ correct: true, xp: 5 });
    await P.submitSession(s2, { [q.id]: wrong }, null, today);
    await expect(P.submitSession(s1, { nope: 1 }, null, today)).rejects.toThrow(/at least one/);

    const home = await P.studentPractice(s1, today);
    expect(home.summary).toMatchObject({ questions: 2, correct: 1, xp: 5, streak: 1 });
    expect(home.leaderboard[0]).toMatchObject({ name: 'Asha', xp: 5, me: true });

    await P.setGoal(s1, { questions: 10, accuracy: 70 }, today);
    expect((await P.studentPractice(s1, today)).goal).toMatchObject({ questions: 10, done: 2 });

    const teacher = staff('staff-ct', 'class_teacher');
    const view = await P.teacherPractice(teacher, batch.id, today);
    expect(view.misconceptions![0]).toMatchObject({ chapter: 'Kinematics', misconception: q.misconceptions[wrong], names: ['Asha', 'Ravi'] });

    // One-click differentiation: Ravi 0% → easy; Asha 50% → medium. Each sees only their own level.
    expect(await P.differentiateSet(teacher, { batchId: batch.id, subject: 'Physics', chapter: 'Kinematics', count: 5 }, today)).toMatch(/1 easy, 1 medium, 0 hard/);
    expect((await P.studentPractice(s2, today)).program.map((x) => x.difficulty)).toEqual(['easy']);
    expect((await P.studentPractice(s1, today)).program.map((x) => x.difficulty)).toEqual(['medium']);

    await P.addLesson(teacher, { batchId: batch.id, subject: 'Physics', topic: 'Equations of motion', date: today, notes: null });
    const lesson = (await P.teacherPractice(teacher, batch.id, today)).lessons![0];
    await P.toggleLesson(teacher, lesson.id);
    expect((await P.teacherPractice(teacher, batch.id, today)).lessonProgress).toBe(100);

    // A teacher of another batch can't act on this one.
    await expect(P.assignSet(staff('staff-other', 'faculty'), { batchId: batch.id, subject: 'Physics', chapter: 'Kinematics', difficulty: 'easy', count: 5 }, today)).rejects.toThrow(/don’t teach/);

    // One-click parent report.
    await P.shareWithParent(teacher, s1, today);
    const reports = await P.reportsForStudent(s1);
    expect(reports[0].text).toMatch(/Asha: \d+ practice questions/);

    const stats = await P.schoolStats(staff('staff-principal', 'principal'), today);
    expect(stats).toMatchObject({ questions: 3, activeThisWeek: 2 });
  });
});
