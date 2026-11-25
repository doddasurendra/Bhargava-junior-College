import 'server-only';
import { addDays, todayIST } from '../dates';
import { obMastery } from './collections';
import { store } from './core';

/**
 * Concept mastery (§16): score = accuracy over the student's last 20 attempts on the concept (0–100).
 * "Mastered" = score ≥ 80 over at least 10 questions. Spaced repetition: a mastered concept comes back after
 * 3, 7, 14, 30 days; a weak one after 1 day (wrong) or 2 days (right but not yet mastered).
 */
export const MASTERED = 80;
export const MIN_FOR_MASTERY = 10;
const INTERVALS = [3, 7, 14, 30, 60];

export function nextSchedule(prevInterval: number, mastered: boolean, lastCorrect: boolean, today: string) {
  if (!mastered) {
    const i = lastCorrect ? 2 : 1;
    return { interval: 0, nextReview: addDays(today, i) };
  }
  const next = INTERVALS.find((d) => d > prevInterval) ?? 60;
  return { interval: next, nextReview: addDays(today, next) };
}

export const isMastered = (m: { attempts: number; score: number }) => m.attempts >= MIN_FOR_MASTERY && m.score >= MASTERED;

/** history: newest last; each true/false (or a fraction 0–1 for partial marks). */
export async function recordMastery(studentId: string, c: { conceptKey: string; subject: string; chapter: string; concept: string }, results: number[], today = todayIST()) {
  if (!results.length) return;
  const row = (await obMastery.list(store(), { k1: studentId, k2: c.conceptKey }))[0];
  const prevAttempts = row?.data.attempts ?? 0;
  const prevScore = row?.data.score ?? 0;
  // keep a rolling window of 20 by weighting the previous score as min(prev, 20 - new) attempts
  const keep = Math.max(0, Math.min(prevAttempts, 20 - results.length));
  const sum = (prevScore / 100) * keep + results.reduce((a, b) => a + b, 0);
  const n = keep + results.length;
  const score = n ? Math.round((sum / n) * 100) : 0;
  const attempts = prevAttempts + results.length;
  const mastered = attempts >= MIN_FOR_MASTERY && score >= MASTERED;
  const s = nextSchedule(row?.data.interval ?? 0, mastered, results[results.length - 1] >= 0.5, today);
  await obMastery.put(store(), { studentId, ...c, attempts, correct: (row?.data.correct ?? 0) + results.reduce((a, b) => a + b, 0), score, nextReview: s.nextReview, interval: s.interval }, row?.id);
}

export async function masteryOf(studentId: string) {
  return (await obMastery.list(store(), { k1: studentId })).map((r) => ({ id: r.id, ...r.data, mastered: isMastered(r.data) }));
}
