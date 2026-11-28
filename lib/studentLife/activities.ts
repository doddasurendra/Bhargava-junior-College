import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, formatDate, todayIST } from '../dates';
import { notices } from '../records/collections';
import { batchOf, SchoolError, store, studentsById } from '../school/common';
import { activityAttendance, activityPrograms, activityRegs, PROGRAM_KINDS, WEEKDAYS } from './collections';

/**
 * Weekly activity programs: yoga, meditation, breathing, stress relief, mindfulness, fitness and sports practice.
 * The Sports Coach (PE / yoga instructor) manages them; staff with sports.view see reports. Students see only
 * their own registrations and attendance. Nothing about health is recorded.
 */
const need = (user: Staff) => {
  if (!can(user, 'sports.manage')) throw new SchoolError('Only the Sports Coach / PE and yoga instructors can manage activity programs.');
};
const canView = (user: Staff) => can(user, 'sports.manage') || can(user, 'sports.view');
export const kindLabel = (k: string) => PROGRAM_KINDS.find((x) => x.value === k)?.label ?? k;
export const WELLNESS_KINDS = ['yoga', 'meditation', 'breathing', 'stress_relief', 'mindfulness', 'fitness'];

/** Weekday key of an ISO date (IST). */
export const weekdayOf = (d: string) => WEEKDAYS[(new Date(`${d}T12:00:00+05:30`).getUTCDay() + 6) % 7];

/** Dates the program meets between from and to (inclusive), inside its own start/end dates. */
export function occurrences(p: { days: readonly string[]; startDate: string; endDate: string | null }, from: string, to: string) {
  const out: string[] = [];
  const a = from > p.startDate ? from : p.startDate;
  const b = p.endDate && p.endDate < to ? p.endDate : to;
  for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) if (p.days.includes(weekdayOf(d))) out.push(d);
  return out;
}

