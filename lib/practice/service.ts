import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { getRecordStore } from '../records';
import { lessonPlans, parentReports, practiceAttempts, practiceGoals, practiceSets } from '../records/collections';
import { homeworkBatches } from '../school/backoffice';
import { allBatches, batchOf, canTeachBatch, SchoolError, studentsById } from '../school/common';
import { QUESTION_BY_ID, type Difficulty, type Subject } from './bank';
import { badges, chapterAccuracy, differentiate, goalProgress, leaderboard, mark, misconceptions, pickQuestions, summary, weekStart, type Attempt } from './logic';

const store = () => getRecordStore();
const need = (ok: boolean, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new SchoolError(msg);
};

const toAttempt = (d: { studentId: string; questionId: string; chosen: number; correct: boolean; subject: string; chapter: string; difficulty: Difficulty; misconception: string | null; xp: number; date: string }): Attempt => d;

export async function attemptsOf(studentId: string) {
  return (await practiceAttempts.list(store(), { k1: studentId })).map((r) => toAttempt(r.data));
}

async function attemptsOfBatch(batchId: string) {
  return (await practiceAttempts.list(store(), { k2: batchId })).map((r) => toAttempt(r.data));
}

// ---------------------------------------------------------------- student

/** Everything on the student's practice home. */
export async function studentPractice(studentId: string, today = todayIST()) {
  const [attempts, batch, goals] = await Promise.all([attemptsOf(studentId), batchOf(studentId), practiceGoals.list(store(), { k1: studentId })]);
  const ws = weekStart(today);
  const week = attempts.filter((a) => a.date >= ws);
  const goal = goals.find((g) => g.data.weekStart === ws)?.data ?? null;
  const sets = batch ? (await practiceSets.list(store(), { k1: batch.id })).filter((s) => s.data.weekStart === ws && (s.data.studentIds.length === 0 || s.data.studentIds.includes(studentId))) : [];
  let board: { name: string; xp: number; me: boolean }[] = [];
  if (batch) {
    const byId = await studentsById();
    board = leaderboard(await attemptsOfBatch(batch.id), ws).slice(0, 10).map((r) => ({ name: byId.get(r.studentId)?.fullName ?? 'Student', xp: r.xp, me: r.studentId === studentId }));
  }
  return {
    batch: batch?.data.name ?? null,
    summary: summary(attempts, today),
    badges: badges(attempts, today),
    goal: goalProgress(goal, week),
    weekStart: ws,
    program: sets.map((s) => ({ id: s.id, ...s.data, done: week.filter((a) => a.chapter === s.data.chapter).length })),
    weak: chapterAccuracy(attempts).filter((c) => c.questions >= 3 && c.accuracy < 60).slice(0, 5),
    leaderboard: board,
  };
}

export function startSession(studentId: string, solved: Set<string>, f: { subject?: Subject | null; chapter?: string | null; difficulty?: Difficulty | null; count?: number }, today = todayIST()) {
  return pickQuestions(f, solved, `${studentId}:${today}:${f.subject ?? ''}:${f.chapter ?? ''}:${f.difficulty ?? ''}:${solved.size}`, f.count ?? 5);
}

/** Marks a submitted session, stores every attempt, returns results with solutions. */
export async function submitSession(studentId: string, answers: Record<string, number>, setId: string | null, today = todayIST()) {
  const marked = mark(answers);
  if (!marked.length) throw new SchoolError('Answer at least one question.');
  const batch = await batchOf(studentId);
  for (const m of marked) {
    await practiceAttempts.put(store(), { studentId, batchId: batch?.id ?? null, questionId: m.q.id, chosen: m.chosen, correct: m.correct, subject: m.q.subject, chapter: m.q.chapter, difficulty: m.q.difficulty, misconception: m.misconception, xp: m.xp, date: today, setId });
  }
  return marked.map((m) => ({ id: m.q.id, stem: m.q.stem, options: m.q.options, chosen: m.chosen, answer: m.q.answer, correct: m.correct, xp: m.xp, solution: m.q.solution, misconception: m.misconception }));
}

