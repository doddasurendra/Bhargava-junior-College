import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { college } from '@/content/college';
import { getAppStore } from '../app/service';
import { getContent } from '../cms';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { formatDate, todayIST } from '../dates';
import { attendance, batches, doubts, materials, notices, testResults, tests, timetable, ATTENDANCE, DOUBT_CHANNELS } from '../records/collections';
import { siteUrl } from '../seo';
import { sendTemplate } from '../whatsapp/service';
import { allBatches, allStudents, batchOf, canTeachBatch, firstName, myBatchIds, requireTeaches, SchoolError, store, studentsById } from './common';
import { rankResults, scoreAttempt, timetableClash } from './logic';
import type { Difficulty, Subject } from '../practice/bank';
import { pickQuestions } from '../practice/logic';

const need = (user: Staff, ok: boolean, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new SchoolError(msg);
};

// ---------------------------------------------------------------- batches (academic coordinator / admin office)

export async function saveBatch(user: Staff, input: { id?: string; name: string; program: string; year: number; section: string; capacity: number; classTeacherId: string | null; active: boolean }) {
  need(user, can(user, 'academics.manage'));
  const { season } = await getContent();
  if (input.capacity > season.batchCap) throw new SchoolError(`Batches are capped at ${season.batchCap} students.`);
  const prev = input.id ? await batches.get(store(), input.id) : null;
  const studentIds = prev?.data.studentIds ?? [];
  if (studentIds.length > input.capacity) throw new SchoolError(`This batch already has ${studentIds.length} students.`);
  return batches.put(store(), { ...input, studentIds }, input.id);
}

/** Allot a student to a batch (removing them from any other). Enforces the batch cap (§6.10). */
export async function allotStudent(user: Staff, studentId: string, batchId: string | null) {
  need(user, can(user, 'academics.manage'));
  const all = await allBatches();
  for (const b of all) {
    if (b.id !== batchId && b.data.studentIds.includes(studentId)) await batches.put(store(), { ...b.data, studentIds: b.data.studentIds.filter((s) => s !== studentId) }, b.id);
  }
  if (!batchId) return;
  const b = all.find((x) => x.id === batchId);
  if (!b) throw new SchoolError('Batch not found.');
  if (b.data.studentIds.includes(studentId)) return;
  if (b.data.studentIds.length >= b.data.capacity) throw new SchoolError(`${b.data.name} is full (${b.data.capacity}).`);
  await batches.put(store(), { ...b.data, studentIds: [...b.data.studentIds, studentId] }, b.id);
}

// ---------------------------------------------------------------- timetable

export async function addPeriod(user: Staff, input: { batchId: string; day: number; start: string; end: string; subject: string; facultyId: string; room: string | null }) {
  need(user, can(user, 'academics.manage'));
  const p = timetable.schema.parse(input);
  const clash = timetableClash((await timetable.list(store())).map((r) => r.data), p);
  if (clash) throw new SchoolError(clash.facultyId === p.facultyId ? 'That teacher already has a class then.' : 'That batch already has a class then.');
  return timetable.put(store(), p);
}

export async function removePeriod(user: Staff, id: string) {
  need(user, can(user, 'academics.manage'));
  await timetable.remove(store(), id);
}

