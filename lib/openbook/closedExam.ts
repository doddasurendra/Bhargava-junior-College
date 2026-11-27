import 'server-only';
import { randomInt } from 'node:crypto';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { obMockAttempts, obMocks } from './collections';
import { audit, canManage, canTeach, examOrThrow, need, OpenBookError, staffActor, store } from './core';
import { createMock, getMock, report, saveAnswers, submit, type MockInput } from './mocks';
import { getQuestions } from './questions';
import { myBatchIds, studentsById } from '../school/common';

/**
 * Closed-book examinations: a mock created by staff for a batch with exam rules. Each student gets their own
 * question and option order; the attempt is tied to one device if configured; leaving the exam window
 * (tab switch, minimise, exiting full screen) is recorded and, past the configured limit, submits the exam.
 * Browser rules make cheating harder and visible; they do NOT make it impossible (a second device, for one),
 * and the screens say so. Marking reuses the mock engine: instant for objective questions, with negative marks.
 */
export interface ClosedRules { fullscreen: boolean; maxFocusLoss: number; shuffleQuestions: boolean; shuffleOptions: boolean; singleDevice: boolean; showAnswers: boolean; opensAt: string | null; closesAt: string | null }
export const DEFAULT_RULES: ClosedRules = { fullscreen: true, maxFocusLoss: 3, shuffleQuestions: true, shuffleOptions: true, singleDevice: true, showAnswers: true, opensAt: null, closesAt: null };

const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export async function createClosedExam(u: Staff, batchId: string, input: MockInput & { title: string }, rules: ClosedRules) {
  need(canTeach(u), 'Only teachers and the exam cell create examinations.');
  if (!can(u, 'academics.manage') && !canManage(u)) need((await myBatchIds(u)).has(batchId), 'You can only set examinations for batches you teach.');
  if (rules.opensAt && rules.closesAt) need(rules.opensAt < rules.closesAt, 'The exam must close after it opens.');
  const id = await createMock(staffActor(u), null, batchId, input);
  const m = (await obMocks.get(store(), id))!;
  // no repeated question within the same test
  const unique = [...new Set(m.data.questionIds)];
  await obMocks.put(store(), { ...m.data, questionIds: unique, closed: rules }, id);
  await audit(staffActor(u), 'exam.create', id, `${input.title} · ${unique.length} questions · ${rules.fullscreen ? 'full screen' : 'windowed'}`);
  return id;
}

/** Closed-book exams the user may see in the CRM (own batches for teachers; everything for heads / exam cell). */
export async function examsForStaff(u: Staff) {
  need(canTeach(u));
  const all = (await obMocks.list(store())).filter((m) => m.data.closed && m.data.batchId).map((m) => ({ id: m.id, createdAt: m.createdAt, ...m.data }));
  if (can(u, 'academics.manage') || canManage(u)) return all;
  const mine = await myBatchIds(u);
  return all.filter((m) => mine.has(m.batchId!));
}

