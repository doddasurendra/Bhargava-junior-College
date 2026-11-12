import 'server-only';
import { getAppStore } from '../app/service';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, formatDate, todayIST } from '../dates';
import { attendance, discipline, mentorNotes, mentorships, messages, ptmSlots, testResults, tests, wellbeing } from '../records/collections';
import { sendTemplate } from '../whatsapp/service';
import { allBatches, batchOf, firstName, menteeIds, requireSeesStudent, SchoolError, store, studentsById } from './common';
import { attendanceSummary, consecutiveAbsences, earlyWarnings, weeklyReportParams } from './logic';
import { participation, sportsProfile } from '../studentLife/sports';
import { attendedBy } from '../studentLife/sessions';
import { flagsFor } from '../studentLife/wellbeing';

const MENTOR_RATIO = 20;

export async function assignMentor(user: Staff, mentorId: string, studentId: string | null, remove = false) {
  if (!can(user, 'academics.manage')) throw new SchoolError('You do not have permission to do this.');
  const existing = await mentorships.list(store(), { k1: mentorId });
  if (remove) {
    const m = existing.find((x) => x.data.studentId === studentId);
    if (m) await mentorships.remove(store(), m.id);
    return;
  }
  if (!studentId) return;
  if (existing.length >= MENTOR_RATIO) throw new SchoolError(`A mentor has at most ${MENTOR_RATIO} students (§6.5).`);
  // one mentor per student
  for (const m of await mentorships.list(store())) if (m.data.studentId === studentId) await mentorships.remove(store(), m.id);
  await mentorships.put(store(), { mentorId, studentId });
}

/** The signals behind an early warning, for one student. */
export async function studentSignals(studentId: string, today = todayIST()) {
  const b = await batchOf(studentId);
  const regs = b ? (await attendance.list(store(), { k1: b.id, k2From: addDays(today, -30), k2To: today })).map((r) => r.data) : [];
  const att = attendanceSummary(regs, studentId);
  const results = (await Promise.all((b ? await tests.list(store(), { k1: b.id }) : []).map(async (t) => ({ t, r: (await testResults.list(store(), { k1: t.id, k2: studentId }))[0] }))))
    .filter((x) => x.r?.data.submittedAt)
    .sort((a, c) => a.t.data.date.localeCompare(c.t.data.date));
  const scorePcts = results.map((x) => (x.r!.data.max ? (x.r!.data.score / x.r!.data.max) * 100 : 0));
  const checks = (await wellbeing.list(store(), { k1: studentId })).sort((a, c) => c.data.month.localeCompare(a.data.month));
  const warnings = earlyWarnings({ attendancePct: att.pct, scorePcts, latestStress: checks[0]?.data.stress ?? null, consecutiveAbsences: consecutiveAbsences(regs, studentId) });
  // student life: the counsellor's flag (never the reason or notes) and no games in 30 days
  if ((await flagsFor([studentId])).has(studentId)) warnings.unshift('Wellbeing: needs a conversation (from the counsellor)');
  if (!(await participation(30, today)).get(studentId)) warnings.push('No sports or games in the last 30 days: encourage them to play');
  return { batch: b?.data.name ?? null, attendance: att, scorePcts, latestCheck: checks[0]?.data ?? null, warnings };
}

/** Mentor home: my mentees with their signals; warnings first. */
export async function myMentees(user: Staff) {
  if (!can(user, 'mentor.notes')) throw new SchoolError('You do not have permission to do this.');
  const ids = can(user, 'academics.view') && user.roles[0] !== 'class_teacher' ? new Set((await mentorships.list(store())).map((m) => m.data.studentId)) : await menteeIds(user.id);
  const byId = await studentsById();
  const rows = await Promise.all([...ids].map(async (id) => ({ student: byId.get(id), ...(await studentSignals(id)) })));
  return rows.filter((r) => r.student).sort((a, b) => b.warnings.length - a.warnings.length || a.student!.fullName.localeCompare(b.student!.fullName));
}

export async function addMentorNote(user: Staff, input: { studentId: string; kind: 'one_to_one' | 'note' | 'parent_call'; note: string; shareWithParent: boolean }) {
  if (!can(user, 'mentor.notes')) throw new SchoolError('You do not have permission to do this.');
  await requireSeesStudent(user, input.studentId);
  return mentorNotes.put(store(), { ...input, mentorId: user.id, date: todayIST() });
}

