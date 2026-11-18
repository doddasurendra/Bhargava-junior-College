import 'server-only';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { leaveRequests, STAFF_ATTENDANCE, staffAttendance, staffProfiles, timetable, batches } from '../records/collections';
import { SchoolError, store } from './common';

/**
 * Staff members' own attendance (master prompt §4.H). Everyone sees ONLY their own rows here: every read in
 * this file for an ordinary user is keyed by `user.id`. The principal, admin office and Super Admin (permission
 * `staff.attendance`) see and correct everyone's, with each correction kept in the row's history.
 */

type Status = (typeof STAFF_ATTENDANCE)[number];
const nowTime = (d = new Date()) => d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

async function rowFor(staffId: string, date: string) {
  return (await staffAttendance.list(store(), { k1: staffId, k2: date }))[0] ?? null;
}

/** Days in a month (YYYY-MM) up to today, oldest first. */
function monthDays(month: string, today: string) {
  const out: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month) && d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

export async function checkIn(user: Staff) {
  const today = todayIST();
  const cur = await rowFor(user.id, today);
  if (cur?.data.checkIn) throw new SchoolError(`You already checked in at ${cur.data.checkIn}.`);
  const t = nowTime();
  await staffAttendance.put(store(), { staffId: user.id, date: today, status: 'present', checkIn: t, checkOut: null, source: 'self', markedBy: user.id, history: [...(cur?.data.history ?? []), { at: new Date().toISOString(), by: user.id, from: cur?.data.status ?? null, to: 'present', reason: `self check-in ${t}` }] }, cur?.id);
  return t;
}

export async function checkOut(user: Staff) {
  const today = todayIST();
  const cur = await rowFor(user.id, today);
  if (!cur?.data.checkIn) throw new SchoolError('Check in first.');
  if (cur.data.checkOut) throw new SchoolError(`You already checked out at ${cur.data.checkOut}.`);
  const t = nowTime();
  await staffAttendance.put(store(), { ...cur.data, checkOut: t, history: [...cur.data.history, { at: new Date().toISOString(), by: user.id, from: cur.data.status, to: cur.data.status, reason: `self check-out ${t}` }] }, cur.id);
  return t;
}

/** One person's month: each day's status (approved leave fills days with no row), with totals. */
export async function attendanceMonth(staffId: string, month: string, today = todayIST()) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new SchoolError('Pick a month.');
  const [rows, leaves] = await Promise.all([staffAttendance.list(store(), { k1: staffId, k2From: `${month}-01`, k2To: `${month}-31` }), leaveRequests.list(store(), { k1: staffId })]);
  const byDate = new Map(rows.map((r) => [r.data.date, r.data]));
  const approved = leaves.filter((l) => l.data.status === 'approved');
  const onLeave = (d: string) => approved.some((l) => l.data.from <= d && d <= l.data.to);
  const days = monthDays(month, today).map((date) => {
    const r = byDate.get(date);
    const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    const status: Status | 'holiday' | 'not_marked' = r?.status ?? (onLeave(date) ? 'leave' : sunday ? 'holiday' : 'not_marked');
    return { date, status, checkIn: r?.checkIn ?? null, checkOut: r?.checkOut ?? null, source: r?.source ?? null, history: r?.history ?? [] };
  });
  const count = (s: string) => days.filter((d) => d.status === s).length;
  const present = count('present') + count('half_day') * 0.5;
  // % of recorded working days (unmarked days — e.g. before someone joined — are shown, not counted as absent)
  const working = count('present') + count('half_day') + count('absent');
  return { days, present: count('present'), halfDay: count('half_day'), absent: count('absent'), leave: count('leave'), notMarked: count('not_marked'), pct: working ? Math.round((present / working) * 100) : null };
}

/** The signed-in person's own month — never anyone else's. */
export const myAttendance = (user: Staff, month: string) => attendanceMonth(user.id, month);

