import 'server-only';
import { randomBytes } from 'node:crypto';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { weekStart } from '../practice/logic';
import { sendTemplate } from '../whatsapp/service';
import { allBatches, menteeIds, SchoolError, store, studentsById } from '../school/common';
import { anonQuestions, checkins, counsellorBookings, counsellorNotes, helplines, safetyAlerts, wellbeingAccess, wellbeingConsent, wellbeingFlags } from './collections';
import { DEFAULT_HELPLINES, detectDistress, safetyMessage, type Helpline } from './safety';

/**
 * Stress-relief & wellbeing. Privacy rules (DPDP Act 2023, special-category data):
 * - check-ins and notes: the student and the Student Counsellor only
 * - mentor: a "needs a conversation" flag, never the reason, scores or notes
 * - Principal / management: anonymous college-wide trends (batch × week), never names
 * - parents: a summary only if the student agreed, or the counsellor decided there is a safety need
 * Every staff read of wellbeing data is written to the access log.
 */

async function logAccess(user: Staff, what: string, studentId: string | null) {
  await wellbeingAccess.put(store(), { actorId: user.id, role: user.roles[0] ?? '', what, studentId, at: new Date().toISOString() });
}

const need = (ok: boolean) => {
  if (!ok) throw new SchoolError('Only the Student Counsellor can see this.');
};

// ---------------------------------------------------------------- helplines & safety protocol

export async function listHelplines(): Promise<Helpline[]> {
  const rows = await helplines.list(store());
  return rows.length ? rows.map((r) => r.data).sort((a, b) => a.name.localeCompare(b.name)) : DEFAULT_HELPLINES;
}

export async function saveHelpline(user: Staff, h: Helpline, id?: string) {
  if (!can(user, 'wellbeing.helplines')) throw new SchoolError('You do not have permission to do this.');
  // the first edit copies the defaults in, so the list is fully editable
  if (!(await helplines.list(store())).length) for (const d of DEFAULT_HELPLINES) await helplines.put(store(), d);
  return helplines.put(store(), h, id);
}

export async function removeHelpline(user: Staff, id: string) {
  if (!can(user, 'wellbeing.helplines')) throw new SchoolError('You do not have permission to do this.');
  await helplines.remove(store(), id);
}

async function counsellor() {
  const staff = await getCrmRepo().listStaff();
  const c = staff.find((s) => s.roles.includes('student_counsellor'));
  return c ? { name: c.fullName, phone: c.phone } : null;
}

/** Runs the protocol: store an alert, notify the counsellor and the Principal (portal + WhatsApp), return the calm message. */
export async function raiseSafetyAlert(input: { source: 'checkin' | 'anon_question' | 'doubt' | 'chat'; refId: string; studentId: string | null; text: string }) {
  const staff = await getCrmRepo().listStaff();
  const targets = staff.filter((s) => s.roles.includes('student_counsellor') || s.roles.includes('principal'));
  const at = new Date();
  const notified: string[] = [];
  for (const t of targets) {
    notified.push(t.id);
    if (t.phone) {
      // no student details in the message: staff open the portal to see the alert
      await sendTemplate({ template: 'safety_alert', to: t.phone, params: [input.source.replace('_', ' '), at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })], dedupeKey: `safety:${input.source}:${input.refId}:${t.id}` }).catch((e) => console.error('[safety] notify failed', (e as Error).message));
    }
  }
  console.warn(`[safety] alert raised from ${input.source}; notified ${notified.length} staff`);
  await safetyAlerts.put(store(), { source: input.source, refId: input.refId, studentId: input.studentId, excerpt: input.text.replace(/\s+/g, ' ').slice(0, 300), at: at.toISOString(), status: 'open', notified, handledBy: null });
  if (input.studentId) await setFlag(input.studentId, 'needs_conversation', 'safety protocol');
  return { message: safetyMessage(await counsellor(), await listHelplines()), helplines: await listHelplines() };
}

