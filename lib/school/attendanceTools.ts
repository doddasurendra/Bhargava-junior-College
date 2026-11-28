import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { attendance, attendanceCorrections, ATTENDANCE, batches, messages, subjectAttendance, timetable } from '../records/collections';
import { allBatches, myBatchIds, requireTeaches, SchoolError, store, studentsById } from './common';
import { attendanceSummary, type AttendanceMark } from './logic';
import { CORRECTION_DAYS } from './academics';

/**
 * Attendance beyond the daily register: subject-wise (period) registers, correction requests with approval,
 * and the analytics behind the attendance dashboard and exports. Everything is computed from saved registers;
 * nothing is estimated.
 */
type Mark = (typeof ATTENDANCE)[number];
const need = (ok: boolean, msg = 'You do not have permission to do this.') => { if (!ok) throw new SchoolError(msg); };

// ---------------------------------------------------------------- subject-wise registers

/** Subjects this user may take a subject register for in the batch: all for academic heads, else what they teach on the timetable. */
export async function subjectsFor(user: Staff, batchId: string) {
  const tt = (await timetable.list(store(), { k1: batchId })).map((r) => r.data);
  const all = [...new Set(tt.map((p) => p.subject))].sort();
  return can(user, 'academics.manage') ? all : [...new Set(tt.filter((p) => p.facultyId === user.id).map((p) => p.subject))].sort();
}

export async function markSubjectAttendance(user: Staff, batchId: string, date: string, subject: string, marks: Record<string, string>, remarks: Record<string, string> = {}, reason = '') {
  need(can(user, 'attendance.mark'));
  await requireTeaches(user, batchId);
  const today = todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SchoolError('Pick a date.');
  if (date > today) throw new SchoolError('You can’t mark attendance for a future date.');
  if (!(await subjectsFor(user, batchId)).includes(subject)) throw new SchoolError(`You don’t teach ${subject} to this batch on the timetable.`);
  const b = await batches.get(store(), batchId);
  if (!b) throw new SchoolError('Batch not found.');
  const clean: Record<string, Mark> = {};
  for (const sid of b.data.studentIds) {
    const m = marks[sid];
    if (!m || !(ATTENDANCE as readonly string[]).includes(m)) throw new SchoolError('Mark every student in the batch.');
    clean[sid] = m as Mark;
  }
  const notes: Record<string, string> = {};
  for (const [sid, r] of Object.entries(remarks)) if (clean[sid] && r.trim()) notes[sid] = r.trim().slice(0, 200);
  const existing = (await subjectAttendance.list(store(), { k1: batchId, k2: date })).find((r) => r.data.subject === subject);
  const changes = existing ? Object.entries(clean).filter(([sid, m]) => existing.data.marks[sid] !== m).map(([sid, m]) => ({ studentId: sid, from: existing.data.marks[sid] ?? 'none', to: m })) : [];
  if (existing && changes.length && date < addDays(today, -CORRECTION_DAYS) && !can(user, 'academics.manage')) {
    await requestCorrection(user, { kind: 'subject', batchId, date, subject, changes, reason });
    return { corrected: null, requested: changes.length };
  }
  const corrections = [...(existing?.data.corrections ?? []), ...(changes.length ? [{ at: new Date().toISOString(), by: user.id, changes }] : [])].slice(-100);
  await subjectAttendance.put(store(), { batchId, date, subject, marks: clean, remarks: notes, markedBy: existing?.data.markedBy ?? user.id, corrections }, existing?.id);
  return { corrected: existing ? changes.length : null, requested: 0 };
}

export async function subjectRegister(batchId: string, date: string, subject: string) {
  return (await subjectAttendance.list(store(), { k1: batchId, k2: date })).find((r) => r.data.subject === subject)?.data ?? null;
}

// ---------------------------------------------------------------- correction requests (older registers)

export async function requestCorrection(user: Staff, r: { kind: 'day' | 'subject'; batchId: string; date: string; subject: string | null; changes: { studentId: string; from: string; to: string }[]; reason: string }) {
  if (r.reason.trim().length < 3) throw new SchoolError(`Registers older than ${CORRECTION_DAYS} days need an approved correction: give a reason (at least 3 characters).`);
  await attendanceCorrections.put(store(), { ...r, reason: r.reason.trim(), changes: r.changes.map((c) => ({ ...c, to: c.to as Mark })), requestedBy: user.id, requestedAt: new Date().toISOString(), status: 'pending' });
}

