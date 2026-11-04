/**
 * School rules as pure functions (unit tested): JEE/NEET-pattern scoring with negative marking, batch rank
 * and percentile, attendance, the early-warning signals of §12.5, fee dues, the concession approval level of
 * §9A.3, and the Sunday parent report of §6.9.
 */
import type { Question } from '../records/collections';

export interface TestLike {
  questions: Question[];
  maxMarks: number;
}

export interface Scored {
  score: number;
  max: number;
  bySubject: Record<string, number>;
  byChapter: Record<string, { right: number; wrong: number; skipped: number }>;
}

/** answers: question id → chosen option (0–3), or -1 / missing for skipped. */
export function scoreAttempt(test: TestLike, answers: Record<string, number>): Scored {
  let score = 0;
  const bySubject: Record<string, number> = {};
  const byChapter: Record<string, { right: number; wrong: number; skipped: number }> = {};
  for (const q of test.questions) {
    const a = answers[q.id];
    const ch = (byChapter[`${q.subject} · ${q.chapter}`] ??= { right: 0, wrong: 0, skipped: 0 });
    bySubject[q.subject] ??= 0;
    if (a === undefined || a === null || a < 0) {
      ch.skipped++;
      continue;
    }
    if (a === q.answer) {
      score += q.marks;
      bySubject[q.subject] += q.marks;
      ch.right++;
    } else {
      score -= q.negative;
      bySubject[q.subject] -= q.negative;
      ch.wrong++;
    }
  }
  const max = test.questions.length ? test.questions.reduce((s, q) => s + q.marks, 0) : test.maxMarks;
  return { score: round(score), max, bySubject: Object.fromEntries(Object.entries(bySubject).map(([k, v]) => [k, round(v)])), byChapter };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Standard competition ranking (1, 2, 2, 4) and percentile = % of the batch scoring at or below you. */
export function rankResults(rows: { studentId: string; score: number }[]) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const out = new Map<string, { rank: number; percentile: number }>();
  const n = rows.length;
  sorted.forEach((r, i) => {
    const rank = i > 0 && sorted[i - 1].score === r.score ? out.get(sorted[i - 1].studentId)!.rank : i + 1;
    const atOrBelow = rows.filter((x) => x.score <= r.score).length;
    out.set(r.studentId, { rank, percentile: n ? round((atOrBelow / n) * 100) : 0 });
  });
  return out;
}

/** Weak chapters: at least `min` attempts and under 50% right. */
export function weakChapters(byChapter: Scored['byChapter'], min = 2) {
  return Object.entries(byChapter)
    .map(([chapter, c]) => ({ chapter, attempted: c.right + c.wrong, accuracy: c.right + c.wrong ? c.right / (c.right + c.wrong) : 0, skipped: c.skipped }))
    .filter((c) => c.attempted + c.skipped >= min && (c.accuracy < 0.5 || c.skipped > c.attempted))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export type AttendanceMark = 'present' | 'absent' | 'late' | 'leave';

export function attendanceSummary(registers: { date: string; marks: Record<string, AttendanceMark> }[], studentId: string) {
  const s = { present: 0, absent: 0, late: 0, leave: 0, days: 0, pct: null as number | null, absentDates: [] as string[] };
  for (const r of registers) {
    const m = r.marks[studentId];
    if (!m) continue;
    s.days++;
    s[m]++;
    if (m === 'absent') s.absentDates.push(r.date);
  }
  // late counts as attended; approved leave is excluded from the denominator
  const counted = s.days - s.leave;
  s.pct = counted > 0 ? Math.round(((s.present + s.late) / counted) * 100) : null;
  return s;
}

export interface WarningInput {
  attendancePct: number | null;
  /** recent test percentages, oldest first */
  scorePcts: number[];
  latestStress: number | null;
  consecutiveAbsences: number;
}

/**
 * §12.5 dropout and stress early-warning (rules now, ML later). Returns reasons; empty = fine. Alerts go to
 * the mentor privately (§6.5: a private parent call, never public rank shaming).
 */
export function earlyWarnings(w: WarningInput): string[] {
  const out: string[] = [];
  if (w.attendancePct !== null && w.attendancePct < 75) out.push(`Attendance ${w.attendancePct}% (below 75%)`);
  if (w.consecutiveAbsences >= 3) out.push(`${w.consecutiveAbsences} days absent in a row`);
  const s = w.scorePcts;
  if (s.length >= 3 && s[s.length - 1] < s[s.length - 2] && s[s.length - 2] < s[s.length - 3] && s[s.length - 3] - s[s.length - 1] >= 10) out.push(`Test scores falling three tests running (${s.slice(-3).map((x) => `${Math.round(x)}%`).join(' → ')})`);
  if (s.length && s[s.length - 1] < 35) out.push(`Latest test ${Math.round(s[s.length - 1])}%`);
  if (w.latestStress !== null && w.latestStress <= 2) out.push(`Wellbeing check-in: stress ${w.latestStress}/5`);
  return out;
}

export function consecutiveAbsences(registers: { date: string; marks: Record<string, AttendanceMark> }[], studentId: string) {
  let n = 0;
  for (const r of [...registers].sort((a, b) => b.date.localeCompare(a.date))) {
    const m = r.marks[studentId];
    if (!m) continue;
    if (m === 'absent') n++;
    else break;
  }
  return n;
}

/** Instalments with what has been paid against them (oldest first), as of `today`. */
export function duesFor(items: { due: string; amount: number; label: string }[], paidTotal: number, today: string) {
  let left = paidTotal;
  const rows = [...items]
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((i) => {
      const paid = Math.min(i.amount, Math.max(0, left));
      left -= paid;
      const outstanding = i.amount - paid;
      return { ...i, paid, outstanding, overdue: outstanding > 0 && i.due < today };
    });
  return { rows, outstanding: rows.reduce((s, r) => s + r.outstanding, 0), overdue: rows.filter((r) => r.overdue).reduce((s, r) => s + r.outstanding, 0), credit: Math.max(0, left) };
}

/**
 * §9A.3: the Admission Manager may approve concessions up to the top BSAT scholarship slab; above that needs
 * Management. Refunds always need Management.
 */
export function approvalLevel(kind: 'concession' | 'refund', percentOfTuition: number | null, slabMaxPct: number): 'slab' | 'above' {
  if (kind === 'refund') return 'above';
  return percentOfTuition !== null && percentOfTuition <= slabMaxPct ? 'slab' : 'above';
}

export interface WeekSummary {
  studentFirstName: string;
  weekLabel: string;
  attendance: { present: number; days: number };
  tests: { title: string; pct: number }[];
  mentorNote: string | null;
}

/** §6.9: the Sunday WhatsApp parent report as template parameters (attendance, test trend, mentor's note). */
export function weeklyReportParams(w: WeekSummary): string[] {
  const att = w.attendance.days ? `${w.attendance.present}/${w.attendance.days} days` : 'no classes recorded';
  const tests = w.tests.length ? w.tests.map((t) => `${t.title} ${Math.round(t.pct)}%`).join(', ') : 'no tests this week';
  const note = (w.mentorNote ?? 'No note this week.').replace(/\s+/g, ' ').slice(0, 300);
  return [w.studentFirstName, w.weekLabel, att, tests, note];
}

/** A teacher may not be in two batches at once; returns the clashing period if any. */
export function timetableClash<T extends { day: number; start: string; end: string; facultyId: string; batchId: string }>(existing: T[], p: Omit<T, 'id'>) {
  return existing.find((e) => e.day === p.day && (e.facultyId === p.facultyId || e.batchId === p.batchId) && e.start < p.end && p.start < e.end) ?? null;
}
