import { describe, expect, it } from 'vitest';
import { curriculumMap, QUESTIONS, SUBJECTS } from './bank';
import { badges, differentiate, goalProgress, leaderboard, levelFor, mark, misconceptions, pickQuestions, streak, summary, weekStart, type Attempt } from './logic';

describe('practice question bank', () => {
  it('has 300+ well-formed questions across all four subjects', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(300);
    for (const s of SUBJECTS) expect(QUESTIONS.filter((q) => q.subject === s).length).toBeGreaterThanOrEqual(60);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.misconceptions[q.answer]).toBeNull();
      expect(q.misconceptions.filter((m) => m === null)).toHaveLength(1);
      expect(q.curriculum.length).toBeGreaterThan(0);
      expect(q.solution.length).toBeGreaterThan(5);
    }
  });

  it('computes correct answers (spot checks)', () => {
    const v = QUESTIONS.find((q) => q.id === 'p-kin-3')!; // u=6, a=4, t=5 → 26
    expect(v.options[v.answer]).toBe('26');
    const ph = QUESTIONS.find((q) => q.id === 'c-ph-4')!;
    expect(ph.options[ph.answer]).toBe('5');
    const hw = QUESTIONS.find((q) => q.id === 'b-hw-0')!; // q=0.1 → 2pq = 0.18
    expect(hw.options[hw.answer]).toBe('0.18');
  });

  it('maps chapters to syllabi', () => {
    const map = curriculumMap();
    expect(map.find((r) => r.chapter === 'Kinematics')?.byCurriculum).toEqual({ 'TS Inter': 20, 'JEE Main': 20, NEET: 20 });
    expect(map.find((r) => r.chapter === 'Evolution')?.byCurriculum['JEE Main']).toBe(0);
  });
});

const att = (p: Partial<Attempt>): Attempt => ({ studentId: 's1', questionId: 'q', chosen: 0, correct: true, subject: 'Physics', chapter: 'Kinematics', difficulty: 'medium', misconception: null, xp: 10, date: '2026-11-04', ...p });

describe('practice rules', () => {
  it('marks instantly with XP by difficulty and the misconception behind a wrong pick', () => {
    const q = QUESTIONS.find((x) => x.id === 'm-quad-0')!;
    const wrong = (q.answer + 1) % 4;
    const out = mark({ [q.id]: q.answer, 'm-diff-0': -5, nope: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ correct: true, xp: 5 });
    const w = mark({ [q.id]: wrong })[0];
    expect(w.correct).toBe(false);
    expect(w.misconception).toBe(q.misconceptions[wrong]);
  });

  it('levels, streaks, badges and goals', () => {
    expect([levelFor(0), levelFor(49), levelFor(50), levelFor(200)]).toEqual([1, 1, 2, 3]);
    expect(streak(['2026-11-02', '2026-11-03', '2026-11-04'], '2026-11-04')).toBe(3);
    expect(streak(['2026-11-02', '2026-11-03'], '2026-11-04')).toBe(2); // today not yet practised
    expect(streak(['2026-11-01'], '2026-11-04')).toBe(0);
    const many = Array.from({ length: 20 }, () => att({}));
    expect(summary(many, '2026-11-04')).toMatchObject({ questions: 20, accuracy: 100, xp: 200, level: 3 });
    expect(badges(many, '2026-11-04').map((b) => b.key)).toEqual(expect.arrayContaining(['first', 'sharp', 'master:Kinematics']));
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // Wednesday → Monday
    expect(goalProgress({ questions: 10, accuracy: 70 }, many.slice(0, 5))).toMatchObject({ done: 5, questionsMet: false, accuracyMet: true });
    expect(goalProgress(null, [])).toBeNull();
  });

  it('finds misconceptions shared by 2+ students, differentiates and ranks', () => {
    const a = [
      att({ studentId: 's1', correct: false, misconception: 'Sign error', xp: 0 }),
      att({ studentId: 's2', correct: false, misconception: 'Sign error', xp: 0 }),
      att({ studentId: 's3', correct: false, misconception: 'Other', xp: 0 }),
      att({ studentId: 's3', correct: true, xp: 10 }),
      att({ studentId: 's3', correct: true, xp: 10 }),
      att({ studentId: 's3', correct: true, xp: 10 }),
      att({ studentId: 's3', correct: true, xp: 10 }),
    ];
    expect(misconceptions(a)).toEqual([{ chapter: 'Kinematics', misconception: 'Sign error', studentIds: ['s1', 's2'], times: 2 }]);
    expect(differentiate(['s1', 's3', 's4'], a, 'Kinematics')).toEqual({ easy: ['s1', 's4'], medium: [], hard: ['s3'] });
    expect(leaderboard(a, '2026-11-01')[0]).toEqual({ studentId: 's3', xp: 40 });
  });

  it('picks fresh questions deterministically', () => {
    const one = pickQuestions({ subject: 'Physics', chapter: 'Kinematics', difficulty: null }, new Set(), 's1:2026-11-04');
    const two = pickQuestions({ subject: 'Physics', chapter: 'Kinematics', difficulty: null }, new Set(), 's1:2026-11-04');
    expect(one.map((q) => q.id)).toEqual(two.map((q) => q.id));
    expect(one).toHaveLength(5);
    const solved = new Set(one.map((q) => q.id));
    expect(pickQuestions({ subject: 'Physics', chapter: 'Kinematics' }, solved, 's1:2026-11-04').some((q) => solved.has(q.id))).toBe(false);
  });
});