/** Checks any free text a student or visitor writes; returns the calm message if the protocol ran. */
export async function screenText(source: 'checkin' | 'anon_question' | 'doubt' | 'chat', refId: string, studentId: string | null, text: string | null) {
  if (!detectDistress(text)) return null;
  return raiseSafetyAlert({ source, refId, studentId, text: text ?? '' });
}

export async function openAlerts(user: Staff) {
  if (!can(user, 'wellbeing.counsel') && !can(user, 'wellbeing.trends')) throw new SchoolError('You do not have permission to do this.');
  const byId = await studentsById();
  const rows = (await safetyAlerts.list(store())).filter((a) => a.data.status !== 'closed');
  const counsel = can(user, 'wellbeing.counsel');
  await logAccess(user, 'safety_alerts', null);
  // The Principal must act on the alert, so they see who; the excerpt stays with the counsellor.
  return rows.map((a) => ({ id: a.id, source: a.data.source, at: a.data.at, status: a.data.status, student: a.data.studentId ? byId.get(a.data.studentId)?.fullName ?? 'Student' : 'Website visitor (anonymous)', excerpt: counsel ? a.data.excerpt : null }));
}

export async function updateAlert(user: Staff, id: string, status: 'acknowledged' | 'closed') {
  if (!can(user, 'wellbeing.counsel') && !can(user, 'wellbeing.trends')) throw new SchoolError('You do not have permission to do this.');
  const a = await safetyAlerts.get(store(), id);
  if (!a) throw new SchoolError('Alert not found.');
  await safetyAlerts.put(store(), { ...a.data, status, handledBy: user.id }, id);
}

// ---------------------------------------------------------------- student side

export async function consentOf(studentId: string) {
  return (await wellbeingConsent.list(store(), { k1: studentId }))[0] ?? null;
}

export async function giveConsent(studentId: string, shareWithParent: boolean) {
  const prev = await consentOf(studentId);
  return wellbeingConsent.put(store(), { studentId, at: prev?.data.at ?? new Date().toISOString(), shareWithParent }, prev?.id);
}

export async function submitCheckin(studentId: string, input: { mood: number; sleepHours: number; stress: number; note: string | null }, today = todayIST()) {
  if (!(await consentOf(studentId))) throw new SchoolError('Please read and accept the privacy note first.');
  const ws = weekStart(today);
  const prev = (await checkins.list(store(), { k1: studentId, k2: ws }))[0];
  const distress = detectDistress(input.note);
  const rec = await checkins.put(store(), { studentId, weekStart: ws, ...input, distress }, prev?.id);
  // high stress two weeks running → flag for a conversation (the mentor sees only the flag)
  const recent = (await checkins.list(store(), { k1: studentId })).map((c) => c.data).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 2);
  if (recent.length === 2 && recent.every((c) => c.stress >= 4)) await setFlag(studentId, 'needs_conversation', 'high stress 2+ weeks');
  const safety = distress ? await raiseSafetyAlert({ source: 'checkin', refId: rec.id, studentId, text: input.note ?? '' }) : null;
  return { safety };
}

