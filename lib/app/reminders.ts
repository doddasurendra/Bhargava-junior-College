import 'server-only';
import { addDays, todayIST } from '../dates';
import { mentorMeetings, ptmSlots } from '../records/collections';
import { batchOf, store } from '../school/common';
import { teachersFor } from '../school/mentoring';
import { examsForStudent } from '../openbook/closedExam';
import { activityRegs } from '../studentLife/collections';
import { allPrograms, kindLabel, occurrences } from '../studentLife/activities';
import { allSessions, typeLabel } from '../studentLife/sessions';
import { sessionRegs } from '../studentLife/collections';

/**
 * In-app reminders for today and tomorrow, built from what this student or parent actually registered for or
 * booked. They work without WhatsApp; when WhatsApp is connected the same events also get messages.
 */
export interface Reminder { date: string; time: string | null; title: string; detail: string; href: string }

export async function comingUp(p: { kind: 'student' | 'parent'; studentId: string; phone: string | null }, today = todayIST(), now = new Date()): Promise<Reminder[]> {
  const tomorrow = addDays(today, 1);
  const soon = (d: string | null) => !!d && d >= today && d <= tomorrow;
  const out: Reminder[] = [];
  const who = p.kind === 'student' ? p.studentId : p.phone ?? '';

  const [sessions, programs, regs, batch, mentor] = await Promise.all([allSessions(), allPrograms(), activityRegs.list(store()), batchOf(p.studentId), teachersFor(p.studentId)]);
  // speaker sessions this person registered for
  for (const s of sessions.filter((x) => soon(x.date))) {
    if ((await sessionRegs.list(store(), { k1: s.id, k2: who })).length) out.push({ date: s.date, time: s.time, title: s.title, detail: `${typeLabel(s.type)} · ${s.venue ?? (s.onlineUrl ? 'Online' : 'Campus')}`, href: '/app/sessions' });
  }
  // weekly programs the student registered for
  const mine = new Set(regs.filter((r) => r.data.studentId === p.studentId).map((r) => r.data.programId));
  for (const pr of programs.filter((x) => x.active && mine.has(x.id))) for (const d of occurrences(pr, today, tomorrow)) out.push({ date: d, time: pr.time, title: pr.title, detail: `${kindLabel(pr.kind)} · ${pr.venue ?? 'Campus'}`, href: '/app/activities' });
  // mentor meetings
  if (mentor.mentorId) for (const m of await mentorMeetings.list(store(), { k1: mentor.mentorId, k2: p.studentId })) if (m.data.status === 'scheduled' && soon(m.data.date)) out.push({ date: m.data.date!, time: m.data.time, title: 'Meeting with your mentor', detail: m.data.agenda || m.data.mode.replace('_', ' '), href: '/app/mentor' });
  // closed-book exams opening or closing in the next two days (students only)
  if (p.kind === 'student') for (const e of await examsForStudent(p.studentId, batch?.id ?? null)) {
    const c = e.closed;
    if (!c || e.attempt?.data.submittedAt) continue;
    const opens = c.opensAt ? new Date(c.opensAt) : null;
    const closes = c.closesAt ? new Date(c.closesAt) : null;
    const istDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTime = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    if (opens && opens > now && soon(istDay(opens))) out.push({ date: istDay(opens), time: istTime(opens), title: e.title, detail: 'Closed-book exam opens', href: '/app/exams' });
    else if (closes && closes > now && soon(istDay(closes)) && (!opens || opens <= now)) out.push({ date: istDay(closes), time: istTime(closes), title: e.title, detail: 'Closed-book exam closes: take it before then', href: '/app/exams' });
  }
  // PTM slot the parent booked
  if (p.kind === 'parent' && p.phone) for (const s of await ptmSlots.list(store())) if (s.data.bookedBy === p.phone && s.data.studentId === p.studentId && soon(s.data.date)) out.push({ date: s.data.date, time: s.data.time, title: 'Parent-teacher meeting', detail: `${s.data.minutes} min`, href: '/app/ptm' });

  return out.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
}
