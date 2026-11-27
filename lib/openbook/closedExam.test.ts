import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let dir: string, cwd: string;
beforeAll(() => {
  cwd = process.cwd();
  dir = mkdtempSync(path.join(tmpdir(), 'bjc-exam-'));
  process.chdir(dir);
  delete process.env.SUPABASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

const head = { id: 'ac', fullName: 'Coordinator', email: null, phone: null, roles: ['academic_coordinator' as never], active: true };
const telecaller = { ...head, id: 'tc', roles: ['telecaller' as never] };
const rules = { fullscreen: true, maxFocusLoss: 2, shuffleQuestions: true, shuffleOptions: true, singleDevice: true, showAnswers: true, opensAt: null, closesAt: null };

describe('closed-book examinations', () => {
  it('per-student order, one device, window changes recorded and auto-submitted at the limit, ordinary path refused', async () => {
    await (await import('./seed')).importPracticeBank();
    const { batches } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const b = await batches.put(getRecordStore(), { name: 'EX 1A', program: 'IIT-JEE', year: 1, section: 'A', capacity: 40, classTeacherId: null, studentIds: ['s1', 's2'], active: true });
    const X = await import('./closedExam');
    const M = await import('./mocks');
    const input = { title: 'JEE Main mock 1', examId: 'jee-main', subjects: ['Physics'], chapters: [], concepts: [], count: 12, difficulty: null, minutes: 30, marks: null, negative: null, source: 'pool' as const };
    await expect(X.createClosedExam(telecaller, b.id, input, rules)).rejects.toThrow();
    const id = await X.createClosedExam(head, b.id, input, rules);
    const m = (await M.getMock(id))!;
    expect(new Set(m.questionIds).size).toBe(m.questionIds.length); // no repeats
    expect(m.marks).toBe(4); expect(m.negative).toBe(1); // JEE Main pattern
    // students only see it as an exam, never as an ordinary mock
    expect((await M.mocksFor('s1', b.id)).some((x) => x.id === id)).toBe(false);
    await expect(M.startAttempt('s1', b.id, id)).rejects.toThrow(/closed-book/);
    expect((await X.examsForStudent('s1', b.id)).map((x) => x.id)).toEqual([id]);
    // another batch can't take it
    await expect(X.startClosedAttempt('s9', 'other', id, 'device-aaaa-1111')).rejects.toThrow(/not found/);
    const a1 = await X.startClosedAttempt('s1', b.id, id, 'device-aaaa-1111');
    const a2 = await X.startClosedAttempt('s2', b.id, id, 'device-bbbb-2222');
    const at1 = await M.getAttempt('s1', a1), at2 = await M.getAttempt('s2', a2);
    expect([...at1.order].sort()).toEqual([...m.questionIds].sort());
    expect(at1.order.join() === at2.order.join() && JSON.stringify(at1.optionOrder) === JSON.stringify(at2.optionOrder)).toBe(false); // shuffled per student
    // same student, other device: refused and logged
    await expect(X.startClosedAttempt('s1', b.id, id, 'device-cccc-3333')).rejects.toThrow(/another device/);
    await expect(X.closedSave('s1', a1, 'device-cccc-3333', { answers: {} })).rejects.toThrow(/another device/);
    // ordinary save / submit refused for closed exams
    await expect(M.saveAnswers('s1', a1, { answers: {} })).rejects.toThrow(/closed-book/);
    await expect(M.submit('s1', b.id, a1)).rejects.toThrow(/closed-book/);
    // answer: first question right, second wrong (negative mark)
    const qs = await (await import('./questions')).getQuestions(at1.order.slice(0, 2));
    const q1 = qs.find((q) => q.id === at1.order[0])!, q2 = qs.find((q) => q.id === at1.order[1])!;
    const wrong = String((Number(q2.answer[0]) + 1) % q2.options.length);
    await X.closedSave('s1', a1, 'device-aaaa-1111', { answers: { [q1.id]: [q1.answer[0]], [q2.id]: [wrong] } });
    expect((await X.recordEvent('s1', b.id, a1, 'device-aaaa-1111', 'hidden')).submitted).toBe(false);
    const r = await X.recordEvent('s1', b.id, a1, 'device-aaaa-1111', 'fullscreen_exit');
    expect(r).toMatchObject({ submitted: true, focusLosses: 2 });
    const done = await M.getAttempt('s1', a1);
    expect(done.status).toBe('submitted');
    expect(done.auto).toBe(true);
    expect(done.score).toBe(3); // +4 − 1
    const rep = await X.closedReport('s1', a1);
    expect(rep.summary).toMatchObject({ correct: 1, wrong: 1 });
    expect(rep.bySubject[0].subject).toBe('Physics');
    const d = await X.examDashboard(head, id);
    expect(d.rows.find((x) => x.studentId === 's1')).toMatchObject({ status: 'submitted', focusLosses: 2, otherDevice: 1 });
    expect(d.suspicious.map((x) => x.studentId)).toContain('s1');
    expect(d.batchSize).toBe(2);
  }, 60_000);

  it('respects the exam window', async () => {
    const { batches } = await import('../records/collections');
    const { getRecordStore } = await import('../records');
    const b = await batches.put(getRecordStore(), { name: 'EX 1B', program: 'IIT-JEE', year: 1, section: 'B', capacity: 40, classTeacherId: null, studentIds: ['s3'], active: true });
    const X = await import('./closedExam');
    const id = await X.createClosedExam(head, b.id, { title: 'Later', examId: 'jee-main', subjects: ['Physics'], chapters: [], concepts: [], count: 3, difficulty: null, minutes: 10, marks: null, negative: null, source: 'pool' }, { ...rules, opensAt: new Date(Date.now() + 3600_000).toISOString(), closesAt: new Date(Date.now() + 7200_000).toISOString() });
    await expect(X.startClosedAttempt('s3', b.id, id, 'device-dddd-4444')).rejects.toThrow(/opens at/);
  });
});