export async function myCheckins(studentId: string) {
  return (await checkins.list(store(), { k1: studentId })).map((c) => ({ id: c.id, ...c.data })).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** The student can delete their own check-ins (DPDP right to erasure). */
export async function deleteMyCheckin(studentId: string, id: string) {
  const c = await checkins.get(store(), id);
  if (!c || c.data.studentId !== studentId) throw new SchoolError('Check-in not found.');
  await checkins.remove(store(), id);
}

export async function bookCounsellor(studentId: string, input: { date: string; time: string; mode: 'in_person' | 'call'; topic: string | null }, today = todayIST()) {
  if (input.date < today) throw new SchoolError('Pick a date from today on.');
  const clash = (await counsellorBookings.list(store(), { k2: input.date })).some((b) => b.data.time === input.time && b.data.status !== 'cancelled');
  if (clash) throw new SchoolError('That slot is taken. Please pick another time.');
  return counsellorBookings.put(store(), { studentId, ...input, status: 'requested' });
}

export async function myBookings(studentId: string) {
  return (await counsellorBookings.list(store(), { k1: studentId })).map((b) => ({ id: b.id, ...b.data })).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

/** Anonymous: nothing links the question to the student. The ticket lets them read the answer later. */
export async function askAnonymously(text: string) {
  const ticket = randomBytes(6).toString('hex');
  const distress = detectDistress(text);
  const rec = await anonQuestions.put(store(), { text, answer: null, answeredAt: null, distress, ticket });
  const safety = distress ? await raiseSafetyAlert({ source: 'anon_question', refId: rec.id, studentId: null, text }) : null;
  return { ticket, safety };
}

export async function anonAnswers(tickets: string[]) {
  const set = new Set(tickets);
  return (await anonQuestions.list(store())).filter((q) => set.has(q.data.ticket)).map((q) => ({ text: q.data.text, answer: q.data.answer, at: q.createdAt }));
}

/** Parent view: only with the student's consent to share, or if the counsellor flagged a safety need. */
export async function parentSummary(studentId: string) {
  const consent = await consentOf(studentId);
  const safetyNeed = (await wellbeingFlags.list(store(), { k1: studentId })).some((f) => f.data.status === 'needs_conversation' && f.data.raisedBy !== 'high stress 2+ weeks');
  if (!consent?.data.shareWithParent && !safetyNeed) return { shared: false as const };
  const recent = (await myCheckins(studentId)).slice(0, 4);
  const avg = (k: 'mood' | 'stress' | 'sleepHours') => (recent.length ? Math.round((recent.reduce((t, c) => t + c[k], 0) / recent.length) * 10) / 10 : null);
  return { shared: true as const, weeks: recent.length, mood: avg('mood'), stress: avg('stress'), sleep: avg('sleepHours'), counsellorAsked: safetyNeed };
}

// ---------------------------------------------------------------- flags (mentor sees only these)

async function setFlag(studentId: string, status: 'needs_conversation' | 'resolved', raisedBy: string) {
  const prev = (await wellbeingFlags.list(store(), { k1: studentId }))[0];
  if (prev?.data.status === status) return;
  await wellbeingFlags.put(store(), { studentId, status, raisedBy, date: todayIST() }, prev?.id);
}

export async function flagStudent(user: Staff, studentId: string, status: 'needs_conversation' | 'resolved') {
  need(can(user, 'wellbeing.counsel'));
  await setFlag(studentId, status, user.id);
}

/** For the mentor view: which of these students need a conversation. No reasons, no scores. */
export async function flagsFor(studentIds: string[]) {
  const set = new Set(studentIds);
  return new Set((await wellbeingFlags.list(store(), { k2: 'needs_conversation' })).map((f) => f.data.studentId).filter((id) => set.has(id)));
}

export async function mentorFlags(user: Staff) {
  const ids = [...(await menteeIds(user.id))];
  return flagsFor(ids);
}

// ---------------------------------------------------------------- counsellor dashboard

export async function counsellorDashboard(user: Staff, today = todayIST()) {
  need(can(user, 'wellbeing.counsel'));
  await logAccess(user, 'counsellor_dashboard', null);
  const byId = await studentsById();
  const [bookings, questions, allChecks, flags] = await Promise.all([counsellorBookings.list(store()), anonQuestions.list(store()), checkins.list(store()), wellbeingFlags.list(store(), { k2: 'needs_conversation' })]);
  const byStudent = new Map<string, { weekStart: string; stress: number }[]>();
  for (const c of allChecks) byStudent.set(c.data.studentId, [...(byStudent.get(c.data.studentId) ?? []), c.data]);
  const highStress = [...byStudent].map(([sid, list]) => {
    const recent = list.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 2);
    return { sid, recent };
  }).filter((x) => x.recent.length === 2 && x.recent.every((c) => c.stress >= 4)).map((x) => ({ studentId: x.sid, name: byId.get(x.sid)?.fullName ?? 'Student', stress: x.recent.map((c) => c.stress) }));
  return {
    bookings: bookings.map((b) => ({ id: b.id, ...b.data, name: byId.get(b.data.studentId)?.fullName ?? 'Student' })).filter((b) => b.date >= addDays(today, -14)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    questions: questions.map((q) => ({ id: q.id, text: q.data.text, answer: q.data.answer, at: q.createdAt })).sort((a, b) => b.at.localeCompare(a.at)),
    highStress,
    flagged: flags.map((f) => ({ studentId: f.data.studentId, name: byId.get(f.data.studentId)?.fullName ?? 'Student', since: f.data.date })),
    students: [...byId.values()].map((s) => ({ id: s.id, name: s.fullName, collegeId: s.collegeId })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function counsellorStudent(user: Staff, studentId: string) {
  need(can(user, 'wellbeing.counsel'));
  await logAccess(user, 'student_file', studentId);
  const [checks, notes] = await Promise.all([myCheckins(studentId), counsellorNotes.list(store(), { k1: studentId })]);
  return { checks, notes: notes.map((n) => n.data).sort((a, b) => b.date.localeCompare(a.date)) };
}

export async function addCounsellorNote(user: Staff, studentId: string, note: string) {
  need(can(user, 'wellbeing.counsel'));
  return counsellorNotes.put(store(), { studentId, note, by: user.id, date: todayIST() });
}

export async function answerAnon(user: Staff, id: string, answer: string) {
  need(can(user, 'wellbeing.counsel'));
  const q = await anonQuestions.get(store(), id);
  if (!q) throw new SchoolError('Question not found.');
  await anonQuestions.put(store(), { ...q.data, answer, answeredAt: new Date().toISOString() }, id);
}

export async function setBookingStatus(user: Staff, id: string, status: 'confirmed' | 'done' | 'cancelled') {
  need(can(user, 'wellbeing.counsel'));
  const b = await counsellorBookings.get(store(), id);
  if (!b) throw new SchoolError('Booking not found.');
  await counsellorBookings.put(store(), { ...b.data, status }, id);
}

export async function bookingsThisWeek(today = todayIST()) {
  const ws = weekStart(today);
  return (await counsellorBookings.list(store())).filter((b) => b.data.date >= ws && b.data.date <= addDays(ws, 6) && b.data.status !== 'cancelled').length;
}

// ---------------------------------------------------------------- anonymous trends (Principal)

/** Average stress by batch and by week. Cells with fewer than 3 check-ins are hidden so nobody can be singled out. */
export async function trends(user: Staff, weeks = 8, today = todayIST()) {
  if (!can(user, 'wellbeing.trends') && !can(user, 'wellbeing.counsel')) throw new SchoolError('You do not have permission to do this.');
  await logAccess(user, 'anonymous_trends', null);
  const ws = weekStart(today);
  const weekList = Array.from({ length: weeks }, (_, i) => addDays(ws, -7 * (weeks - 1 - i)));
  const batches = await allBatches();
  const all = (await checkins.list(store())).map((c) => c.data).filter((c) => c.weekStart >= weekList[0]);
  const cell = (list: { stress: number }[]) => (list.length >= 3 ? Math.round((list.reduce((t, c) => t + c.stress, 0) / list.length) * 10) / 10 : null);
  return {
    weeks: weekList,
    overall: weekList.map((w) => cell(all.filter((c) => c.weekStart === w))),
    participation: weekList.map((w) => all.filter((c) => c.weekStart === w).length),
    byBatch: batches.map((b) => ({ batch: b.data.name, values: weekList.map((w) => cell(all.filter((c) => c.weekStart === w && b.data.studentIds.includes(c.studentId)))) })),
  };
}

/** Summary tile: this week vs last week, college-wide average stress. */
export async function trendTile(today = todayIST()) {
  const ws = weekStart(today);
  const all = (await checkins.list(store())).map((c) => c.data);
  const avg = (w: string) => {
    const l = all.filter((c) => c.weekStart === w);
    return l.length >= 3 ? Math.round((l.reduce((t, c) => t + c.stress, 0) / l.length) * 10) / 10 : null;
  };
  const now = avg(ws) ?? avg(addDays(ws, -7));
  const before = avg(ws) === null ? avg(addDays(ws, -14)) : avg(addDays(ws, -7));
  return { now, before };
}