export async function myTimetable(user: Staff) {
  return (await timetable.list(store(), { k2: user.id })).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

export async function batchTimetable(batchId: string) {
  return (await timetable.list(store(), { k1: batchId })).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

// ---------------------------------------------------------------- attendance (+ same-day absence alert to parents)

export async function markAttendance(user: Staff, batchId: string, date: string, marks: Record<string, string>) {
  need(user, can(user, 'attendance.mark'));
  await requireTeaches(user, batchId);
  if (date > todayIST()) throw new SchoolError('You can’t mark attendance for a future date.');
  const b = await batches.get(store(), batchId);
  if (!b) throw new SchoolError('Batch not found.');
  const clean: Record<string, (typeof ATTENDANCE)[number]> = {};
  for (const sid of b.data.studentIds) {
    const m = marks[sid];
    if (!m || !(ATTENDANCE as readonly string[]).includes(m)) throw new SchoolError('Mark every student in the batch.');
    clean[sid] = m as (typeof ATTENDANCE)[number];
  }
  const existing = (await attendance.list(store(), { k1: batchId, k2: date }))[0];
  const already = new Set(existing?.data.notifiedAbsent ?? []);
  const rec = await attendance.put(store(), { batchId, date, period: 'day', marks: clean, markedBy: user.id, notifiedAbsent: [...already] }, existing?.id);

  // Parents hear the same day (§9: daily attendance alerts), once per student per day.
  const byId = await studentsById();
  const notified = [...already];
  for (const [sid, m] of Object.entries(clean)) {
    if (m !== 'absent' || already.has(sid)) continue;
    const s = byId.get(sid);
    if (!s) continue;
    for (const g of await getAppStore().guardiansOf(sid)) {
      await sendTemplate({ template: 'absence_alert', to: g.phone, params: [firstName(s.fullName), formatDate(date), b.data.name, college.phones[0].display], leadId: s.leadId, dedupeKey: `absent:${sid}:${date}:${g.phone}` }).catch(() => undefined);
    }
    notified.push(sid);
  }
  if (notified.length !== already.size) await attendance.put(store(), { ...rec.data, notifiedAbsent: notified }, rec.id);
  return { absent: Object.values(clean).filter((m) => m === 'absent').length };
}

export async function batchRegisters(batchId: string, from: string, to: string) {
  return (await attendance.list(store(), { k1: batchId, k2From: from, k2To: to })).map((r) => r.data);
}

// ---------------------------------------------------------------- materials

export async function addMaterial(user: Staff, input: { batchId: string; subject: string; title: string; kind: string; url: string | null; dueDate: string | null }) {
  need(user, can(user, 'materials.upload'));
  await requireTeaches(user, input.batchId);
  return materials.put(store(), { ...input, uploadedBy: user.id });
}

export async function batchMaterials(batchId: string) {
  return (await materials.list(store(), { k1: batchId })).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }));
}

// ---------------------------------------------------------------- tests, marks, results

const questionInput = z.object({ subject: z.string().trim().min(1).max(40), chapter: z.string().trim().min(1).max(80), text: z.string().trim().min(3).max(2000), options: z.array(z.string().trim().min(1).max(500)).length(4), answer: z.coerce.number().int().min(0).max(3), marks: z.coerce.number().min(0).max(10).default(4), negative: z.coerce.number().min(0).max(5).default(1) });

export async function createTest(user: Staff, input: { batchId: string; title: string; date: string; mode: 'online' | 'offline'; durationMin: number; maxMarks: number; subjects: string[] }) {
  need(user, can(user, 'tests.manage'));
  await requireTeaches(user, input.batchId);
  return tests.put(store(), { ...input, questions: [], published: false, createdBy: user.id });
}

async function editableTest(user: Staff, testId: string) {
  const t = await tests.get(store(), testId);
  if (!t) throw new SchoolError('Test not found.');
  need(user, can(user, 'tests.manage'));
  await requireTeaches(user, t.data.batchId);
  return t;
}

export async function addQuestion(user: Staff, testId: string, input: unknown) {
  const t = await editableTest(user, testId);
  if (t.data.mode !== 'online') throw new SchoolError('Questions are only for online tests.');
  if ((await testResults.list(store(), { k1: testId })).length) throw new SchoolError('Students have already taken this test.');
  const q = { id: randomUUID().slice(0, 8), ...questionInput.parse(input) };
  const questions = [...t.data.questions, q];
  return tests.put(store(), { ...t.data, questions, maxMarks: questions.reduce((s, x) => s + x.marks, 0) }, t.id);
}

/**
 * Online exam from the question bank: adds `count` bank questions (filtered by subject / chapter / level,
 * skipping ones already in the exam) with JEE-style marking (+4 / −1). Deterministic for a given exam.
 */
