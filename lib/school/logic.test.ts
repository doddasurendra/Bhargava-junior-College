import { describe, expect, it } from 'vitest';
import { approvalLevel, attendanceSummary, consecutiveAbsences, duesFor, earlyWarnings, rankResults, scoreAttempt, timetableClash, weakChapters, weeklyReportParams } from './logic';

const q = (id: string, subject: string, chapter: string, answer = 0) => ({ id, subject, chapter, text: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answer, marks: 4, negative: 1 });

describe('test scoring', () => {
  const test = { maxMarks: 20, questions: [q('1', 'Physics', 'Kinematics'), q('2', 'Physics', 'Kinematics', 2), q('3', 'Chemistry', 'Bonding', 1), q('4', 'Chemistry', 'Bonding'), q('5', 'Mathematics', 'Limits', 3)] };

  it('scores +4 / −1 with skips, per subject and chapter', () => {
    const r = scoreAttempt(test, { '1': 0, '2': 1, '3': 1, '5': -1 });
    // +4 −1 +4, Q4 missing and Q5 skipped
    expect(r).toMatchObject({ score: 7, max: 20, bySubject: { Physics: 3, Chemistry: 4, Mathematics: 0 } });
    expect(r.byChapter['Physics · Kinematics']).toEqual({ right: 1, wrong: 1, skipped: 0 });
    expect(r.byChapter['Chemistry · Bonding']).toEqual({ right: 1, wrong: 0, skipped: 1 });
  });

  it('allows a negative total and a perfect score', () => {
    expect(scoreAttempt(test, { '1': 3, '2': 3, '3': 3, '4': 3, '5': 0 }).score).toBe(-5);
    expect(scoreAttempt(test, { '1': 0, '2': 2, '3': 1, '4': 0, '5': 3 }).score).toBe(20);
  });

  it('flags weak chapters', () => {
    const r = scoreAttempt(test, { '1': 1, '2': 1, '3': 1, '4': 0 });
    expect(weakChapters(r.byChapter).map((c) => c.chapter)).toEqual(['Physics · Kinematics']);
  });
});

describe('rank and percentile', () => {
  it('uses competition ranking for ties', () => {
    const r = rankResults([
      { studentId: 'a', score: 80 },
      { studentId: 'b', score: 95 },
      { studentId: 'c', score: 80 },
      { studentId: 'd', score: 40 },
    ]);
    expect(r.get('b')).toEqual({ rank: 1, percentile: 100 });
    expect(r.get('a')!.rank).toBe(2);
    expect(r.get('c')!.rank).toBe(2);
    expect(r.get('d')).toEqual({ rank: 4, percentile: 25 });
  });
});

describe('attendance', () => {
  const regs = [
    { date: '2026-11-02', marks: { s1: 'present' as const, s2: 'absent' as const } },
    { date: '2026-11-03', marks: { s1: 'late' as const, s2: 'absent' as const } },
    { date: '2026-11-04', marks: { s1: 'leave' as const, s2: 'absent' as const } },
    { date: '2026-11-05', marks: { s1: 'absent' as const, s2: 'present' as const } },
  ];
  it('counts late as attended and leaves leave out of the percentage', () => {
    expect(attendanceSummary(regs, 's1')).toMatchObject({ present: 1, late: 1, leave: 1, absent: 1, days: 4, pct: 67 });
    expect(attendanceSummary(regs, 'nobody').pct).toBeNull();
  });
  it('counts the current absence streak', () => {
    expect(consecutiveAbsences(regs, 's2')).toBe(0);
    expect(consecutiveAbsences(regs.slice(0, 3), 's2')).toBe(3);
  });
});

describe('early warning (§12.5)', () => {
  it('is quiet for a student doing fine', () => expect(earlyWarnings({ attendancePct: 92, scorePcts: [60, 64, 70], latestStress: 4, consecutiveAbsences: 0 })).toEqual([]));
  it('flags attendance, streaks, a falling trend, a low score and stress', () => {
    const w = earlyWarnings({ attendancePct: 70, scorePcts: [70, 55, 30], latestStress: 2, consecutiveAbsences: 3 });
    expect(w).toHaveLength(5);
    expect(w.join(' ')).toMatch(/Attendance 70%.*3 days.*falling.*Latest test 30%.*stress 2\/5/);
  });
  it('needs a real fall, not noise', () => expect(earlyWarnings({ attendancePct: null, scorePcts: [62, 60, 58], latestStress: null, consecutiveAbsences: 0 })).toEqual([]));
});

describe('fees', () => {
  const plan = [
    { due: '2027-06-01', amount: 50000, label: 'Instalment 1' },
    { due: '2027-09-01', amount: 50000, label: 'Instalment 2' },
    { due: '2027-12-01', amount: 50000, label: 'Instalment 3' },
  ];
  it('applies payments oldest first and finds overdue amounts', () => {
    const d = duesFor(plan, 70000, '2027-10-01');
    expect(d.rows.map((r) => r.outstanding)).toEqual([0, 30000, 50000]);
    expect(d.rows.map((r) => r.overdue)).toEqual([false, true, false]);
    expect(d).toMatchObject({ outstanding: 80000, overdue: 30000, credit: 0 });
    expect(duesFor(plan, 160000, '2027-10-01').credit).toBe(10000);
  });
  it('routes concessions by the scholarship slab and refunds to management (§9A.3)', () => {
    expect(approvalLevel('concession', 40, 60)).toBe('slab');
    expect(approvalLevel('concession', 60, 60)).toBe('slab');
    expect(approvalLevel('concession', 61, 60)).toBe('above');
    expect(approvalLevel('concession', null, 60)).toBe('above');
    expect(approvalLevel('refund', 5, 60)).toBe('above');
  });
});

describe('weekly parent report (§6.9)', () => {
  it('summarises attendance, tests and the mentor note', () => {
    expect(weeklyReportParams({ studentFirstName: 'Asha', weekLabel: '2–8 Nov', attendance: { present: 5, days: 6 }, tests: [{ title: 'Physics WT-4', pct: 72.4 }], mentorNote: 'Good effort\nin mechanics.' })).toEqual(['Asha', '2–8 Nov', '5/6 days', 'Physics WT-4 72%', 'Good effort in mechanics.']);
    expect(weeklyReportParams({ studentFirstName: 'Asha', weekLabel: 'x', attendance: { present: 0, days: 0 }, tests: [], mentorNote: null })[2]).toBe('no classes recorded');
  });
});

describe('timetable', () => {
  it('finds a teacher or batch double-booking', () => {
    const existing = [{ day: 1, start: '08:30', end: '09:30', facultyId: 'f1', batchId: 'b1' }];
    expect(timetableClash(existing, { day: 1, start: '09:00', end: '10:00', facultyId: 'f1', batchId: 'b2' })).not.toBeNull();
    expect(timetableClash(existing, { day: 1, start: '09:30', end: '10:30', facultyId: 'f1', batchId: 'b2' })).toBeNull();
    expect(timetableClash(existing, { day: 1, start: '09:00', end: '10:00', facultyId: 'f2', batchId: 'b1' })).not.toBeNull();
    expect(timetableClash(existing, { day: 2, start: '08:30', end: '09:30', facultyId: 'f1', batchId: 'b1' })).toBeNull();
  });
});
