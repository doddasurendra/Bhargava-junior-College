import 'server-only';
import { getAppStore } from '../app/service';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, formatDate, todayIST } from '../dates';
import { events, notices } from '../records/collections';
import { sendTemplate } from '../whatsapp/service';
import { batchOf, SchoolError, store, studentsById } from '../school/common';
import { SESSION_TYPES, sessionFeedback, sessionRegs, sessions, speakers } from './collections';

/** Motivational speakers & sessions: speakers, schedule, registration, attendance, feedback, report. */

const need = (user: Staff) => {
  if (!can(user, 'sessions.manage')) throw new SchoolError('You do not have permission to manage sessions.');
};
export const typeLabel = (t: string) => SESSION_TYPES.find((x) => x.value === t)?.label ?? t;

export async function allSpeakers() {
  return (await speakers.list(store())).map((s) => ({ id: s.id, ...s.data })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSpeaker(user: Staff, input: { name: string; background: string; topic: string; contact: string | null; fee: number | null }) {
  need(user);
  return speakers.put(store(), { ...input, sample: false });
}

export async function allSessions() {
  const sp = new Map((await allSpeakers()).map((s) => [s.id, s]));
  return (await sessions.list(store())).map((s) => ({ id: s.id, ...s.data, speaker: s.data.speakerId ? sp.get(s.data.speakerId) ?? null : null })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Creating a session also puts it on the Events calendar and in Notices (the reminders students and parents see). */
export async function createSession(user: Staff, input: { title: string; type: string; speakerId: string | null; date: string; time: string; venue: string | null; onlineUrl: string | null; audience: string; capacity: number; summary: string | null; alumniId?: string | null }) {
  need(user);
  if (input.date < todayIST()) throw new SchoolError('Pick a date from today on.');
  const s = await sessions.put(store(), { ...input, recordingPath: null, alumniId: input.alumniId ?? null, sample: false, createdBy: user.id });
  const evAudience = input.audience === 'parents' ? 'parents' : 'students';
  const where = input.venue ?? (input.onlineUrl ? 'Online' : 'Campus');
  await events.put(store(), { title: `${typeLabel(input.type)}: ${input.title}`, date: input.date, endDate: null, kind: 'event', audience: evAudience, location: where, note: `${input.time} · register in the app. Session id ${s.id}`, createdBy: user.id });
  await notices.put(store(), { title: `${typeLabel(input.type)} on ${formatDate(input.date, { day: 'numeric', month: 'short' })}`, body: `${input.title} at ${input.time}, ${where}. ${input.summary ?? ''} Register in the app (seats: ${input.capacity}).`.trim(), audience: input.audience === 'parents' ? 'parents' : input.audience.startsWith('batch:') ? input.audience : 'students', date: todayIST(), publishedBy: user.id, attachmentUrl: null });
  return s;
}

async function regsOf(sessionId: string) {
  return (await sessionRegs.list(store(), { k1: sessionId })).map((r) => ({ id: r.id, ...r.data }));
}

/** Who may register: students in the audience (all, or the batch), parents for parent seminars. */
export async function register(sessionId: string, who: { kind: 'student'; studentId: string } | { kind: 'parent'; phone: string; studentId: string }) {
  const s = await sessions.get(store(), sessionId);
  if (!s || s.data.date < todayIST()) throw new SchoolError('This session is not open for registration.');
  const a = s.data.audience;
  if (who.kind === 'parent' && a !== 'parents') throw new SchoolError('This session is for students.');
  if (who.kind === 'student') {
    if (a === 'parents') throw new SchoolError('This session is for parents.');
    if (a.startsWith('batch:') && (await batchOf(who.studentId))?.id !== a.slice(6)) throw new SchoolError('This session is for another batch.');
  }
  const key = who.kind === 'student' ? who.studentId : who.phone;
  const regs = await regsOf(sessionId);
  const mine = regs.find((r) => r.who === key);
  if (mine) {
    await sessionRegs.remove(store(), mine.id);
    return 'cancelled' as const;
  }
  if (regs.length >= s.data.capacity) throw new SchoolError('This session is full.');
  await sessionRegs.put(store(), { sessionId, who: key, kind: who.kind, studentId: who.studentId, attended: false });
  return 'registered' as const;
}

export async function markAttended(user: Staff, sessionId: string, presentKeys: string[]) {
  need(user);
  const set = new Set(presentKeys);
  for (const r of await regsOf(sessionId)) await sessionRegs.put(store(), { sessionId, who: r.who, kind: r.kind, studentId: r.studentId, attended: set.has(r.who) }, r.id);
}

export async function giveFeedback(sessionId: string, who: string, rating: number, comment: string | null) {
  const r = (await regsOf(sessionId)).find((x) => x.who === who);
  if (!r?.attended) throw new SchoolError('Feedback is for people who attended.');
  const prev = (await sessionFeedback.list(store(), { k1: sessionId, k2: who }))[0];
  return sessionFeedback.put(store(), { sessionId, who, rating, comment }, prev?.id);
}

export async function setRecording(user: Staff, sessionId: string, path: string) {
  need(user);
  const s = await sessions.get(store(), sessionId);
  if (!s) throw new SchoolError('Session not found.');
  await sessions.put(store(), { ...s.data, recordingPath: path }, sessionId);
}

/** Auto-summary for the Principal: attendance %, average rating, top comments. */
export async function sessionReport(sessionId: string) {
  const [regs, fb] = await Promise.all([regsOf(sessionId), sessionFeedback.list(store(), { k1: sessionId })]);
  const attended = regs.filter((r) => r.attended).length;
  const ratings = fb.map((f) => f.data.rating);
  return {
    registered: regs.length,
    attended,
    attendancePct: regs.length ? Math.round((attended / regs.length) * 100) : null,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    feedbackCount: ratings.length,
    topComments: fb.filter((f) => f.data.comment).sort((a, b) => b.data.rating - a.data.rating).slice(0, 3).map((f) => f.data.comment as string),
  };
}

export async function staffSessions(user: Staff, today = todayIST()) {
  if (!can(user, 'sessions.manage') && !can(user, 'academics.view')) throw new SchoolError('You do not have permission to do this.');
  const byId = await studentsById();
  const list = await allSessions();
  return Promise.all(list.map(async (s) => ({ ...s, past: s.date < today, regs: (await regsOf(s.id)).map((r) => ({ ...r, name: r.kind === 'student' ? byId.get(r.who)?.fullName ?? 'Student' : `Parent of ${byId.get(r.studentId ?? '')?.fullName ?? 'student'}` })), report: await sessionReport(s.id) })));
}

/** App: sessions this person may attend, with their registration and feedback. */
export async function portalSessions(p: { kind: 'student'; studentId: string } | { kind: 'parent'; phone: string; studentId: string }, today = todayIST()) {
  const batch = await batchOf(p.studentId);
  const key = p.kind === 'student' ? p.studentId : p.phone;
  const list = (await allSessions()).filter((s) => (p.kind === 'parent' ? s.audience === 'parents' : s.audience === 'all_students' || s.audience === `batch:${batch?.id}`));
  return Promise.all(list.map(async (s) => {
    const regs = await regsOf(s.id);
    const mine = regs.find((r) => r.who === key) ?? null;
    const fb = (await sessionFeedback.list(store(), { k1: s.id, k2: key }))[0]?.data ?? null;
    return { ...s, past: s.date < today, registered: Boolean(mine), attended: Boolean(mine?.attended), seatsLeft: Math.max(0, s.capacity - regs.length), feedback: fb };
  }));
}

export async function nextSession(today = todayIST()) {
  return (await allSessions()).find((s) => s.date >= today) ?? null;
}

/** Sessions a student attended (assistant profile, weekly report). */
export async function attendedBy(studentId: string, from?: string) {
  const all = await allSessions();
  const out: { title: string; date: string }[] = [];
  for (const s of all) {
    if (from && s.date < from) continue;
    const r = (await sessionRegs.list(store(), { k1: s.id, k2: studentId }))[0];
    if (r?.data.attended) out.push({ title: s.title, date: s.date });
  }
  return out;
}

/** WhatsApp reminders the day before (cron-safe: one per person per session). */
export async function sendSessionReminders(today = todayIST()) {
  const tomorrow = addDays(today, 1);
  let sent = 0;
  for (const s of (await allSessions()).filter((x) => x.date === tomorrow)) {
    for (const r of await regsOf(s.id)) {
      const phones = r.kind === 'parent' ? [r.who] : (await getAppStore().guardiansOf(r.who)).map((g) => g.phone).slice(0, 1);
      for (const to of phones) {
        const res = await sendTemplate({ template: 'session_reminder', to, params: [s.title, formatDate(s.date, { day: 'numeric', month: 'short' }), s.time, s.venue ?? s.onlineUrl ?? 'Campus'], dedupeKey: `session:${s.id}:${to}` }).catch(() => null);
        if (res?.status === 'sent') sent++;
      }
    }
  }
  return sent;
}