export async function allPrograms() {
  return (await activityPrograms.list(store())).map((r) => ({ id: r.id, ...r.data })).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

export async function createProgram(user: Staff, input: Record<string, unknown>) {
  need(user);
  const p = await activityPrograms.put(store(), { ...input, active: true, createdBy: user.id });
  const d = p.data;
  await notices.put(store(), {
    title: `${kindLabel(d.kind)}: ${d.title}`,
    body: `${d.days.map((x) => x[0].toUpperCase() + x.slice(1)).join(', ')} at ${d.time} (${d.durationMin} min), ${d.venue ?? 'Campus'}, with ${d.instructor}. Starts ${formatDate(d.startDate, { day: 'numeric', month: 'short' })}. Register in the app (seats: ${d.capacity}).`,
    audience: d.audience === 'all_students' ? 'students' : d.audience,
    date: todayIST(),
    publishedBy: user.id,
    attachmentUrl: null,
  });
  return p;
}

export async function setProgramActive(user: Staff, id: string, active: boolean) {
  need(user);
  const p = await activityPrograms.get(store(), id);
  if (!p) throw new SchoolError('Program not found.');
  await activityPrograms.put(store(), { ...p.data, active }, id);
}

async function regsOf(programId: string) {
  return (await activityRegs.list(store(), { k1: programId })).map((r) => ({ id: r.id, ...r.data }));
}

/** Student registers (or cancels). Audience and capacity are checked here, not only in the page. */
export async function toggleRegistration(studentId: string, programId: string) {
  const p = await activityPrograms.get(store(), programId);
  if (!p || !p.data.active || (p.data.endDate && p.data.endDate < todayIST())) throw new SchoolError('This program is not open for registration.');
  if (p.data.audience.startsWith('batch:') && (await batchOf(studentId))?.id !== p.data.audience.slice(6)) throw new SchoolError('This program is for another batch.');
  const regs = await regsOf(programId);
  const mine = regs.find((r) => r.studentId === studentId);
  if (mine) { await activityRegs.remove(store(), mine.id); return 'cancelled' as const; }
  if (regs.length >= p.data.capacity) throw new SchoolError('This program is full.');
  await activityRegs.put(store(), { programId, studentId });
  return 'registered' as const;
}

/** Attendance for one class. Only registered students can be marked; only on a day the program meets; not in the future. */
export async function markProgramAttendance(user: Staff, programId: string, date: string, present: string[]) {
  need(user);
  const p = await activityPrograms.get(store(), programId);
  if (!p) throw new SchoolError('Program not found.');
  if (date > todayIST()) throw new SchoolError('You can’t mark a future date.');
  if (!occurrences(p.data, date, date).length) throw new SchoolError(`${kindLabel(p.data.kind)} does not meet on ${formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}.`);
  const registered = new Set((await regsOf(programId)).map((r) => r.studentId));
  const list = [...new Set(present)].filter((s) => registered.has(s));
  const prev = (await activityAttendance.list(store(), { k1: programId, k2: date }))[0];
  return activityAttendance.put(store(), { programId, date, present: list, markedBy: user.id }, prev?.id);
}

/** Coach / instructor page: programs, registrations (names only for managers), recent classes. */
export async function staffPrograms(user: Staff, today = todayIST()) {
  if (!canView(user)) throw new SchoolError('You do not have permission to do this.');
  const manage = can(user, 'sports.manage');
  const [list, byId, att] = await Promise.all([allPrograms(), manage ? studentsById() : Promise.resolve(new Map()), activityAttendance.list(store())]);
  return Promise.all(list.map(async (p) => {
    const regs = await regsOf(p.id);
    const held = att.filter((a) => a.data.programId === p.id).map((a) => a.data).sort((a, b) => b.date.localeCompare(a.date));
    const avg = held.length && regs.length ? Math.round((held.reduce((s, h) => s + h.present.length, 0) / held.length / regs.length) * 100) : null;
    return {
      ...p,
      registered: regs.length,
      students: manage ? regs.map((r) => ({ id: r.studentId, name: byId.get(r.studentId)?.fullName ?? 'Student' })).sort((a, b) => a.name.localeCompare(b.name)) : [],
      held: held.length,
      avgAttendance: avg,
      lastHeld: held[0]?.date ?? null,
      recentDates: occurrences(p, addDays(today, -13), today).reverse(),
      presentOn: Object.fromEntries(held.slice(0, 14).map((h) => [h.date, h.present])),
    };
  }));
}

/** Student / parent app: open programs for the student's batch, with their own registration and attendance only. */
export async function portalPrograms(studentId: string, today = todayIST()) {
  const batch = await batchOf(studentId);
  const [list, att] = await Promise.all([allPrograms(), activityAttendance.list(store())]);
  const mineList = list.filter((p) => p.active && (!p.endDate || p.endDate >= today) && (p.audience === 'all_students' || p.audience === `batch:${batch?.id}`));
  return Promise.all(mineList.map(async (p) => {
    const regs = await regsOf(p.id);
    const held = att.filter((a) => a.data.programId === p.id);
    const registered = regs.some((r) => r.studentId === studentId);
    return {
      ...p,
      registered,
      seatsLeft: Math.max(0, p.capacity - regs.length),
      attended: held.filter((h) => h.data.present.includes(studentId)).length,
      classesHeld: registered ? held.length : 0,
      next: occurrences(p, today, addDays(today, 13)).slice(0, 3),
    };
  }));
}

/** Calendar of classes for the next `days` days. */
export async function programCalendar(from = todayIST(), days = 14) {
  const to = addDays(from, days - 1);
  const list = (await allPrograms()).filter((p) => p.active);
  return list.flatMap((p) => occurrences(p, from, to).map((date) => ({ date, time: p.time, title: p.title, kind: p.kind, venue: p.venue, instructor: p.instructor }))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Aggregates for reports and analytics (no student names). */
export async function programReport(user: Staff, from: string, to: string) {
  if (!canView(user)) throw new SchoolError('You do not have permission to do this.');
  const [list, att, regsAll] = await Promise.all([allPrograms(), activityAttendance.list(store()), activityRegs.list(store())]);
  const rows = list.map((p) => {
    const regs = regsAll.filter((r) => r.data.programId === p.id).length;
    const held = att.filter((a) => a.data.programId === p.id && a.data.date >= from && a.data.date <= to).map((a) => a.data);
    const scheduled = occurrences(p, from, to > todayIST() ? todayIST() : to).length;
    const presentTotal = held.reduce((s, h) => s + h.present.length, 0);
    return { id: p.id, title: p.title, kind: p.kind, instructor: p.instructor, registered: regs, scheduled, held: held.length, presentTotal, avgAttendance: held.length && regs ? Math.round((presentTotal / held.length / regs) * 100) : null };
  });
  const participants = new Set(att.filter((a) => a.data.date >= from && a.data.date <= to).flatMap((a) => a.data.present));
  const byKind = PROGRAM_KINDS.map((k) => ({ kind: k.value, label: k.label, programs: rows.filter((r) => r.kind === k.value).length, attendances: rows.filter((r) => r.kind === k.value).reduce((s, r) => s + r.presentTotal, 0) })).filter((k) => k.programs);
  const months = new Map<string, number>();
  for (const a of att) if (a.data.date >= from && a.data.date <= to) months.set(a.data.date.slice(0, 7), (months.get(a.data.date.slice(0, 7)) ?? 0) + a.data.present.length);
  return { rows, byKind, participants: participants.size, monthly: [...months].sort().map(([m, n]) => ({ date: `${m}-01`, attendances: n })) };
}

/** Facts the college assistant may state (public schedule only, no names). */
export async function programsForAssistant(today = todayIST()) {
  return (await allPrograms()).filter((p) => p.active && (!p.endDate || p.endDate >= today)).map((p) => `${kindLabel(p.kind)}: ${p.title}, ${p.days.join('/')} at ${p.time} (${p.durationMin} min), ${p.venue ?? 'campus'}, instructor ${p.instructor}`);
}
