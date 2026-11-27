import 'server-only';
import type { Staff } from '../crm/types';
import { obMockAttempts, obMocks, obQuestions } from './collections';
import { audit, canTeach, examOrThrow, need, OpenBookError, staffActor, store, type Actor } from './core';
import { patternQuestionIds } from './papers';
import { attempt, generate, getQuestions, type Question } from './questions';
import { isObjective, type Difficulty, type QType } from './taxonomy';

/**
 * AI Mock Test Generator (§8). A mock is an ordered list of question ids with the exam's timing and marking.
 * Sources: "ai" (fresh unique questions from the generator), "pool" (approved bank + past-paper questions with
 * answers + the student's own generated questions) or "pattern" (follows the Pattern Analyzer's chapter
 * weightage). Attempts save every answer as the student goes (resume on any device) and submit automatically
 * when the time is up.
 */
export interface MockInput { title?: string; examId: string; subjects: string[]; chapters: string[]; concepts: string[]; count: number; difficulty: Difficulty | null; minutes: number | null; marks: number | null; negative: number | null; source: 'ai' | 'pool' | 'pattern'; types?: QType[] }

export async function createMock(by: Actor, ownerId: string | null, batchId: string | null, input: MockInput) {
  const exam = examOrThrow(input.examId);
  need(input.subjects.length, 'Choose at least one subject.');
  need(input.count >= 1 && input.count <= 200, 'Choose between 1 and 200 questions.');
  let ids: string[] = [];
  let basis: string | null = null;
  if (input.source === 'pattern') {
    const r = await patternQuestionIds(input.examId, input.subjects.length === 1 ? input.subjects[0] : null, input.count, null);
    ids = r.ids;
    basis = `Follows the chapter weightage of ${r.basis}.`;
  } else if (input.source === 'pool') {
    const rows = await obQuestions.list(store());
    const ok = rows.filter((r) => {
      const q = r.data;
      return q.examId === input.examId && input.subjects.includes(q.subject) && (!input.chapters.length || input.chapters.includes(q.chapter)) && (!input.concepts.length || input.concepts.some((c) => c.split('::').pop() === q.concept)) && (!input.difficulty || q.difficulty === input.difficulty) && q.answer.length > 0 &&
        (q.status === 'approved' || (ownerId && q.ownerId === ownerId && q.status === 'private'));
    });
    ids = ok.sort(() => Math.random() - 0.5).slice(0, input.count).map((r) => r.id);
    basis = `${ids.length} questions drawn from the approved bank, past papers and your own generated questions.`;
  } else {
    need(input.chapters.length && input.concepts.length, 'For an AI mock, choose the chapters and concepts to cover.');
    const types = (input.types?.length ? input.types : exam.pattern.types.filter((t) => isObjective(t))).filter((t) => exam.pattern.types.includes(t));
    const per = Math.ceil(input.count / input.concepts.length);
    // concepts arrive as "Subject::Chapter::Concept" (or just a concept of the first chapter)
    for (const entry of input.concepts) {
      if (ids.length >= input.count) break;
      const parts = entry.split('::');
      const [subject, chapter, concept] = parts.length === 3 ? parts : [input.subjects[0], input.chapters[0], entry];
      const r = await generate(by, ownerId, { examId: input.examId, subject, chapter, concept, types: types.length ? types : ['mcq_single'], difficulty: input.difficulty ?? 'medium', count: Math.min(per, input.count - ids.length) });
      ids.push(...r.questions.map((q) => q.id));
    }
    basis = 'Fresh AI-generated questions, checked by the uniqueness engine.';
  }
  if (!ids.length) throw new OpenBookError('No questions match these choices yet. Try other chapters, the AI source, or ask your teacher to add questions to the bank.');
  const minutes = input.minutes ?? Math.max(5, Math.round((exam.pattern.minutes / exam.pattern.questions) * ids.length));
  const m = await obMocks.put(store(), {
    ownerId, createdBy: by, title: input.title || `${exam.name} mock · ${ids.length} questions`, examId: input.examId, subjects: input.subjects, chapters: input.chapters,
    minutes, marks: input.marks ?? exam.pattern.marks, negative: input.negative ?? exam.pattern.negative, questionIds: ids, source: input.source, batchId, basis,
  });
  await audit(by, 'mock.create', m.id, `${input.source}, ${ids.length} questions`);
  return m.id;
}

export async function shareMockWithBatch(u: Staff, batchId: string, input: MockInput) {
  need(canTeach(u));
  return createMock(staffActor(u), null, batchId, input);
}

export async function getMock(id: string) {
  const m = await obMocks.get(store(), id);
  return m ? { id: m.id, createdAt: m.createdAt, ...m.data } : null;
}