export async function addFromBank(user: Staff, testId: string, f: { subject: string | null; chapter: string | null; difficulty: Difficulty | null; count: number }) {
  const t = await editableTest(user, testId);
  if (t.data.mode !== 'online') throw new SchoolError('Questions are only for online tests.');
  if ((await testResults.list(store(), { k1: testId })).length) throw new SchoolError('Students have already taken this test.');
  const count = Math.min(50, Math.max(1, Math.floor(f.count)));
  const have = new Set(t.data.questions.map((q) => q.id));
  const inExam = new Set([...have].filter((id) => id.startsWith('bank-')).map((id) => id.slice(5)));
  const picked = pickQuestions({ subject: (f.subject as Subject) || null, chapter: f.chapter || null, difficulty: f.difficulty }, inExam, `exam:${testId}:${have.size}`, count).filter((q) => !inExam.has(q.id));
  if (!picked.length) throw new SchoolError('No more bank questions match. Widen the subject, chapter or level.');
  const added = picked.map((q) => ({ id: `bank-${q.id}`, subject: q.subject, chapter: q.chapter, text: q.stem, options: q.options, answer: q.answer, marks: 4, negative: 1 }));
  const questions = [...t.data.questions, ...added].slice(0, 200);
  const subjects = [...new Set([...t.data.subjects, ...added.map((q) => q.subject)])].slice(0, 6);
  await tests.put(store(), { ...t.data, subjects, questions, maxMarks: questions.reduce((s, x) => s + x.marks, 0) }, t.id);
  return `Added ${added.length} question${added.length === 1 ? '' : 's'} from the bank.`;
}

/** Offline test: faculty enter marks per student. */
export async function enterMarks(user: Staff, testId: string, marks: Record<string, { score: number; bySubject?: Record<string, number> }>) {
  const t = await editableTest(user, testId);
  const b = await batches.get(store(), t.data.batchId);
  const existing = new Map((await testResults.list(store(), { k1: testId })).map((r) => [r.data.studentId, r.id]));
  for (const [sid, m] of Object.entries(marks)) {
    if (!b?.data.studentIds.includes(sid)) continue;
    if (!Number.isFinite(m.score) || m.score > t.data.maxMarks || m.score < -t.data.maxMarks) throw new SchoolError(`Marks must be at most ${t.data.maxMarks}.`);
    await testResults.put(store(), { testId, studentId: sid, score: m.score, max: t.data.maxMarks, bySubject: m.bySubject ?? {}, submittedAt: new Date().toISOString(), enteredBy: user.id }, existing.get(sid));
  }
}

/** Exam cell publishes: students and parents can see it, and parents get a WhatsApp note. */
export async function publishTest(user: Staff, testId: string) {
  need(user, can(user, 'results.publish'), 'Only the exam cell publishes results.');
  const t = await tests.get(store(), testId);
  if (!t) throw new SchoolError('Test not found.');
  await tests.put(store(), { ...t.data, published: true }, t.id);
  const byId = await studentsById();
  for (const r of await testResults.list(store(), { k1: testId })) {
    const s = byId.get(r.data.studentId);
    if (!s) continue;
    for (const g of await getAppStore().guardiansOf(s.id)) {
      await sendTemplate({ template: 'test_result', to: g.phone, params: [firstName(s.fullName), t.data.title, `${r.data.score}/${r.data.max}`], leadId: s.leadId, dedupeKey: `result:${testId}:${s.id}:${g.phone}` }).catch(() => undefined);
    }
  }
}

export async function rankList(testId: string) {
  const rows = (await testResults.list(store(), { k1: testId })).map((r) => r.data);
  const ranks = rankResults(rows.map((r) => ({ studentId: r.studentId, score: r.score })));
  const byId = await studentsById();
  return rows
    .map((r) => ({ ...r, name: byId.get(r.studentId)?.fullName ?? 'Student', collegeId: byId.get(r.studentId)?.collegeId ?? '', ...ranks.get(r.studentId)! }))
    .sort((a, b) => a.rank - b.rank);
}

