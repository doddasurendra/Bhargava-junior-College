import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { college } from '@/content/college';
import { getAppStore } from '../app/service';
import { getContent } from '../cms';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, formatDate, todayIST } from '../dates';
import { attendance, batches, doubts, materials, notices, parentNotifications, testResults, tests, timetable, ATTENDANCE, DOUBT_CHANNELS } from '../records/collections';
import { siteUrl } from '../seo';
import { sendTemplate } from '../whatsapp/service';
import { allBatches, allStudents, batchOf, canTeachBatch, firstName, myBatchIds, requireTeaches, SchoolError, store, studentsById } from './common';
import { attendanceSummary, rankResults, scoreAttempt, timetableClash } from './logic';
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

/** How far back a teacher may correct a register; older corrections go through the academic heads. */
export const CORRECTION_DAYS = 7;

/**
 * Save the day's register for a batch: one register per batch per date (saving again corrects it, and every
 * changed mark is kept in `corrections` with who and when). Absent students' parents get the same-day
 * absence alert once. Returns counts of what actually happened to those alerts.
 */
export async function markAttendance(user: Staff, batchId: string, date: string, marks: Record<string, string>, remarks: Record<string, string> = {}, reason = '') {
  need(user, can(user, 'attendance.mark'));
  await requireTeaches(user, batchId);
  const today = todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SchoolError('Pick a date.');
  if (date > today) throw new SchoolError('You can’t mark attendance for a future date.');
  const b = await batches.get(store(), batchId);
  if (!b) throw new SchoolError('Batch not found.');
  const clean: Record<string, (typeof ATTENDANCE)[number]> = {};
  for (const sid of b.data.studentIds) {
    const m = marks[sid];
    if (!m || !(ATTENDANCE as readonly string[]).includes(m)) throw new SchoolError('Mark every student in the batch.');
    clean[sid] = m as (typeof ATTENDANCE)[number];
  }
  const notes: Record<string, string> = {};
  for (const [sid, r] of Object.entries(remarks)) if (clean[sid] && r.trim()) notes[sid] = r.trim().slice(0, 200);

  const existing = (await attendance.list(store(), { k1: batchId, k2: date }))[0];
  const changes = existing ? Object.entries(clean).filter(([sid, m]) => existing.data.marks[sid] !== m).map(([sid, m]) => ({ studentId: sid, from: existing.data.marks[sid] ?? 'none', to: m })) : [];
  if (existing && changes.length && date < addDays(today, -CORRECTION_DAYS) && !can(user, 'academics.manage')) {
    // older registers: the change becomes a correction request that an academic head approves (lib/school/attendanceTools)
    const { requestCorrection } = await import('./attendanceTools');
    await requestCorrection(user, { kind: 'day', batchId, date, subject: null, changes: changes.map((c) => ({ ...c, to: c.to })), reason });
    return { absent: Object.values(existing.data.marks).filter((m) => m === 'absent').length, corrected: null, requested: changes.length, alerts: { sent: 0, simulated: 0, failed: 0, skipped: 0 } };
  }
  const corrections = [...(existing?.data.corrections ?? []), ...(changes.length ? [{ at: new Date().toISOString(), by: user.id, changes }] : [])].slice(-100);
  const already = new Set(existing?.data.notifiedAbsent ?? []);
  const rec = await attendance.put(store(), { batchId, date, period: 'day', marks: clean, remarks: notes, markedBy: existing?.data.markedBy ?? user.id, notifiedAbsent: [...already], corrections }, existing?.id);

  // Parents hear the same day (§9: daily attendance alerts), once per student per date.
  const byId = await studentsById();
  const notified = [...already];
  const alerts = { sent: 0, simulated: 0, failed: 0, skipped: 0 };
  {
    for (const [sid, m] of Object.entries(clean)) {
      if (m !== 'absent' || already.has(sid)) continue;
      const s = byId.get(sid);
      if (!s) continue;
      for (const g of await getAppStore().guardiansOf(sid)) {
        const r = await sendTemplate({ template: 'absence_alert', to: g.phone, params: [firstName(s.fullName), formatDate(date), b.data.name, college.phones[0].display], leadId: s.leadId, actorId: user.id, dedupeKey: `absent:${sid}:${date}:${g.phone}` }).catch((e) => ({ status: 'failed' as const, reason: (e as Error).message, simulated: false }));
        if (r.simulated) alerts.simulated++;
        else if (r.status === 'sent') alerts.sent++;
        else if (r.status === 'failed') alerts.failed++;
        else alerts.skipped++;
      }
      notified.push(sid);
    }
    if (notified.length !== already.size) await attendance.put(store(), { ...rec.data, notifiedAbsent: notified }, rec.id);
  }
  return { absent: Object.values(clean).filter((m) => m === 'absent').length, corrected: existing ? changes.length : null, requested: 0, alerts };
}