/** Mocks the student may take: their own and those shared with their batch. */
export async function mocksFor(studentId: string, batchId: string | null) {
  const own = await obMocks.list(store(), { k1: studentId });
  const shared = batchId ? await obMocks.list(store(), { k1: `b:${batchId}` }) : [];
  const attempts = await obMockAttempts.list(store(), { k1: studentId });
  return [...own, ...shared].filter((m) => !m.data.closed).map((m) => ({ id: m.id, createdAt: m.createdAt, ...m.data, shared: !!m.data.batchId, attempt: attempts.filter((a) => a.data.mockId === m.id).map((a) => ({ id: a.id, ...a.data }))[0] ?? null })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mayTake(m: NonNullable<Awaited<ReturnType<typeof getMock>>>, studentId: string, batchId: string | null) {
  return m.ownerId === studentId || (!!m.batchId && m.batchId === batchId);
}

/** Starts (or resumes) the attempt. */
export async function startAttempt(studentId: string, batchId: string | null, mockId: string) {
  const m = await getMock(mockId);
  need(m && mayTake(m, studentId, batchId), 'Mock test not found.');
  need(!m!.closed, 'This is a closed-book examination: open it from Exams.');
  const prev = (await obMockAttempts.list(store(), { k1: studentId, k2: mockId }))[0];
  if (prev) return prev.id;
  const now = new Date();
  const a = await obMockAttempts.put(store(), { mockId, studentId, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + m!.minutes * 60_000).toISOString(), status: 'in_progress' });
  return a.id;
}

export async function getAttempt(studentId: string, attemptId: string) {
  const a = await obMockAttempts.get(store(), attemptId);
  need(a && a.data.studentId === studentId, 'Attempt not found.');
  return { id: a!.id, ...a!.data };
}

/** Saves answers / review marks / time as the student works (also used for resume). */
export async function saveAnswers(studentId: string, attemptId: string, patch: { answers?: Record<string, string[]>; review?: string[]; time?: Record<string, number> }, viaClosedExam = false) {
  const a = await obMockAttempts.get(store(), attemptId);
  need(a && a.data.studentId === studentId, 'Attempt not found.');
  if (!viaClosedExam) need(!(await getMock(a!.data.mockId))?.closed, 'This is a closed-book examination: continue it from Exams.');
  if (a!.data.status === 'submitted') return { submitted: true };
  if (Date.now() > Date.parse(a!.data.endsAt) + 15_000) return { submitted: true, ...(await submit(studentId, null, attemptId, true, viaClosedExam)) };
  const time = { ...a!.data.time };
  for (const [k, v] of Object.entries(patch.time ?? {})) time[k] = Math.max(time[k] ?? 0, Math.min(36_000, Math.round(v)));
  await obMockAttempts.put(store(), { ...a!.data, answers: { ...a!.data.answers, ...(patch.answers ?? {}) }, review: patch.review ?? a!.data.review, time }, attemptId);
  return { submitted: false };
}

/** Marks everything: objective questions instantly, subjective ones with AI-assisted rubric marking. */
export async function submit(studentId: string, batchId: string | null, attemptId: string, auto = false, viaClosedExam = false) {
  const a = await obMockAttempts.get(store(), attemptId);
  need(a && a.data.studentId === studentId, 'Attempt not found.');
  if (!viaClosedExam && a!.data.status !== 'submitted') need(!(await getMock(a!.data.mockId))?.closed || Date.now() > Date.parse(a!.data.endsAt), 'This is a closed-book examination: submit it from Exams.');
  if (a!.data.status === 'submitted') return { score: a!.data.score, max: a!.data.max };
  const m = await getMock(a!.data.mockId);
  need(m, 'Mock test not found.');
  const qs = await getQuestions(m!.questionIds);
  const results: { questionId: string; correct: boolean | null; score: number; max: number; feedback: string | null }[] = [];
  for (const q of qs) {
    const given = a!.data.answers[q.id] ?? [];
    const qq: Question = { ...q, marks: m!.marks, negative: m!.negative };
    if (!given.length || !given.some((g) => g.trim())) { results.push({ questionId: q.id, correct: null, score: 0, max: m!.marks, feedback: null }); continue; }
    const r = await attempt(studentId, batchId, qq, given, a!.data.time[q.id] ?? 0, 'mock');
    results.push({ questionId: q.id, correct: r.correct, score: r.score, max: m!.marks, feedback: r.feedback });
  }
  const score = Math.round(results.reduce((s, r) => s + r.score, 0) * 100) / 100;
  const max = results.reduce((s, r) => s + r.max, 0);
  await obMockAttempts.put(store(), { ...a!.data, status: 'submitted', submittedAt: new Date().toISOString(), auto, score, max, results }, attemptId);
  return { score, max };
}

/** Detailed performance report (§8). */
export async function report(studentId: string, attemptId: string) {
  const a = await getAttempt(studentId, attemptId);
  const m = await getMock(a.mockId);
  need(m, 'Mock test not found.');
  const qs = await getQuestions(m!.questionIds);
  const res = new Map(a.results.map((r) => [r.questionId, r]));
  const topics = new Map<string, { chapter: string; concept: string; right: number; wrong: number; skipped: number; score: number; max: number }>();
  for (const q of qs) {
    const r = res.get(q.id);
    const t = topics.get(q.conceptKey) ?? { chapter: q.chapter, concept: q.concept, right: 0, wrong: 0, skipped: 0, score: 0, max: 0 };
    if (!r || r.correct === null) t.skipped++; else if (r.correct) t.right++; else t.wrong++;
    t.score += r?.score ?? 0; t.max += m!.marks;
    topics.set(q.conceptKey, t);
  }
  const topicList = [...topics.values()].map((t) => ({ ...t, pct: t.max ? Math.round((Math.max(0, t.score) / t.max) * 100) : 0 })).sort((x, y) => x.pct - y.pct);
  const answered = a.results.filter((r) => r.correct !== null);
  return {
    mock: m!, attempt: a, questions: qs.map((q) => ({ q, r: res.get(q.id) ?? null, given: a.answers[q.id] ?? [], seconds: a.time[q.id] ?? 0 })),
    summary: { score: a.score ?? 0, max: a.max ?? 0, correct: answered.filter((r) => r.correct).length, wrong: answered.filter((r) => r.correct === false).length, skipped: qs.length - answered.length, accuracy: answered.length ? Math.round((answered.filter((r) => r.correct).length / answered.length) * 100) : 0, seconds: Object.values(a.time).reduce((s, x) => s + x, 0) },
    topics: topicList,
    improve: topicList.filter((t) => t.pct < 60).slice(0, 5).map((t) => `${t.chapter} › ${t.concept}: ${t.pct}% — revise it in the reader and practise 10 questions on it.`),
  };
}