/** Monthly stress check-in. A low score asks for a private parent call (§6.5), never a public list. */
export async function recordCheckIn(user: Staff, input: { studentId: string; month: string; stress: number; sleep: number; note: string | null }) {
  if (!can(user, 'wellbeing.view')) throw new SchoolError('You do not have permission to do this.');
  await requireSeesStudent(user, input.studentId);
  const prev = (await wellbeing.list(store(), { k1: input.studentId, k2: input.month }))[0];
  const followUp = input.stress <= 2 ? 'parent_call' : 'none';
  return wellbeing.put(store(), { ...input, recordedBy: user.id, followUp }, prev?.id);
}

export async function studentFile(user: Staff, studentId: string) {
  await requireSeesStudent(user, studentId);
  const [notes, checks, disc, signals] = await Promise.all([
    can(user, 'mentor.notes') ? mentorNotes.list(store(), { k1: studentId }) : Promise.resolve([]),
    can(user, 'wellbeing.view') ? wellbeing.list(store(), { k1: studentId }) : Promise.resolve([]),
    can(user, 'discipline.record') ? discipline.list(store(), { k1: studentId }) : Promise.resolve([]),
    studentSignals(studentId),
  ]);
  return { notes: notes.map((n) => n.data), checks: checks.map((c) => c.data).sort((a, b) => b.month.localeCompare(a.month)), discipline: disc.map((d) => d.data), signals };
}

export async function addDiscipline(user: Staff, input: { studentId: string; note: string; action: string | null }) {
  if (!can(user, 'discipline.record')) throw new SchoolError('You do not have permission to do this.');
  await requireSeesStudent(user, input.studentId);
  return discipline.put(store(), { ...input, date: todayIST(), recordedBy: user.id });
}

// ---------------------------------------------------------------- PTM slots & parent messages

export async function addPtmSlots(user: Staff, date: string, times: string[], minutes: number) {
  if (!can(user, 'ptm.manage')) throw new SchoolError('You do not have permission to do this.');
  if (date < todayIST()) throw new SchoolError('Pick a date from today on.');
  const existing = new Set((await ptmSlots.list(store(), { k1: user.id, k2: date })).map((s) => s.data.time));
  let n = 0;
  for (const t of times) {
    if (existing.has(t)) continue;
    await ptmSlots.put(store(), { staffId: user.id, date, time: t, minutes, bookedBy: null, studentId: null });
    n++;
  }
  return n;
}