export async function myLeave(user: Staff) {
  return (await leaveRequests.list(store(), { k1: user.id })).map((l) => ({ id: l.id, ...l.data, createdAt: l.createdAt })).sort((a, b) => b.from.localeCompare(a.from));
}

/** Principal / admin office: everyone's status for one day. */
export async function staffDay(actor: Staff, date: string) {
  if (!can(actor, 'staff.attendance')) throw new SchoolError('You do not have permission to do this.');
  const [staff, rows, leaves] = await Promise.all([getCrmRepo().listStaff(), staffAttendance.list(store(), { k2: date }), leaveRequests.list(store(), { k2: 'approved' })]);
  const byStaff = new Map(rows.map((r) => [r.data.staffId, r.data]));
  return staff
    .filter((s) => s.active)
    .map((s) => {
      const r = byStaff.get(s.id);
      const leave = leaves.some((l) => l.data.staffId === s.id && l.data.from <= date && date <= l.data.to);
      return { id: s.id, name: s.fullName, roles: s.roles, status: r?.status ?? (leave ? 'leave' : 'not_marked'), checkIn: r?.checkIn ?? null, checkOut: r?.checkOut ?? null, corrections: r?.history.filter((h) => h.by !== s.id).length ?? 0 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Principal / admin office mark or correct someone's day. A reason is required and kept. */
export async function markStaff(actor: Staff, staffId: string, date: string, status: string, reason: string) {
  if (!can(actor, 'staff.attendance')) throw new SchoolError('You do not have permission to do this.');
  if (!(STAFF_ATTENDANCE as readonly string[]).includes(status)) throw new SchoolError('Pick a status.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIST()) throw new SchoolError('Pick a date up to today.');
  if (reason.trim().length < 3) throw new SchoolError('Give a reason for the record.');
  const target = await getCrmRepo().getStaff(staffId);
  if (!target) throw new SchoolError('Staff member not found.');
  const cur = await rowFor(staffId, date);
  if (cur?.data.status === status) return;
  await staffAttendance.put(store(), { staffId, date, status, checkIn: cur?.data.checkIn ?? null, checkOut: cur?.data.checkOut ?? null, source: 'admin', markedBy: actor.id, history: [...(cur?.data.history ?? []), { at: new Date().toISOString(), by: actor.id, from: cur?.data.status ?? null, to: status, reason: reason.trim().slice(0, 300) }] }, cur?.id);
}

/** My profile: employment details, assigned subjects and classes from the timetable. */
export async function myProfile(user: Staff) {
  const [profile, periods, all] = await Promise.all([staffProfiles.list(store(), { k1: user.id }), timetable.list(store(), { k2: user.id }), batches.list(store())]);
  const names = new Map(all.map((b) => [b.id, b.data.name]));
  const classTeacherOf = all.filter((b) => b.data.classTeacherId === user.id).map((b) => b.data.name);
  return {
    profile: profile[0]?.data ?? null,
    subjects: [...new Set(periods.map((p) => p.data.subject))].sort(),
    classes: [...new Set(periods.map((p) => names.get(p.data.batchId) ?? 'Batch'))].sort(),
    classTeacherOf,
    periodsPerWeek: periods.length,
  };
}

export function attendanceCsv(name: string, month: string, m: Awaited<ReturnType<typeof attendanceMonth>>) {
  const esc = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""');
  const lines = [['Date', 'Status', 'Check in', 'Check out', 'Marked by'].join(','), ...m.days.map((d) => [d.date, d.status, d.checkIn ?? '', d.checkOut ?? '', d.source ?? ''].map((v) => `"${esc(v)}"`).join(','))];
  lines.push('', `"${esc(name)}","${month}","present ${m.present}","half days ${m.halfDay}","absent ${m.absent}","leave ${m.leave}","attendance ${m.pct ?? '-'}%"`);
  return lines.join('\r\n');
}