/** Student side: start an online test (once). The server keeps the clock. */
export async function startAttempt(studentId: string, testId: string, now = new Date()) {
  const t = await tests.get(store(), testId);
  if (!t || t.data.mode !== 'online') throw new SchoolError('Test not found.');
  const b = await batchOf(studentId);
  if (!b || b.id !== t.data.batchId) throw new SchoolError('This test is not for your batch.');
  if (t.data.date > todayIST(now)) throw new SchoolError('This test opens on its date.');
  const prev = (await testResults.list(store(), { k1: testId, k2: studentId }))[0];
  if (prev?.data.submittedAt) throw new SchoolError('You have already submitted this test.');
  if (prev) return { attemptId: prev.id, startedAt: prev.data.startedAt! };
  const r = await testResults.put(store(), { testId, studentId, score: 0, max: t.data.maxMarks, bySubject: {}, startedAt: now.toISOString(), submittedAt: '' });
  return { attemptId: r.id, startedAt: now.toISOString() };
}

/** Grace for network delay; answers after the limit + grace are not accepted. */
const GRACE_MS = 60_000;

export async function submitAttempt(studentId: string, testId: string, answers: Record<string, number>, seconds: Record<string, number>, now = new Date()) {
  const t = await tests.get(store(), testId);
  if (!t) throw new SchoolError('Test not found.');
  const prev = (await testResults.list(store(), { k1: testId, k2: studentId }))[0];
  if (!prev?.data.startedAt) throw new SchoolError('Start the test first.');
  if (prev.data.submittedAt) throw new SchoolError('You have already submitted this test.');
  const late = now.getTime() - new Date(prev.data.startedAt).getTime() > t.data.durationMin * 60_000 + GRACE_MS;
  const valid = Object.fromEntries(Object.entries(answers).filter(([qid, a]) => t.data.questions.some((q) => q.id === qid) && Number.isInteger(a) && a >= -1 && a <= 3));
  const s = scoreAttempt(t.data, late ? {} : valid);
  await testResults.put(store(), { testId, studentId, ...s, answers: late ? {} : valid, secondsPerQuestion: seconds, startedAt: prev.data.startedAt, submittedAt: now.toISOString() }, prev.id);
  return { ...s, late };
}

/** Student analytics: every published result with rank, percentile and subject/chapter breakdown. */
export async function studentResults(studentId: string) {
  const b = await batchOf(studentId);
  if (!b) return [];
  const list = (await tests.list(store(), { k1: b.id })).filter((t) => t.data.published).sort((a, c) => a.data.date.localeCompare(c.data.date));
  const out = [];
  for (const t of list) {
    const all = (await testResults.list(store(), { k1: t.id })).filter((r) => r.data.submittedAt);
    const mine = all.find((r) => r.data.studentId === studentId);
    if (!mine) continue;
    const rank = rankResults(all.map((r) => ({ studentId: r.data.studentId, score: r.data.score }))).get(studentId)!;
    out.push({ test: { id: t.id, title: t.data.title, date: t.data.date }, ...mine.data, ...rank, of: all.length, pct: mine.data.max ? (mine.data.score / mine.data.max) * 100 : 0 });
  }
  return out;
}