export type ParentSendResult = { student: string; to: string; result: 'sent' | 'simulated' | 'failed' | 'skipped'; reason: string | null };

async function recordSend(kind: 'attendance' | 'marks', ref: string, studentId: string, phone: string, sentBy: string, r: { status: string; reason?: string; outboxId?: string | null; simulated?: boolean }): Promise<ParentSendResult['result']> {
  const result = r.simulated ? 'simulated' : r.status === 'sent' ? 'sent' : r.status === 'failed' ? 'failed' : 'skipped';
  await parentNotifications.put(store(), { kind, ref, studentId, phone, outboxId: r.outboxId ?? null, result, reason: r.reason?.slice(0, 300) ?? null, sentBy, at: new Date().toISOString() });
  return result;
}

const maskTo = (p: string) => `******${p.slice(-4)}`;

/**
 * “Send attendance to parents on WhatsApp”: the saved register for that date, to every verified guardian of
 * each student (or only `onlyStudentIds`). The same status is never sent twice to the same number; a
 * corrected status can be sent again. Results say exactly what the API did — never “delivered” up front.
 */
export async function sendAttendanceToParents(user: Staff, batchId: string, date: string, onlyStudentIds?: string[]): Promise<ParentSendResult[]> {
  need(user, can(user, 'attendance.mark'));
  await requireTeaches(user, batchId);
  const b = await batches.get(store(), batchId);
  if (!b) throw new SchoolError('Batch not found.');
  const reg = (await attendance.list(store(), { k1: batchId, k2: date }))[0];
  if (!reg) throw new SchoolError('Save the attendance for this date first.');
  const month = (await attendance.list(store(), { k1: batchId, k2From: `${date.slice(0, 7)}-01`, k2To: date })).map((r) => r.data);
  const byId = await studentsById();
  const ids = (onlyStudentIds?.length ? onlyStudentIds : Object.keys(reg.data.marks)).filter((sid) => reg.data.marks[sid]);
  if (ids.length === 0) throw new SchoolError('Pick at least one student from this register.');
  const LABEL: Record<string, string> = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'On leave' };
  const out: ParentSendResult[] = [];
  for (const sid of ids) {
    const s = byId.get(sid);
    if (!s) continue;
    const mark = reg.data.marks[sid];
    const remark = reg.data.remarks?.[sid];
    const pct = attendanceSummary(month, sid).pct;
    const guardians = await getAppStore().guardiansOf(sid);
    if (guardians.length === 0) {
      out.push({ student: s.fullName, to: '—', result: 'skipped', reason: 'No verified parent number on record.' });
      continue;
    }
    for (const g of guardians) {
      const r = await sendTemplate({
        template: 'attendance_update',
        to: g.phone,
        params: [firstName(s.fullName), formatDate(date), b.data.name, `${LABEL[mark]}${remark ? ` (${remark})` : ''}`, pct === null ? 'not recorded yet' : `${pct}%`, college.phones[0].display],
        leadId: s.leadId,
        actorId: user.id,
        dedupeKey: `att-send:${batchId}:${date}:${sid}:${g.phone}:${mark}`,
      }).catch((e) => ({ status: 'failed' as const, reason: (e as Error).message }));
      const result = await recordSend('attendance', `${batchId}:${date}`, sid, g.phone, user.id, r);
      out.push({ student: s.fullName, to: maskTo(g.phone), result, reason: r.reason ?? null });
    }
  }
  return out;
}

