import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { isIsoDate, todayIST } from '../dates';
import { MEETING_MODES, mentorMeetings, mentorNotes } from '../records/collections';
import { requireSeesStudent, SchoolError, store, studentsById } from './common';
import { teachersFor } from './mentoring';

/** One-to-one mentor meetings: the mentor schedules, or the student requests and the mentor schedules; outcome after. */
type Mode = (typeof MEETING_MODES)[number];
const OPEN = ['requested', 'scheduled'];

const need = (user: Staff) => {
  if (!can(user, 'mentor.notes')) throw new SchoolError('Only mentors can manage mentor meetings.');
};
function checkSlot(date: string, time: string) {
  if (!isIsoDate(date)) throw new SchoolError('Pick a valid date.');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new SchoolError('Pick a time.');
  if (date < todayIST()) throw new SchoolError('Pick a date from today on.');
}
async function own(user: Staff, id: string) {
  need(user);
  const m = await mentorMeetings.get(store(), id);
  if (!m) throw new SchoolError('Meeting not found.');
  if (m.data.mentorId !== user.id && !can(user, 'academics.manage')) throw new SchoolError('This meeting belongs to another mentor.');
  return m;
}

export async function scheduleMeeting(user: Staff, input: { studentId: string; date: string; time: string; mode: string; agenda: string }) {
  need(user);
  await requireSeesStudent(user, input.studentId);
  checkSlot(input.date, input.time);
  return mentorMeetings.put(store(), { studentId: input.studentId, mentorId: user.id, date: input.date, time: input.time, mode: input.mode as Mode, agenda: input.agenda, status: 'scheduled', requestedBy: 'mentor', outcome: null, shareWithParent: false });
}

/** The student asks their own mentor for a meeting (one open request at a time). */
export async function requestMeeting(studentId: string, reason: string) {
  const { mentorId } = await teachersFor(studentId);
  if (!mentorId) throw new SchoolError('No mentor is assigned to you yet. Please ask your class teacher.');
  const mine = await mentorMeetings.list(store(), { k1: mentorId, k2: studentId });
  if (mine.some((m) => m.data.status === 'requested')) throw new SchoolError('You already have a request waiting. Your mentor will set a time.');
  return mentorMeetings.put(store(), { studentId, mentorId, date: null, time: null, mode: 'in_person', agenda: reason.trim().slice(0, 300), status: 'requested', requestedBy: 'student', outcome: null, shareWithParent: false });
}

export async function setMeetingTime(user: Staff, id: string, date: string, time: string, mode: string) {
  const m = await own(user, id);
  if (!OPEN.includes(m.data.status)) throw new SchoolError('This meeting is already closed.');
  checkSlot(date, time);
  return mentorMeetings.put(store(), { ...m.data, date, time, mode: mode as Mode, status: 'scheduled' }, id);
}

/** Close a meeting. A held meeting with an outcome is also saved as a one-to-one mentor note (shared only if chosen). */
export async function closeMeeting(user: Staff, id: string, status: 'held' | 'missed' | 'cancelled', outcome: string | null, shareWithParent: boolean) {
  const m = await own(user, id);
  if (!OPEN.includes(m.data.status)) throw new SchoolError('This meeting is already closed.');
  if (status !== 'cancelled' && (!m.data.date || m.data.date > todayIST())) throw new SchoolError('Mark it held or missed on or after the meeting day.');
  const text = outcome?.trim() || null;
  if (status === 'held' && !text) throw new SchoolError('Write a short outcome for a held meeting.');
  await mentorMeetings.put(store(), { ...m.data, status, outcome: text, shareWithParent: status === 'held' && shareWithParent }, id);
  if (status === 'held' && text) await mentorNotes.put(store(), { studentId: m.data.studentId, mentorId: m.data.mentorId, date: todayIST(), kind: 'one_to_one', note: text, shareWithParent });
}

/** Mentor page: my requests, upcoming and recent meetings. */
export async function myMeetings(user: Staff) {
  need(user);
  const byId = await studentsById();
  const list = (await mentorMeetings.list(store(), { k1: user.id })).map((m) => ({ id: m.id, ...m.data, name: byId.get(m.data.studentId)?.fullName ?? 'Student' }));
  const key = (m: { date: string | null; time: string | null }) => `${m.date ?? '9999'}${m.time ?? ''}`;
  return {
    requests: list.filter((m) => m.status === 'requested'),
    upcoming: list.filter((m) => m.status === 'scheduled').sort((a, b) => key(a).localeCompare(key(b))),
    past: list.filter((m) => !OPEN.includes(m.status)).sort((a, b) => key(b).localeCompare(key(a))).slice(0, 20),
  };
}

/** Student / parent app. The outcome is shown only when the mentor shared it. */
export async function studentMeetings(studentId: string) {
  const { mentorId } = await teachersFor(studentId);
  const list = mentorId ? (await mentorMeetings.list(store(), { k1: mentorId, k2: studentId })).map((m) => ({ id: m.id, ...m.data, outcome: m.data.shareWithParent ? m.data.outcome : null })) : [];
  return { hasMentor: Boolean(mentorId), open: list.filter((m) => OPEN.includes(m.status)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), past: list.filter((m) => !OPEN.includes(m.status)).sort((a, b) => `${b.date}`.localeCompare(`${a.date}`)).slice(0, 10) };
}