export async function pendingCorrections(user: Staff) {
  const rows = (await attendanceCorrections.list(store(), { k1: 'pending' })).map((r) => ({ id: r.id, ...r.data }));
  if (can(user, 'academics.manage')) return rows;
  return rows.filter((r) => r.requestedBy === user.id);
}

/** An academic head approves (the change is applied and logged with both names) or rejects a request. */
export async function decideCorrection(user: Staff, id: string, decision: 'approve' | 'reject', note: string | null) {
  need(can(user, 'academics.manage'), 'Only the academic coordinator or principal approves attendance corrections.');
  const r = await attendanceCorrections.get(store(), id);
  if (!r || r.data.status !== 'pending') throw new SchoolError('This request was already decided.');
  if (r.data.requestedBy === user.id) throw new SchoolError('Someone else must approve your own request.');
  if (decision === 'approve') {
    const at = new Date().toISOString();
    const log = { at, by: user.id, changes: r.data.changes.map((c) => ({ studentId: c.studentId, from: c.from, to: c.to })) };
    if (r.data.kind === 'day') {
      const reg = (await attendance.list(store(), { k1: r.data.batchId, k2: r.data.date }))[0];
      if (!reg) throw new SchoolError('That register no longer exists.');
      const marks = { ...reg.data.marks };
      for (const c of r.data.changes) marks[c.studentId] = c.to;
      await attendance.put(store(), { ...reg.data, marks, corrections: [...reg.data.corrections, log].slice(-100) }, reg.id);
    } else {
      const reg = (await subjectAttendance.list(store(), { k1: r.data.batchId, k2: r.data.date })).find((x) => x.data.subject === r.data.subject);
      if (!reg) throw new SchoolError('That register no longer exists.');
      const marks = { ...reg.data.marks };
      for (const c of r.data.changes) marks[c.studentId] = c.to;
      await subjectAttendance.put(store(), { ...reg.data, marks, corrections: [...reg.data.corrections, log].slice(-100) }, reg.id);
    }
  }
  await attendanceCorrections.put(store(), { ...r.data, status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: user.id, decidedAt: new Date().toISOString(), note: note?.slice(0, 300) ?? null }, r.id);
}

// ---------------------------------------------------------------- analytics

export interface AttendanceFilter { from: string; to: string; batchId?: string | null; subject?: string | null; threshold?: number }

/** Batches the user may analyse: everything for academic heads and management, else the batches they teach. */
export async function analysableBatches(user: Staff) {
  const all = (await allBatches()).filter((b) => b.data.active !== false);
  if (can(user, 'academics.view')) return all;
  const mine = await myBatchIds(user);
  return all.filter((b) => mine.has(b.id));
}

const pct = (attended: number, counted: number) => (counted > 0 ? Math.round((attended / counted) * 1000) / 10 : null);