/** “Send examination marks to parents on WhatsApp”: published results only, subject-wise. */
export async function sendMarksToParents(user: Staff, testId: string): Promise<ParentSendResult[]> {
  const t = await tests.get(store(), testId);
  if (!t) throw new SchoolError('Test not found.');
  need(user, can(user, 'tests.manage') || can(user, 'results.publish'));
  await requireTeaches(user, t.data.batchId);
  if (!t.data.published) throw new SchoolError('These results are not published yet. Unpublished marks are never sent to parents.');
  const ranks = await rankList(testId);
  const byId = await studentsById();
  const out: ParentSendResult[] = [];
  for (const r of ranks.filter((x) => x.submittedAt)) {
    const s = byId.get(r.studentId);
    if (!s) continue;
    const subj = Object.entries(r.bySubject ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || t.data.subjects.join(', ');
    const guardians = await getAppStore().guardiansOf(s.id);
    if (guardians.length === 0) out.push({ student: s.fullName, to: '—', result: 'skipped', reason: 'No verified parent number on record.' });
    for (const g of guardians) {
      const res = await sendTemplate({ template: 'marks_update', to: g.phone, params: [firstName(s.fullName), t.data.title, subj, `${r.score}/${r.max}`, `${r.rank} of ${ranks.length}`], leadId: s.leadId, actorId: user.id, dedupeKey: `marks-send:${testId}:${s.id}:${g.phone}:${r.score}` }).catch((e) => ({ status: 'failed' as const, reason: (e as Error).message }));
      const result = await recordSend('marks', testId, s.id, g.phone, user.id, res);
      out.push({ student: s.fullName, to: maskTo(g.phone), result, reason: res.reason ?? null });
    }
  }
  return out;
}

/** Latest send per student and number for a register or test, with the live outbox status. */
export async function sentToParents(ref: string) {
  const rows = (await parentNotifications.list(store(), { k1: ref })).sort((a, b) => b.data.at.localeCompare(a.data.at));
  const latest = new Map<string, (typeof rows)[number]['data']>();
  for (const r of rows) if (!latest.has(`${r.data.studentId}:${r.data.phone}`)) latest.set(`${r.data.studentId}:${r.data.phone}`, r.data);
  return [...latest.values()];
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

const questionInput = z.object({ subject: z.string().trim().min(1).max(40), chapter: z.string().trim().min(1).max(80), topic: z.string().trim().max(120).default(''), text: z.string().trim().min(3).max(2000), options: z.array(z.string().trim().min(1).max(500)).length(4), answer: z.coerce.number().int().min(0).max(3), marks: z.coerce.number().min(0).max(10).default(4), negative: z.coerce.number().min(0).max(5).default(1) });

export async function createTest(user: Staff, input: { batchId: string; title: string; date: string; mode: 'online' | 'offline'; durationMin: number; maxMarks: number; subjects: string[]; examType?: string }) {
  need(user, can(user, 'tests.manage'));
  await requireTeaches(user, input.batchId);
  return tests.put(store(), { ...input, examType: input.examType ?? 'other', questions: [], published: false, createdBy: user.id });
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
  const added = picked.map((q) => ({ id: `bank-${q.id}`, subject: q.subject, chapter: q.chapter, topic: '', text: q.stem, options: q.options, answer: q.answer, marks: 4, negative: 1 }));
  const questions = [...t.data.questions, ...added].slice(0, 200);
  const subjects = [...new Set([...t.data.subjects, ...added.map((q) => q.subject)])].slice(0, 6);
  await tests.put(store(), { ...t.data, subjects, questions, maxMarks: questions.reduce((s, x) => s + x.marks, 0) }, t.id);
  return `Added ${added.length} question${added.length === 1 ? '' : 's'} from the bank.`;
}

/** Offline test: faculty enter marks per student. */
/**
 * Subjects of this test the user may enter marks for: all of them for the exam cell / academic heads,
 * otherwise only the subjects they teach this batch on the timetable (a Maths teacher can't touch Physics).
 */
export async function markableSubjects(user: Staff, t: { batchId: string; subjects: string[] }): Promise<string[]> {
  if (can(user, 'academics.manage')) return t.subjects;
  const mine = new Set((await timetable.list(store(), { k1: t.batchId })).filter((p) => p.data.facultyId === user.id).map((p) => p.data.subject));
  return t.subjects.filter((s) => mine.has(s));
}

export async function enterMarks(user: Staff, testId: string, marks: Record<string, { score?: number; bySubject?: Record<string, number> }>) {
  const t = await editableTest(user, testId);
  if (t.data.published && !can(user, 'results.publish')) throw new SchoolError('These results are published. Ask the exam cell to correct them.');
  const allowed = await markableSubjects(user, t.data);
  if (allowed.length === 0) throw new SchoolError(`You don’t teach ${t.data.subjects.join(' / ')} to this batch, so you can’t enter these marks.`);
  const whole = allowed.length === t.data.subjects.length;
  const b = await batches.get(store(), t.data.batchId);
  const existing = new Map((await testResults.list(store(), { k1: testId })).map((r) => [r.data.studentId, r]));
  for (const [sid, m] of Object.entries(marks)) {
    if (!b?.data.studentIds.includes(sid)) continue;
    const prev = existing.get(sid);
    // Subject marks outside the teacher's own subjects are kept as they were.
    const bySubject = { ...(prev?.data.bySubject ?? {}) };
    for (const [subj, v] of Object.entries(m.bySubject ?? {})) {
      if (!allowed.includes(subj)) throw new SchoolError(`You can’t enter ${subj} marks for this test.`);
      if (!Number.isFinite(v) || Math.abs(v) > t.data.maxMarks) throw new SchoolError(`${subj} marks must be at most ${t.data.maxMarks}.`);
      bySubject[subj] = v;
    }
    // A teacher of only some of the subjects changes the total through their subject marks, never directly.
    const subjTotal = Object.values(bySubject).reduce((s, x) => s + x, 0);
    const score = whole && m.score !== undefined ? m.score : subjTotal;
    if (!Number.isFinite(score) || score > t.data.maxMarks || score < -t.data.maxMarks) throw new SchoolError(`Marks must be at most ${t.data.maxMarks}.`);
    await testResults.put(store(), { testId, studentId: sid, score, max: t.data.maxMarks, bySubject, submittedAt: new Date().toISOString(), enteredBy: user.id }, prev?.id);
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