/** Closed-book exams for a student's batch, with their attempt. */
export async function examsForStudent(studentId: string, batchId: string | null) {
  if (!batchId) return [];
  const ms = (await obMocks.list(store(), { k1: `b:${batchId}` })).filter((m) => m.data.closed);
  const attempts = await obMockAttempts.list(store(), { k1: studentId });
  return ms.map((m) => ({ id: m.id, createdAt: m.createdAt, ...m.data, attempt: attempts.find((a) => a.data.mockId === m.id) ?? null })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function windowProblem(r: ClosedRules, now = new Date()) {
  if (r.opensAt && now < new Date(r.opensAt)) return `This exam opens at ${new Date(r.opensAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`;
  if (r.closesAt && now > new Date(r.closesAt)) return 'This exam has closed.';
  return null;
}

/** Starts or resumes. One attempt per student; with singleDevice, only on the device it started on. */
export async function startClosedAttempt(studentId: string, batchId: string | null, mockId: string, deviceId: string) {
  const m = await getMock(mockId);
  need(m?.closed && m.batchId && m.batchId === batchId, 'Examination not found.');
  need(/^[\w-]{8,80}$/.test(deviceId), 'This browser could not be identified. Reload the page.');
  const prev = (await obMockAttempts.list(store(), { k1: studentId, k2: mockId }))[0];
  if (prev) {
    if (prev.data.status === 'submitted') return prev.id;
    if (m!.closed!.singleDevice && prev.data.deviceId && prev.data.deviceId !== deviceId) {
      await obMockAttempts.put(store(), { ...prev.data, events: [...prev.data.events, { at: new Date().toISOString(), kind: 'other_device' as const, detail: 'tried to open on another device' }].slice(-500) }, prev.id);
      throw new OpenBookError('This exam is already in progress on another device. Continue it there; the attempt on this device was recorded.');
    }
    await obMockAttempts.put(store(), { ...prev.data, events: [...prev.data.events, { at: new Date().toISOString(), kind: 'resume' as const, detail: null }].slice(-500) }, prev.id);
    return prev.id;
  }
  const w = windowProblem(m!.closed!);
  if (w) throw new OpenBookError(w);
  const qs = await getQuestions(m!.questionIds);
  const order = m!.closed!.shuffleQuestions ? shuffle(qs.map((q) => q.id)) : qs.map((q) => q.id);
  const optionOrder: Record<string, number[]> = {};
  if (m!.closed!.shuffleOptions) for (const q of qs) if (q.options.length > 1) optionOrder[q.id] = shuffle(q.options.map((_, i) => i));
  const now = new Date();
  // the clock never runs past the closing time
  const end = Math.min(now.getTime() + m!.minutes * 60_000, m!.closed!.closesAt ? Date.parse(m!.closed!.closesAt) : Infinity);
  const a = await obMockAttempts.put(store(), { mockId, studentId, startedAt: now.toISOString(), endsAt: new Date(end).toISOString(), status: 'in_progress', order, optionOrder, deviceId, focusLosses: 0, events: [{ at: now.toISOString(), kind: 'start', detail: null }] });
  return a.id;
}

async function own(studentId: string, attemptId: string, deviceId: string) {
  const a = await obMockAttempts.get(store(), attemptId);
  need(a && a.data.studentId === studentId, 'Attempt not found.');
  const m = await getMock(a!.data.mockId);
  need(m?.closed, 'Examination not found.');
  if (m!.closed!.singleDevice && a!.data.deviceId && a!.data.deviceId !== deviceId) throw new OpenBookError('This exam is in progress on another device.');
  return { a: a!, m: m! };
}

export async function closedSave(studentId: string, attemptId: string, deviceId: string, patch: Parameters<typeof saveAnswers>[2]) {
  await own(studentId, attemptId, deviceId);
  return saveAnswers(studentId, attemptId, patch, true);
}

/** Logs leaving the exam window; past the limit the exam is submitted. */
export async function recordEvent(studentId: string, batchId: string | null, attemptId: string, deviceId: string, kind: 'blur' | 'hidden' | 'fullscreen_exit') {
  const { a, m } = await own(studentId, attemptId, deviceId);
  if (a.data.status === 'submitted') return { submitted: true, focusLosses: a.data.focusLosses, limit: m.closed!.maxFocusLoss };
  const focusLosses = a.data.focusLosses + 1;
  await obMockAttempts.put(store(), { ...a.data, focusLosses, events: [...a.data.events, { at: new Date().toISOString(), kind, detail: null }].slice(-500) }, a.id);
  const limit = m.closed!.maxFocusLoss;
  if (limit > 0 && focusLosses >= limit) {
    const cur = (await obMockAttempts.get(store(), a.id))!;
    await obMockAttempts.put(store(), { ...cur.data, events: [...cur.data.events, { at: new Date().toISOString(), kind: 'auto_submit' as const, detail: `left the exam window ${focusLosses} times (limit ${limit})` }].slice(-500) }, a.id);
    await submit(studentId, batchId, a.id, true, true);
    return { submitted: true, focusLosses, limit };
  }
  return { submitted: false, focusLosses, limit };
}

export async function closedSubmit(studentId: string, batchId: string | null, attemptId: string, deviceId: string, auto: boolean) {
  const { a } = await own(studentId, attemptId, deviceId);
  await obMockAttempts.put(store(), { ...a.data, events: [...a.data.events, { at: new Date().toISOString(), kind: auto ? 'auto_submit' as const : 'submit' as const, detail: auto ? 'time up' : null }].slice(-500) }, a.id);
  return submit(studentId, batchId, attemptId, auto, true);
}

/** Detailed report + subject-wise breakdown + improvement recommendations. */
export async function closedReport(studentId: string, attemptId: string) {
  const r = await report(studentId, attemptId);
  const subj = new Map<string, { score: number; max: number; right: number; wrong: number; skipped: number }>();
  for (const x of r.questions) {
    const t = subj.get(x.q.subject) ?? { score: 0, max: 0, right: 0, wrong: 0, skipped: 0 };
    t.max += r.mock.marks; t.score += x.r?.score ?? 0;
    if (!x.r || x.r.correct === null) t.skipped++; else if (x.r.correct) t.right++; else t.wrong++;
    subj.set(x.q.subject, t);
  }
  const chapters = new Map<string, { right: number; wrong: number; skipped: number }>();
  for (const x of r.questions) { const t = chapters.get(x.q.chapter) ?? { right: 0, wrong: 0, skipped: 0 }; if (!x.r || x.r.correct === null) t.skipped++; else if (x.r.correct) t.right++; else t.wrong++; chapters.set(x.q.chapter, t); }
  const chapterRows = [...chapters].map(([chapter, t]) => ({ chapter, ...t, accuracy: t.right + t.wrong ? Math.round((t.right / (t.right + t.wrong)) * 100) : null })).sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1));
  const slow = [...r.questions].sort((a, b) => b.seconds - a.seconds).slice(0, 3).filter((x) => x.seconds > 0);
  const recommendations = [
    ...chapterRows.filter((c) => c.accuracy !== null && c.accuracy < 50).slice(0, 3).map((c) => `Revise ${c.chapter}: ${c.right} of ${c.right + c.wrong} right. Re-read it and practise 15 questions before the next exam.`),
    ...(r.summary.wrong > r.summary.correct && r.mock.negative > 0 ? [`Negative marking cost you ${Math.round(r.summary.wrong * r.mock.negative * 10) / 10} marks: answer only when you can eliminate at least two options.`] : []),
    ...(r.summary.skipped > r.questions.length / 3 ? [`${r.summary.skipped} questions were left unanswered: practise timed sets to finish the paper.`] : []),
    ...(slow.length ? [`Most time went on question${slow.length > 1 ? 's' : ''} from ${[...new Set(slow.map((x) => x.q.chapter))].join(', ')}: practise these for speed.`] : []),
  ];
  return { ...r, bySubject: [...subj].map(([subject, t]) => ({ subject, ...t, pct: t.max ? Math.round((Math.max(0, t.score) / t.max) * 100) : 0 })), chapterRows, recommendations };
}