export async function attendanceAnalytics(user: Staff, f: AttendanceFilter) {
  need(can(user, 'academics.view') || can(user, 'attendance.mark'));
  const threshold = f.threshold ?? 75;
  const today = todayIST();
  const bs = (await analysableBatches(user)).filter((b) => !f.batchId || b.id === f.batchId);
  const byId = await studentsById();
  const studentIds = [...new Set(bs.flatMap((b) => b.data.studentIds))].filter((s) => byId.has(s));
  const batchOfStudent = new Map(bs.flatMap((b) => b.data.studentIds.map((s) => [s, b.data.name] as const)));

  // registers in range (daily, or one subject)
  const regs: { batchId: string; date: string; marks: Record<string, AttendanceMark> }[] = [];
  for (const b of bs) {
    if (f.subject) {
      regs.push(...(await subjectAttendance.list(store(), { k1: b.id, k2From: f.from, k2To: f.to })).filter((r) => r.data.subject === f.subject).map((r) => ({ batchId: b.id, date: r.data.date, marks: r.data.marks })));
    } else {
      regs.push(...(await attendance.list(store(), { k1: b.id, k2From: f.from, k2To: f.to })).map((r) => ({ batchId: b.id, date: r.data.date, marks: r.data.marks })));
    }
  }
  const tally = (rs: typeof regs) => {
    const t = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const r of rs) for (const m of Object.values(r.marks)) t[m]++;
    return { ...t, pct: pct(t.present + t.late, t.present + t.late + t.absent) };
  };
  // today (always the daily register)
  const todayRegs = f.subject ? [] : regs.filter((r) => r.date === today);
  const todayT = tally(todayRegs);
  const markedToday = new Set(todayRegs.flatMap((r) => Object.keys(r.marks)));

  const byBatch = bs.map((b) => ({ id: b.id, name: b.data.name, students: b.data.studentIds.length, ...tally(regs.filter((r) => r.batchId === b.id)) }));
  const months = [...new Set(regs.map((r) => r.date.slice(0, 7)))].sort();
  const monthly = months.map((m) => ({ month: m, ...tally(regs.filter((r) => r.date.startsWith(m))) }));
  const days = [...new Set(regs.map((r) => r.date))].sort();
  const daily = days.map((d) => ({ date: d, ...tally(regs.filter((r) => r.date === d)) }));
  const students = studentIds.map((sid) => {
    const s = byId.get(sid)!;
    const a = attendanceSummary(regs, sid);
    return { id: sid, name: s.fullName, collegeId: s.collegeId ?? '', batch: batchOfStudent.get(sid) ?? '', ...a };
  }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  // subject-wise comparison (always computed across subject registers in range)
  const subj = new Map<string, { present: number; absent: number; late: number; leave: number }>();
  for (const b of bs) for (const r of await subjectAttendance.list(store(), { k1: b.id, k2From: f.from, k2To: f.to })) {
    const t = subj.get(r.data.subject) ?? { present: 0, absent: 0, late: 0, leave: 0 };
    for (const m of Object.values(r.data.marks)) t[m]++;
    subj.set(r.data.subject, t);
  }
  const subjectWise = [...subj].map(([subject, t]) => ({ subject, ...t, pct: pct(t.present + t.late, t.present + t.late + t.absent) })).sort((a, b) => a.subject.localeCompare(b.subject));
  return {
    threshold, from: f.from, to: f.to, today,
    totalStudents: studentIds.length,
    today_: { ...todayT, unmarked: studentIds.filter((s) => !markedToday.has(s)).length },
    overall: tally(regs),
    registers: regs.length,
    byBatch, monthly, daily, subjectWise,
    students,
    below: students.filter((s) => s.pct !== null && s.pct < threshold),
  };
}

/** One student's full history, month by month (daily register) and by subject. */
export async function studentAttendanceHistory(studentId: string, batchId: string, from: string, to: string) {
  const regs = (await attendance.list(store(), { k1: batchId, k2From: from, k2To: to })).map((r) => r.data).sort((a, b) => a.date.localeCompare(b.date));
  const months = [...new Set(regs.map((r) => r.date.slice(0, 7)))];
  const subj = (await subjectAttendance.list(store(), { k1: batchId, k2From: from, k2To: to })).map((r) => r.data);
  const subjects = [...new Set(subj.map((r) => r.subject))].sort();
  return {
    overall: attendanceSummary(regs, studentId),
    monthly: months.map((m) => ({ month: m, ...attendanceSummary(regs.filter((r) => r.date.startsWith(m)), studentId) })),
    bySubject: subjects.map((s) => ({ subject: s, ...attendanceSummary(subj.filter((r) => r.subject === s), studentId) })),
    days: regs.filter((r) => r.marks[studentId]).map((r) => ({ date: r.date, mark: r.marks[studentId], remark: r.remarks?.[studentId] ?? null })),
  };
}

/**
 * Low-attendance alert to families: the below-threshold list is recomputed here from the registers (never taken from
 * the browser) and each family gets one message in the app's Messages thread per student per day.
 */
export const LOW_ATTENDANCE_PREFIX = 'Attendance alert:';
export async function notifyLowAttendance(user: Staff, f: AttendanceFilter, today = todayIST()) {
  if (!can(user, 'attendance.mark') && !can(user, 'academics.manage')) throw new SchoolError('You do not have permission to do this.');
  const a = await attendanceAnalytics(user, f);
  let sent = 0, skipped = 0;
  for (const s of a.below) {
    const prior = await messages.list(store(), { k1: s.id });
    if (prior.some((m) => m.data.from === 'staff' && m.data.text.startsWith(LOW_ATTENDANCE_PREFIX) && m.createdAt.slice(0, 10) >= today)) { skipped++; continue; }
    await messages.put(store(), {
      studentId: s.id, staffId: user.id, from: 'staff', fromPhone: null, readAt: null,
      text: `${LOW_ATTENDANCE_PREFIX} ${s.name}'s attendance from ${f.from} to ${f.to} is ${s.pct}% (required ${f.threshold}%): ${s.absent} absent, ${s.late} late, ${s.leave} on leave. Please talk to your child, and reply here or call the college if there is a reason we should know about.`,
    });
    sent++;
  }
  return { sent, skipped, students: a.below.length };
}