import 'server-only';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { batchOf } from '../school/common';
import { obPaths, obQuestions } from './collections';
import { audit, canTeach, chaptersFor, examOrThrow, need, staffActor, store } from './core';
import { dueCount } from './flashcards';
import { searchInBook, listBooks } from './library';
import { isMastered, masteryOf } from './mastery';
import { attempt, getQuestions } from './questions';
import { conceptKey, EXAMS } from './taxonomy';

/**
 * Personalised Learning Path (§16). A diagnostic (12 questions per subject from the approved bank) plus the
 * student's existing data (mastery from every Open Book attempt, which includes mocks and challenges) orders
 * every concept of the exam: weakest first, then syllabus order. Each concept gets a target date counted back
 * from the exam date. A concept is done when mastered (≥ 80% over ≥ 10 questions); spaced repetition brings
 * weak or due concepts back into the daily plan. Every item says why it was suggested.
 */
export const DIAGNOSTIC_PER_SUBJECT = 12;

export async function defaultExamFor(studentId: string) {
  const b = await batchOf(studentId);
  const prog = `${b?.data.program ?? ''}`;
  return /neet/i.test(prog) ? 'neet-ug' : 'jee-main';
}

export async function pathOf(studentId: string) {
  const r = (await obPaths.list(store(), { k1: studentId }))[0];
  return r ? { id: r.id, ...r.data } : null;
}

/** 12 approved questions spread over the subject's chapters, deterministic per student. */
export async function diagnosticQuestions(studentId: string, examId: string, subject: string) {
  const chs = await chaptersFor(examId, subject);
  const pool = (await obQuestions.list(store(), { k1: 'bank' })).filter((r) => r.data.status === 'approved' && r.data.subject === subject && r.data.answer.length && (r.data.type === 'mcq_single' || r.data.type === 'numerical') && chs.some((c) => c.name === r.data.chapter));
  const byChapter = new Map<string, string[]>();
  for (const r of pool) byChapter.set(r.data.chapter, [...(byChapter.get(r.data.chapter) ?? []), r.id]);
  const seed = [...studentId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const out: string[] = [];
  for (let round = 0; out.length < DIAGNOSTIC_PER_SUBJECT && round < 20; round++) {
    for (const ids of byChapter.values()) {
      if (out.length >= DIAGNOSTIC_PER_SUBJECT) break;
      const id = ids[(seed + round) % ids.length];
      if (ids.length > round && !out.includes(id)) out.push(id);
    }
  }
  return getQuestions(out);
}

export async function submitDiagnostic(studentId: string, examId: string, subject: string, answers: Record<string, string>) {
  const b = await batchOf(studentId);
  const qs = await diagnosticQuestions(studentId, examId, subject);
  let correct = 0;
  for (const q of qs) {
    const r = await attempt(studentId, b?.id ?? null, q, answers[q.id] ? [answers[q.id]] : [], 0, 'diagnostic');
    if (r.correct) correct++;
  }
  const p = await pathOf(studentId);
  if (p) await obPaths.put(store(), { ...p, diagnostic: { ...p.diagnostic, [subject]: { correct, total: qs.length, done: true } } }, p.id);
  return { correct, total: qs.length };
}

/** Creates or rebuilds the path; keeps teacher adjustments. */
export async function buildPath(studentId: string, input: { examId: string; examDate: string; minutesPerDay: number }) {
  const exam = examOrThrow(input.examId);
  need(input.examDate > todayIST(), 'Choose an exam date in the future.');
  const [mastery, prev] = await Promise.all([masteryOf(studentId), pathOf(studentId)]);
  const mByKey = new Map(mastery.map((m) => [m.conceptKey, m]));
  const items: { conceptKey: string; subject: string; chapter: string; concept: string; status: 'locked' | 'in_progress' | 'done'; target: string; reason: string; adjustedBy: string | null; weight: number }[] = [];
  let order = 0;
  for (const subject of exam.subjects) {
    for (const ch of await chaptersFor(input.examId, subject)) {
      for (const concept of ch.concepts) {
        const ck = conceptKey(subject, ch.name, concept);
        const m = mByKey.get(ck);
        const chapterScores = mastery.filter((x) => x.subject === subject && x.chapter === ch.name);
        const chapterAvg = chapterScores.length ? chapterScores.reduce((a, x) => a + x.score, 0) / chapterScores.length : null;
        const kept = prev?.items.find((i) => i.conceptKey === ck && i.adjustedBy);
        const done = !!m && isMastered(m);
        let weight = order++;
        let reason = 'Next in the syllabus order.';
        if (m && !done && m.attempts >= 3) { weight -= 10_000 + (100 - m.score) * 10; reason = `Suggested because you scored ${Math.round(m.score)}% on ${concept} questions.`; }
        else if (chapterAvg !== null && chapterAvg < 60) { weight -= 5_000; reason = `Suggested because your ${ch.name} questions average ${Math.round(chapterAvg)}%.`; }
        if (done) reason = `Mastered: ${Math.round(m!.score)}% over ${m!.attempts} questions.`;
        items.push({ conceptKey: ck, subject, chapter: ch.name, concept, status: done ? 'done' : 'locked', target: kept?.target ?? '', reason: kept ? kept.reason : reason, adjustedBy: kept?.adjustedBy ?? null, weight: kept ? -20_000 + order : weight });
      }
    }
  }
  items.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.weight - b.weight);
  // targets: spread open concepts evenly up to two weeks before the exam (revision buffer)
  const open = items.filter((i) => i.status !== 'done');
  const start = todayIST();
  const last = addDays(input.examDate, -14) > start ? addDays(input.examDate, -14) : input.examDate;
  const days = Math.max(1, Math.round((Date.parse(last) - Date.parse(start)) / 86_400_000));
  open.forEach((it, n) => { if (!it.target) it.target = addDays(start, Math.min(days, Math.ceil(((n + 1) * days) / open.length))); });
  items.forEach((it) => { if (!it.target) it.target = start; });
  open.slice(0, 2).forEach((it) => (it.status = 'in_progress'));
  const data = { studentId, examId: input.examId, examDate: input.examDate, minutesPerDay: input.minutesPerDay, diagnostic: prev?.diagnostic ?? {}, items: items.slice(0, 600).map(({ weight: _w, ...rest }) => rest) };
  const r = await obPaths.put(store(), data, prev?.id);
  return { id: r.id, ...data };
}