/** Teacher / administrator dashboard for one exam: every student's result, suspicious activity, chapter accuracy. */
export async function examDashboard(u: Staff, mockId: string) {
  const m = (await examsForStaff(u)).find((x) => x.id === mockId);
  need(m, 'Examination not found.');
  const exam = examOrThrow(m!.examId);
  const byId = await studentsById();
  const attempts = (await obMockAttempts.list(store())).filter((a) => a.data.mockId === mockId);
  const qs = await getQuestions(m!.questionIds);
  const qById = new Map(qs.map((q) => [q.id, q]));
  const chapters = new Map<string, { right: number; wrong: number; skipped: number }>();
  for (const a of attempts.filter((x) => x.data.status === 'submitted')) for (const r of a.data.results) {
    const q = qById.get(r.questionId); if (!q) continue;
    const t = chapters.get(q.chapter) ?? { right: 0, wrong: 0, skipped: 0 };
    if (r.correct === null) t.skipped++; else if (r.correct) t.right++; else t.wrong++;
    chapters.set(q.chapter, t);
  }
  const rows = attempts.map((a) => ({
    attemptId: a.id, studentId: a.data.studentId, name: byId.get(a.data.studentId)?.fullName ?? 'Student', collegeId: byId.get(a.data.studentId)?.collegeId ?? '',
    status: a.data.status, auto: a.data.auto, score: a.data.score, max: a.data.max, pct: a.data.max ? Math.round(((a.data.score ?? 0) / a.data.max) * 1000) / 10 : null,
    focusLosses: a.data.focusLosses, otherDevice: a.data.events.filter((e) => e.kind === 'other_device').length,
    minutes: a.data.submittedAt ? Math.round((Date.parse(a.data.submittedAt) - Date.parse(a.data.startedAt)) / 60000) : null,
    events: a.data.events,
  })).sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1));
  const done = rows.filter((r) => r.status === 'submitted');
  return {
    exam: m!, pattern: exam.name, questions: qs.length,
    batchSize: (await (await import('../school/common')).allBatches()).find((b) => b.id === m!.batchId)?.data.studentIds.length ?? 0,
    rows, average: done.length ? Math.round((done.reduce((s, r) => s + (r.pct ?? 0), 0) / done.length) * 10) / 10 : null,
    suspicious: rows.filter((r) => r.focusLosses > 0 || r.otherDevice > 0 || (r.auto && r.events.some((e) => e.kind === 'auto_submit' && e.detail?.startsWith('left')))),
    chapters: [...chapters].map(([chapter, t]) => ({ chapter, ...t, accuracy: t.right + t.wrong ? Math.round((t.right / (t.right + t.wrong)) * 100) : null })).sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1)),
  };
}

/** Everything for the analytics "Mock exams" tab. */
export async function examsOverview(u: Staff) {
  const list = await examsForStaff(u);
  const out = [];
  for (const m of list) {
    const d = await examDashboard(u, m.id);
    out.push({ id: m.id, title: m.title, createdAt: m.createdAt, average: d.average, taken: d.rows.filter((r) => r.status === 'submitted').length, of: d.batchSize, flagged: d.suspicious.length });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