export async function mySlots(user: Staff) {
  const byId = await studentsById();
  return (await ptmSlots.list(store(), { k1: user.id })).filter((s) => s.data.date >= todayIST()).map((s) => ({ id: s.id, ...s.data, studentName: s.data.studentId ? byId.get(s.data.studentId)?.fullName ?? null : null })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Teachers a parent can book or message: the class teacher, the mentor, and the student's subject teachers. */
export async function teachersFor(studentId: string) {
  const b = await batchOf(studentId);
  const mentor = (await mentorships.list(store())).find((m) => m.data.studentId === studentId)?.data.mentorId ?? null;
  return { classTeacherId: b?.data.classTeacherId ?? null, mentorId: mentor };
}

export async function bookPtm(phone: string, studentId: string, slotId: string) {
  const slot = await ptmSlots.get(store(), slotId);
  if (!slot || slot.data.date < todayIST()) throw new SchoolError('That slot is no longer available.');
  const t = await teachersFor(studentId);
  if (slot.data.staffId !== t.classTeacherId && slot.data.staffId !== t.mentorId) throw new SchoolError('Book with your child’s class teacher or mentor.');
  if (slot.data.bookedBy && slot.data.bookedBy !== phone) throw new SchoolError('That slot was just taken. Pick another.');
  return ptmSlots.put(store(), { ...slot.data, bookedBy: phone, studentId }, slot.id);
}

export async function openSlotsFor(studentId: string) {
  const t = await teachersFor(studentId);
  // the class teacher is often also the mentor: list each teacher's slots once
  const ids = [...new Set([t.classTeacherId, t.mentorId].filter((x): x is string => Boolean(x)))];
  const slots = (await Promise.all(ids.map((id) => ptmSlots.list(store(), { k1: id })))).flat();
  return slots.filter((s) => s.data.date >= todayIST() && (!s.data.bookedBy || s.data.studentId === studentId)).map((s) => ({ id: s.id, ...s.data })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function sendParentMessage(phone: string, studentId: string, text: string) {
  const t = await teachersFor(studentId);
  const to = t.mentorId ?? t.classTeacherId;
  if (!to) throw new SchoolError('No class teacher or mentor is assigned yet. Please call the college office.');
  return messages.put(store(), { studentId, staffId: to, from: 'parent', fromPhone: phone, text, readAt: null });
}

export async function thread(studentId: string) {
  return (await messages.list(store(), { k1: studentId })).map((m) => ({ id: m.id, createdAt: m.createdAt, ...m.data })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function staffInbox(user: Staff) {
  if (!can(user, 'messages.reply')) throw new SchoolError('You do not have permission to do this.');
  const byId = await studentsById();
  const all = (await messages.list(store())).filter((m) => m.data.staffId === user.id);
  const threads = new Map<string, { studentId: string; name: string; last: string; unread: number; lastText: string }>();
  for (const m of all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const t = threads.get(m.data.studentId) ?? { studentId: m.data.studentId, name: byId.get(m.data.studentId)?.fullName ?? 'Student', last: m.createdAt, unread: 0, lastText: '' };
    t.last = m.createdAt;
    t.lastText = m.data.text;
    if (m.data.from === 'parent' && !m.data.readAt) t.unread++;
    threads.set(m.data.studentId, t);
  }
  return [...threads.values()].sort((a, b) => b.last.localeCompare(a.last));
}

export async function replyToParent(user: Staff, studentId: string, text: string) {
  if (!can(user, 'messages.reply')) throw new SchoolError('You do not have permission to do this.');
  const msgs = (await messages.list(store(), { k1: studentId })).filter((m) => m.data.staffId === user.id);
  if (msgs.length === 0) throw new SchoolError('There is no conversation with this family yet.');
  for (const m of msgs) if (m.data.from === 'parent' && !m.data.readAt) await messages.put(store(), { ...m.data, readAt: new Date().toISOString() }, m.id);
  return messages.put(store(), { studentId, staffId: user.id, from: 'staff', fromPhone: null, text, readAt: null });
}

// ---------------------------------------------------------------- Sunday parent report (§6.9)

/** Builds and sends the weekly report for every student (Sunday cron). Safe to re-run: one message per week per guardian. */
export async function sendWeeklyReports(today = todayIST()) {
  const from = addDays(today, -6);
  const byId = await studentsById();
  const counts = { students: 0, messages: 0 };
  for (const b of await allBatches()) {
    if (!b.data.active) continue;
    const regs = (await attendance.list(store(), { k1: b.id, k2From: from, k2To: today })).map((r) => r.data);
    const weekTests = (await tests.list(store(), { k1: b.id, k2From: from, k2To: today })).filter((t) => t.data.published);
    for (const sid of b.data.studentIds) {
      const s = byId.get(sid);
      if (!s) continue;
      counts.students++;
      const att = attendanceSummary(regs, sid);
      const results = [];
      for (const t of weekTests) {
        const r = (await testResults.list(store(), { k1: t.id, k2: sid }))[0];
        if (r?.data.submittedAt) results.push({ title: t.data.title, pct: r.data.max ? (r.data.score / r.data.max) * 100 : 0 });
      }
      const note = (await mentorNotes.list(store(), { k1: sid, k2From: from, k2To: today })).find((n) => n.data.shareWithParent)?.data.note ?? null;
      const [sp, sessionsAttended] = await Promise.all([sportsProfile(sid, today), attendedBy(sid, from)]);
      const params = weeklyReportParams({ studentFirstName: firstName(s.fullName), weekLabel: `${formatDate(from, { day: 'numeric', month: 'short' })} – ${formatDate(today, { day: 'numeric', month: 'short' })}`, attendance: { present: att.present + att.late, days: att.days - att.leave }, tests: results, mentorNote: note, sportsPlayed: sp.playedThisWeek, sessions: sessionsAttended.filter((x) => x.date <= today).map((x) => x.title) });
      for (const g of await getAppStore().guardiansOf(sid)) {
        const r = await sendTemplate({ template: 'weekly_report', to: g.phone, params, leadId: s.leadId, dedupeKey: `weekly:${today}:${sid}:${g.phone}` }).catch(() => null);
        if (r?.status === 'sent') counts.messages++;
      }
    }
  }
  return counts;
}

/** Notes the mentor chose to share, for the parent app. */
export async function sharedNotes(studentId: string) {
  return (await mentorNotes.list(store(), { k1: studentId })).filter((n) => n.data.shareWithParent).map((n) => n.data).sort((a, b) => b.date.localeCompare(a.date));
}