/** After practice: mark mastered concepts done and unlock the next ones. */
export async function refreshPath(studentId: string) {
  const p = await pathOf(studentId);
  if (!p) return null;
  const m = new Map((await masteryOf(studentId)).map((x) => [x.conceptKey, x]));
  let open = 0;
  const items = p.items.map((i) => {
    const x = m.get(i.conceptKey);
    if (x && isMastered(x)) return { ...i, status: 'done' as const, reason: `Mastered: ${Math.round(x.score)}% over ${x.attempts} questions.` };
    if (i.status === 'done') return { ...i, status: 'in_progress' as const, reason: x ? `Back for revision: now ${Math.round(x.score)}%.` : i.reason };
    return i;
  });
  for (const i of items) if (i.status === 'in_progress') open++;
  for (const i of items) { if (open >= 2) break; if (i.status === 'locked') { i.status = 'in_progress'; open++; } }
  await obPaths.put(store(), { ...p, items }, p.id);
  return { ...p, items };
}

/** "Today: 45 min — Rotational Motion (read pp. 112–118, 10 questions, 15 flashcards)". */
export async function todayPlan(studentId: string) {
  const p = await refreshPath(studentId);
  if (!p) return null;
  const today = todayIST();
  const mastery = await masteryOf(studentId);
  const reviews = mastery.filter((m) => m.nextReview && m.nextReview <= today && !p.items.some((i) => i.status === 'in_progress' && i.conceptKey === m.conceptKey)).slice(0, 2);
  const cards = await dueCount(studentId);
  const current = p.items.filter((i) => i.status === 'in_progress').slice(0, 2);
  const books = (await listBooks({ examId: p.examId, size: 60 })).items.filter((b) => b.textStatus === 'extracted');
  const tasks: { conceptKey: string; subject: string; chapter: string; concept: string; minutes: number; read: { bookId: string; title: string; pages: number[] } | null; questions: number; cards: number; kind: 'learn' | 'review'; reason: string }[] = [];
  let budget = p.minutesPerDay;
  for (const it of [...current.map((c) => ({ ...c, kind: 'learn' as const })), ...reviews.map((r) => ({ conceptKey: r.conceptKey, subject: r.subject, chapter: r.chapter, concept: r.concept, reason: `Spaced review: due today (score ${Math.round(r.score)}%).`, kind: 'review' as const }))]) {
    if (budget < 10) break;
    let read: { bookId: string; title: string; pages: number[] } | null = null;
    for (const b of books.filter((x) => x.subjects.includes(it.subject))) {
      const hits = await searchInBook(b.id, `${it.concept} ${it.chapter}`, 6);
      if (hits.length) { read = { bookId: b.id, title: b.title, pages: [...new Set(hits.map((h) => h.page))].sort((x, y) => x - y).slice(0, 7) }; break; }
    }
    const questions = it.kind === 'review' ? 5 : 10;
    const cardsHere = Math.min(15, cards);
    const minutes = Math.min(budget, (read ? read.pages.length * 3 : 0) + questions * 2 + Math.ceil(cardsHere / 2));
    tasks.push({ conceptKey: it.conceptKey, subject: it.subject, chapter: it.chapter, concept: it.concept, minutes, read, questions, cards: cardsHere, kind: it.kind, reason: it.reason });
    budget -= minutes;
  }
  const done = p.items.filter((i) => i.status === 'done').length;
  return { path: p, tasks, minutes: p.minutesPerDay - budget, dueCards: cards, progress: Math.round((done / Math.max(1, p.items.length)) * 100), bySubject: [...new Set(p.items.map((i) => i.subject))].map((s) => { const its = p.items.filter((i) => i.subject === s); return { subject: s, total: its.length, done: its.filter((i) => i.status === 'done').length, inProgress: its.filter((i) => i.status === 'in_progress').length }; }) };
}

