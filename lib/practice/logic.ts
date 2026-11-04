import { QUESTION_BY_ID, QUESTIONS, type Difficulty, type PracticeQuestion, type Subject } from './bank';

/** Pure practice rules: marking, XP, levels, streaks, badges, goals, misconceptions, leaderboards. */

export interface Attempt {
  studentId: string;
  questionId: string;
  chosen: number;
  correct: boolean;
  subject: string;
  chapter: string;
  difficulty: Difficulty;
  misconception: string | null;
  xp: number;
  date: string; // IST yyyy-mm-dd
}

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 15 };

/** Instant marking with the worked solution and the misconception behind a wrong pick. */
export function mark(answers: Record<string, number>) {
  return Object.entries(answers).flatMap(([id, chosen]) => {
    const q = QUESTION_BY_ID.get(id);
    if (!q || !Number.isInteger(chosen) || chosen < 0 || chosen > 3) return [];
    const correct = chosen === q.answer;
    return [{ q, chosen, correct, xp: correct ? XP_BY_DIFFICULTY[q.difficulty] : 0, misconception: correct ? null : q.misconceptions[chosen] }];
  });
}

export const levelFor = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpForLevel = (level: number) => 50 * (level - 1) ** 2;

/** Consecutive practice days ending today (or yesterday, so a streak isn't lost before today's practice). */
export function streak(dates: string[], today: string) {
  const set = new Set(dates);
  const prev = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let d = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = prev(d);
  }
  return n;
}

export function summary(attempts: Attempt[], today: string) {
  const xp = attempts.reduce((t, a) => t + a.xp, 0);
  const correct = attempts.filter((a) => a.correct).length;
  const days = streak(attempts.map((a) => a.date), today);
  return { questions: attempts.length, correct, accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : null, xp, level: levelFor(xp), nextLevelXp: xpForLevel(levelFor(xp) + 1), streak: days };
}

export function badges(attempts: Attempt[], today: string) {
  const s = summary(attempts, today);
  const byChapter = new Map<string, { n: number; c: number }>();
  for (const a of attempts) {
    const t = byChapter.get(a.chapter) ?? { n: 0, c: 0 };
    t.n++;
    if (a.correct) t.c++;
    byChapter.set(a.chapter, t);
  }
  const out: { key: string; label: string }[] = [];
  if (s.questions >= 1) out.push({ key: 'first', label: 'First steps' });
  if (s.questions >= 100) out.push({ key: 'century', label: 'Century: 100 questions' });
  if (s.questions >= 20 && (s.accuracy ?? 0) >= 80) out.push({ key: 'sharp', label: 'Sharp shooter: 80%+ over 20' });
  if (s.streak >= 7) out.push({ key: 'streak7', label: '7-day streak' });
  if (s.level >= 5) out.push({ key: 'level5', label: 'Level 5' });
  for (const [ch, t] of byChapter) if (t.n >= 10 && t.c / t.n >= 0.9) out.push({ key: `master:${ch}`, label: `Chapter master: ${ch}` });
  return out;
}

/** Monday of the IST week containing `date`. */
export function weekStart(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

export function goalProgress(goal: { questions: number; accuracy: number } | null, weekAttempts: Attempt[]) {
  if (!goal) return null;
  const done = weekAttempts.length;
  const acc = done ? Math.round((weekAttempts.filter((a) => a.correct).length / done) * 100) : 0;
  return { ...goal, done, accuracyNow: acc, questionsMet: done >= goal.questions, accuracyMet: done > 0 && acc >= goal.accuracy };
}

/** "Students who need help on X": misconceptions picked by 2+ students, most widespread first. */
export function misconceptions(attempts: Attempt[]) {
  const by = new Map<string, { chapter: string; students: Set<string>; times: number }>();
  for (const a of attempts) {
    if (a.correct || !a.misconception) continue;
    const k = `${a.chapter}|${a.misconception}`;
    const t = by.get(k) ?? { chapter: a.chapter, students: new Set<string>(), times: 0 };
    t.students.add(a.studentId);
    t.times++;
    by.set(k, t);
  }
  return [...by.entries()]
    .map(([k, t]) => ({ chapter: t.chapter, misconception: k.split('|')[1], studentIds: [...t.students], times: t.times }))
    .filter((m) => m.studentIds.length >= 2)
    .sort((a, b) => b.studentIds.length - a.studentIds.length || b.times - a.times);
}

/** Accuracy per chapter for a set of attempts. */
export function chapterAccuracy(attempts: Attempt[]) {
  const by = new Map<string, { subject: string; n: number; c: number }>();
  for (const a of attempts) {
    const t = by.get(a.chapter) ?? { subject: a.subject, n: 0, c: 0 };
    t.n++;
    if (a.correct) t.c++;
    by.set(a.chapter, t);
  }
  return [...by.entries()].map(([chapter, t]) => ({ chapter, subject: t.subject, questions: t.n, accuracy: Math.round((t.c / t.n) * 100) })).sort((a, b) => a.accuracy - b.accuracy);
}

/** One-click differentiation: group students by accuracy in a chapter (no attempts → easy). */
export function differentiate(studentIds: string[], attempts: Attempt[], chapter: string): Record<Difficulty, string[]> {
  const out: Record<Difficulty, string[]> = { easy: [], medium: [], hard: [] };
  for (const id of studentIds) {
    const mine = attempts.filter((a) => a.studentId === id && a.chapter === chapter);
    const acc = mine.length ? mine.filter((a) => a.correct).length / mine.length : 0;
    out[!mine.length || acc < 0.5 ? 'easy' : acc < 0.8 ? 'medium' : 'hard'].push(id);
  }
  return out;
}

export function leaderboard(attempts: Attempt[], from: string) {
  const by = new Map<string, number>();
  for (const a of attempts) if (a.date >= from) by.set(a.studentId, (by.get(a.studentId) ?? 0) + a.xp);
  return [...by.entries()].map(([studentId, xp]) => ({ studentId, xp })).sort((a, b) => b.xp - a.xp);
}

/**
 * Pick `count` questions for a session: filtered by subject/chapter/difficulty, skipping questions the
 * student already answered correctly when possible; deterministic per student and day.
 */
export function pickQuestions(f: { subject?: Subject | null; chapter?: string | null; difficulty?: Difficulty | null }, solvedIds: Set<string>, seed: string, count = 5): PracticeQuestion[] {
  const pool = QUESTIONS.filter((q) => (!f.subject || q.subject === f.subject) && (!f.chapter || q.chapter === f.chapter) && (!f.difficulty || q.difficulty === f.difficulty));
  const fresh = pool.filter((q) => !solvedIds.has(q.id));
  const src = fresh.length >= count ? fresh : pool;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [...src].sort((a, b) => ((hash(a.id, h) - hash(b.id, h)) || a.id.localeCompare(b.id))).slice(0, count);
}

function hash(s: string, seed: number) {
  let h = seed;
  for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}