export async function setGoal(studentId: string, input: { questions: number; accuracy: number }, today = todayIST()) {
  const ws = weekStart(today);
  const prev = (await practiceGoals.list(store(), { k1: studentId })).find((g) => g.data.weekStart === ws);
  await practiceGoals.put(store(), { studentId, weekStart: ws, questions: input.questions, accuracy: input.accuracy, chapters: [] }, prev?.id);
  return 'Goal saved for this week.';
}

export async function reportsForStudent(studentId: string) {
  return (await parentReports.list(store(), { k1: studentId })).map((r) => r.data).sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------- teacher

/** Teacher / head view for one batch: per-student analytics, misconceptions, chapters, program, lessons. */
export async function teacherPractice(user: Staff, batchId: string | null, today = todayIST()) {
  need(can(user, 'homework.assign') || can(user, 'academics.view'));
  const batches = can(user, 'academics.view') ? (await allBatches()).filter((b) => b.data.active) : await homeworkBatches(user);
  const batch = batches.find((b) => b.id === batchId) ?? batches[0] ?? null;
  if (!batch) return { batches, batch: null };
  const [attempts, byId, sets, lessons] = await Promise.all([attemptsOfBatch(batch.id), studentsById(), practiceSets.list(store(), { k1: batch.id }), lessonPlans.list(store(), { k1: batch.id })]);
  const ws = weekStart(today);
  const students = batch.data.studentIds.map((sid) => {
    const mine = attempts.filter((a) => a.studentId === sid);
    const s = summary(mine, today);
    const weak = chapterAccuracy(mine).filter((c) => c.questions >= 3 && c.accuracy < 60).map((c) => c.chapter);
    return { id: sid, name: byId.get(sid)?.fullName ?? 'Student', collegeId: byId.get(sid)?.collegeId ?? null, ...s, week: mine.filter((a) => a.date >= ws).length, weak };
  });
  const lessonRows = lessons.map((l) => ({ id: l.id, ...l.data })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    batches,
    batch,
    students,
    misconceptions: misconceptions(attempts).map((m) => ({ ...m, names: m.studentIds.map((id) => byId.get(id)?.fullName ?? 'Student').sort((a, b) => a.localeCompare(b)) })),
    chapters: chapterAccuracy(attempts),
    program: sets.filter((s) => s.data.weekStart === ws).map((s) => ({ id: s.id, ...s.data, names: s.data.studentIds.map((id) => byId.get(id)?.fullName ?? '') })),
    lessons: lessonRows,
    lessonProgress: lessonRows.length ? Math.round((lessonRows.filter((l) => l.status === 'done').length / lessonRows.length) * 100) : null,
    weekStart: ws,
  };
}

async function requireTeacherOf(user: Staff, batchId: string) {
  need(can(user, 'homework.assign'));
  if (!(await canTeachBatch(user, batchId))) throw new SchoolError('You don’t teach this batch.');
}

export async function assignSet(user: Staff, input: { batchId: string; subject: string; chapter: string; difficulty: Difficulty; count: number }, today = todayIST()) {
  await requireTeacherOf(user, input.batchId);
  await practiceSets.put(store(), { ...input, weekStart: weekStart(today), studentIds: [], createdBy: user.id });
  return `Added ${input.chapter} (${input.difficulty}) to this week’s program.`;
}

/** One click: split the batch into easy / medium / hard groups by accuracy in the chapter and assign each. */
export async function differentiateSet(user: Staff, input: { batchId: string; subject: string; chapter: string; count: number }, today = todayIST()) {
  await requireTeacherOf(user, input.batchId);
  const batch = (await allBatches()).find((b) => b.id === input.batchId);
  if (!batch) throw new SchoolError('Batch not found.');
  const groups = differentiate(batch.data.studentIds, await attemptsOfBatch(batch.id), input.chapter);
  let made = 0;
  for (const d of ['easy', 'medium', 'hard'] as const) {
    if (!groups[d].length) continue;
    await practiceSets.put(store(), { batchId: batch.id, weekStart: weekStart(today), subject: input.subject, chapter: input.chapter, difficulty: d, studentIds: groups[d], count: input.count, createdBy: user.id });
    made++;
  }
  return `Assigned ${input.chapter} at ${made} level${made === 1 ? '' : 's'}: ${groups.easy.length} easy, ${groups.medium.length} medium, ${groups.hard.length} hard.`;
}

export async function addLesson(user: Staff, input: { batchId: string; subject: string; topic: string; date: string; notes: string | null }) {
  await requireTeacherOf(user, input.batchId);
  await lessonPlans.put(store(), { ...input, status: 'planned', createdBy: user.id });
  return 'Lesson planned.';
}

export async function toggleLesson(user: Staff, id: string) {
  const l = await lessonPlans.get(store(), id);
  if (!l) throw new SchoolError('Lesson not found.');
  await requireTeacherOf(user, l.data.batchId);
  await lessonPlans.put(store(), { ...l.data, status: l.data.status === 'done' ? 'planned' : 'done' }, l.id);
  return l.data.status === 'done' ? 'Marked as planned.' : 'Marked as done.';
}

/** One-click parent report: writes a plain-language summary the parent sees in the portal. */
export async function shareWithParent(user: Staff, studentId: string, today = todayIST()) {
  need(can(user, 'homework.assign'));
  const batch = await batchOf(studentId);
  if (!batch || !(await canTeachBatch(user, batch.id))) throw new SchoolError('You don’t teach this student.');
  const s = (await studentsById()).get(studentId);
  const attempts = await attemptsOf(studentId);
  const sum = summary(attempts, today);
  const week = attempts.filter((a) => a.date >= addDays(today, -6));
  const weak = chapterAccuracy(attempts).filter((c) => c.questions >= 3 && c.accuracy < 60).map((c) => c.chapter).slice(0, 3);
  const strong = chapterAccuracy(attempts).filter((c) => c.questions >= 3 && c.accuracy >= 80).map((c) => c.chapter).slice(-3);
  const text = [
    `${s?.fullName ?? 'Your child'}: ${week.length} practice questions in the last 7 days, ${sum.questions} in total at ${sum.accuracy ?? 0}% accuracy.`,
    `Level ${sum.level}, ${sum.xp} XP, ${sum.streak}-day streak.`,
    strong.length ? `Doing well in: ${strong.join(', ')}.` : '',
    weak.length ? `Needs more practice in: ${weak.join(', ')}.` : 'No weak chapters right now.',
  ].filter(Boolean).join(' ');
  await parentReports.put(store(), { studentId, text, sharedBy: user.id, at: new Date().toISOString() });
  return 'Shared with the parent. It appears in their portal under Practice.';
}

/** School-wide practice statistics (principal / management). */
export async function schoolStats(user: Staff, today = todayIST()) {
  need(can(user, 'academics.view') || can(user, 'dashboard.view'));
  const [all, batches] = await Promise.all([practiceAttempts.list(store()), allBatches()]);
  const attempts = all.map((r) => ({ ...toAttempt(r.data), batchId: r.data.batchId }));
  const ws = weekStart(today);
  const s = summary(attempts, today);
  return {
    questions: s.questions,
    accuracy: s.accuracy,
    activeThisWeek: new Set(attempts.filter((a) => a.date >= ws).map((a) => a.studentId)).size,
    bySubject: (['Mathematics', 'Physics', 'Chemistry', 'Biology'] as const).map((sub) => {
      const x = attempts.filter((a) => a.subject === sub);
      return { subject: sub, questions: x.length, accuracy: x.length ? Math.round((x.filter((a) => a.correct).length / x.length) * 100) : null };
    }),
    byBatch: batches.map((b) => {
      const x = attempts.filter((a) => a.batchId === b.id);
      return { batch: b.data.name, questions: x.length, accuracy: x.length ? Math.round((x.filter((a) => a.correct).length / x.length) * 100) : null, students: new Set(x.map((a) => a.studentId)).size };
    }),
    weakest: chapterAccuracy(attempts).filter((c) => c.questions >= 5).slice(0, 5),
  };
}

export const questionExists = (id: string) => QUESTION_BY_ID.has(id);