/** Teacher (or mentor with teaching rights) adjusts a student's path: target date, status, note. */
export async function adjustPath(u: Staff, studentId: string, ck: string, patch: { target?: string; status?: 'locked' | 'in_progress' | 'done'; reason?: string }) {
  need(canTeach(u));
  const p = await pathOf(studentId);
  need(p, 'This student has no learning path yet.');
  const items = p!.items.map((i) => (i.conceptKey === ck ? { ...i, ...patch, reason: patch.reason ? `Teacher: ${patch.reason}` : i.reason, adjustedBy: u.fullName } : i));
  await obPaths.put(store(), { ...p!, items }, p!.id);
  await audit(staffActor(u), 'path.adjust', `${studentId}:${ck}`, JSON.stringify(patch));
}

/** Parent / mentor summary: progress % only (no answers, no scores per question). */
export async function pathSummary(studentId: string) {
  const p = await pathOf(studentId);
  if (!p) return null;
  const done = p.items.filter((i) => i.status === 'done').length;
  return { exam: EXAMS.find((e) => e.id === p.examId)?.name ?? p.examId, examDate: p.examDate, progress: Math.round((done / Math.max(1, p.items.length)) * 100), done, total: p.items.length };
}

/**
 * Weak points the voice tutor noticed (§21) go into the Learning Path: the concept is moved to "in progress"
 * with the reason shown, so it comes back in today's plan. Returns the concepts it could place.
 */
export async function flagFromTutor(studentId: string, weak: { subject: string; chapter: string; concept: string }[], today = todayIST()) {
  const p = await pathOf(studentId);
  if (!p || !weak.length) return [];
  const keys = new Map(weak.map((w) => [conceptKey(w.subject, w.chapter, w.concept), w]));
  const placed: string[] = [];
  const items = p.items.map((i) => {
    if (!keys.has(i.conceptKey)) return i;
    placed.push(i.concept);
    return { ...i, status: 'in_progress' as const, target: today < i.target ? today : i.target, reason: `Voice tutor (${today}): you found ${i.concept} difficult, so it is back in today's plan.` };
  });
  if (placed.length) await obPaths.put(store(), { ...p, items }, p.id);
  return placed;
}