export async function batchTests(batchId: string) {
  return (await tests.list(store(), { k1: batchId })).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------- doubts

export async function askDoubt(studentId: string, input: { subject: string; text: string; imageUrl: string | null }) {
  const b = await batchOf(studentId);
  if (!b) throw new SchoolError('You are not in a batch yet.');
  return doubts.put(store(), { studentId, batchId: b.id, subject: input.subject, text: input.text, imageUrl: input.imageUrl, status: 'open', answer: null, answeredBy: null, answeredAt: null, channel: 'app', loggedBy: null });
}

/**
 * Multi-channel doubts: a teacher logs a doubt a student raised on WhatsApp, by phone, in person or in the web
 * chat, so every doubt lands in the same inbox and the student sees the answer in the app.
 */
export async function logDoubt(user: Staff, input: { studentId: string; subject: string; text: string; channel: (typeof DOUBT_CHANNELS)[number] }) {
  need(user, can(user, 'doubts.answer'));
  if (!DOUBT_CHANNELS.includes(input.channel) || input.channel === 'app') throw new SchoolError('Choose where the doubt came in.');
  const b = await batchOf(input.studentId);
  if (!b) throw new SchoolError('That student is not in a batch yet.');
  await requireTeaches(user, b.id);
  if (input.text.trim().length < 3) throw new SchoolError('Write the doubt.');
  await doubts.put(store(), { studentId: input.studentId, batchId: b.id, subject: input.subject, text: input.text.trim(), imageUrl: null, status: 'open', answer: null, answeredBy: null, answeredAt: null, channel: input.channel, loggedBy: user.id });
  return 'Doubt logged. Answer it below; the student sees it in the app.';
}

/** Students a teacher can log a doubt for (their batches; heads: all). */
export async function doubtStudents(user: Staff) {
  need(user, can(user, 'doubts.answer'));
  const [batchList, byId] = await Promise.all([allBatches(), studentsById()]);
  const mine = can(user, 'academics.manage') ? null : await myBatchIds(user);
  return batchList.filter((b) => b.data.active && (!mine || mine.has(b.id))).flatMap((b) => b.data.studentIds.map((sid) => ({ id: sid, name: byId.get(sid)?.fullName ?? 'Student', batch: b.data.name }))).sort((a, c) => a.name.localeCompare(c.name));
}

export async function answerDoubt(user: Staff, doubtId: string, answer: string) {
  need(user, can(user, 'doubts.answer'));
  const d = await doubts.get(store(), doubtId);
  if (!d) throw new SchoolError('Doubt not found.');
  await requireTeaches(user, d.data.batchId);
  return doubts.put(store(), { ...d.data, status: 'answered', answer, answeredBy: user.id, answeredAt: new Date().toISOString() }, d.id);
}

/** Open doubts from the batches this teacher teaches. */
export async function doubtInbox(user: Staff) {
  need(user, can(user, 'doubts.answer'));
  const mine = can(user, 'academics.manage') ? null : await myBatchIds(user);
  const byId = await studentsById();
  return (await doubts.list(store()))
    .filter((d) => d.data.status === 'open' && (!mine || mine.has(d.data.batchId)))
    .map((d) => ({ id: d.id, createdAt: d.createdAt, ...d.data, studentName: byId.get(d.data.studentId)?.fullName ?? 'Student' }));
}

export async function studentDoubts(studentId: string) {
  return (await doubts.list(store(), { k1: studentId })).map((d) => ({ id: d.id, createdAt: d.createdAt, ...d.data }));
}

// ---------------------------------------------------------------- notices & circulars

export async function publishNotice(user: Staff, input: { title: string; body: string; audience: string; attachmentUrl: string | null; notify: boolean }) {
  need(user, can(user, 'notices.publish'));
  const n = await notices.put(store(), { title: input.title, body: input.body, audience: input.audience, date: todayIST(), publishedBy: user.id, attachmentUrl: input.attachmentUrl });
  if (input.notify && input.audience !== 'staff') {
    // WhatsApp the guardians in scope (once per phone)
    const students = await allStudents();
    const scope = input.audience.startsWith('batch:') ? new Set((await batches.get(store(), input.audience.slice(6)))?.data.studentIds ?? []) : null;
    const phones = new Set<string>();
    for (const s of students) {
      if (scope && !scope.has(s.id)) continue;
      for (const g of await getAppStore().guardiansOf(s.id)) phones.add(g.phone);
    }
    for (const p of phones) await sendTemplate({ template: 'notice', to: p, params: [input.title.slice(0, 120), `${siteUrl}/app/notices`], dedupeKey: `notice:${n.id}:${p}` }).catch(() => undefined);
  }
  return n;
}

/** Notices for a student / parent: all, their audience, and their batch. */
export async function noticesFor(kind: 'students' | 'parents' | 'staff', batchId: string | null) {
  const all = await notices.list(store());
  return all
    .filter((n) => n.data.audience === 'all' || n.data.audience === kind || (batchId && n.data.audience === `batch:${batchId}`))
    .map((n) => ({ id: n.id, ...n.data }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export { canTeachBatch };
