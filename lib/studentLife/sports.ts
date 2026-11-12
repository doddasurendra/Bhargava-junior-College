import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { SchoolError, store, studentsById } from '../school/common';
import { achievements, fitnessChecks, fixtures, HOUSES, houses, sportsAttendance, sportsSignups, SPORTS } from './collections';

/** Sports & games: houses, fixtures, results, points table, attendance, fitness checks, achievements. */

const need = (user: Staff) => {
  if (!can(user, 'sports.manage')) throw new SchoolError('Only the Sports Coach can change sports records.');
};

/** Points per inter-house result. */
export const POINTS = { win: 3, draw: 1, loss: 0 } as const;
/** XP a student earns per games period attended (feeds the practice XP total). */
export const SPORTS_XP = 10;

export async function allHouses() {
  const rows = await houses.list(store());
  return HOUSES.map((h) => rows.find((r) => r.data.key === h.key) ?? null).filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function houseOf(studentId: string) {
  return (await allHouses()).find((h) => h.data.studentIds.includes(studentId))?.data ?? null;
}

export async function assignHouse(user: Staff, studentId: string, key: string) {
  need(user);
  for (const h of await allHouses()) {
    const has = h.data.studentIds.includes(studentId);
    if (h.data.key === key && !has) await houses.put(store(), { ...h.data, studentIds: [...h.data.studentIds, studentId] }, h.id);
    if (h.data.key !== key && has) await houses.put(store(), { ...h.data, studentIds: h.data.studentIds.filter((s) => s !== studentId) }, h.id);
  }
}

/** House points from played inter-house fixtures (and Sports Day). */
export function pointsTable(list: { kind: string; status: string; home: string; away: string; winner: 'home' | 'away' | 'draw' | null }[]) {
  const t = new Map<string, { house: string; played: number; won: number; drawn: number; lost: number; points: number }>(HOUSES.map((h) => [h.name, { house: h.name, played: 0, won: 0, drawn: 0, lost: 0, points: 0 }]));
  for (const f of list) {
    if (f.status !== 'played' || (f.kind !== 'inter_house' && f.kind !== 'sports_day') || !f.winner) continue;
    const home = t.get(f.home);
    const away = t.get(f.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    if (f.winner === 'draw') { home.drawn++; away.drawn++; home.points += POINTS.draw; away.points += POINTS.draw; }
    else { const [w, l] = f.winner === 'home' ? [home, away] : [away, home]; w.won++; l.lost++; w.points += POINTS.win; }
  }
  return [...t.values()].sort((a, b) => b.points - a.points || b.won - a.won || a.house.localeCompare(b.house));
}

export async function allFixtures() {
  return (await fixtures.list(store())).map((f) => ({ id: f.id, ...f.data })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function addFixture(user: Staff, input: { title: string; sport: string; kind: string; date: string; time: string | null; venue: string | null; home: string; away: string }) {
  need(user);
  if (input.home === input.away) throw new SchoolError('Pick two different teams.');
  return fixtures.put(store(), { ...input, status: 'scheduled', homeScore: null, awayScore: null, winner: null, teamIds: [], createdBy: user.id });
}

export async function recordResult(user: Staff, id: string, homeScore: string, awayScore: string, winner: 'home' | 'away' | 'draw') {
  need(user);
  const f = await fixtures.get(store(), id);
  if (!f) throw new SchoolError('Fixture not found.');
  await fixtures.put(store(), { ...f.data, status: 'played', homeScore, awayScore, winner }, id);
}

export async function markAttendance(user: Staff, date: string, sport: string, present: string[]) {
  need(user);
  if (date > todayIST()) throw new SchoolError('You can’t mark a future date.');
  const prev = (await sportsAttendance.list(store(), { k1: date, k2: sport }))[0];
  return sportsAttendance.put(store(), { date, sport, present, markedBy: user.id }, prev?.id);
}

/** Sessions attended in the last `days` (for participation %, XP, the mentor view and the weekly report). */
export async function participation(days = 30, today = todayIST()) {
  const rows = await sportsAttendance.list(store());
  const from = addDays(today, -days + 1);
  const count = new Map<string, number>();
  for (const r of rows) if (r.data.date >= from && r.data.date <= today) for (const s of r.data.present) count.set(s, (count.get(s) ?? 0) + 1);
  return count;
}

export async function participationPct(today = todayIST()) {
  const [count, byId] = await Promise.all([participation(7, today), studentsById()]);
  const n = byId.size;
  return n ? Math.round(([...byId.keys()].filter((id) => (count.get(id) ?? 0) > 0).length / n) * 100) : null;
}

export async function sportsXp(studentId: string) {
  const rows = await sportsAttendance.list(store());
  return rows.filter((r) => r.data.present.includes(studentId)).length * SPORTS_XP;
}

export async function addAchievement(user: Staff, input: { studentId: string; title: string; medal: string; event: string; date: string }) {
  need(user);
  return achievements.put(store(), { ...input, recordedBy: user.id });
}

export async function achievementsOf(studentId: string) {
  return (await achievements.list(store(), { k1: studentId })).map((a) => a.data).sort((a, b) => b.date.localeCompare(a.date));
}

export async function allAchievements() {
  const byId = await studentsById();
  return (await achievements.list(store())).map((a) => ({ id: a.id, ...a.data, name: byId.get(a.data.studentId)?.fullName ?? 'Student' })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function addFitness(user: Staff, input: { studentId: string; date: string; run600mSec: number | null; sitReachCm: number | null; bmi: number | null }) {
  need(user);
  return fitnessChecks.put(store(), { ...input, recordedBy: user.id });
}

export async function fitnessOf(studentId: string) {
  return (await fitnessChecks.list(store(), { k1: studentId })).map((f) => f.data).sort((a, b) => b.date.localeCompare(a.date));
}

export async function signUp(studentId: string, sport: string) {
  if (!(SPORTS as readonly string[]).includes(sport)) throw new SchoolError('Pick a sport from the list.');
  const has = (await sportsSignups.list(store(), { k1: studentId, k2: sport }))[0];
  if (has) await sportsSignups.remove(store(), has.id);
  else await sportsSignups.put(store(), { studentId, sport });
}

export async function signupsOf(studentId: string) {
  return (await sportsSignups.list(store(), { k1: studentId })).map((s) => s.data.sport);
}

/** Coach dashboard. */
export async function coachOverview(user: Staff, today = todayIST()) {
  if (!can(user, 'sports.manage') && !can(user, 'sports.view')) throw new SchoolError('You do not have permission to do this.');
  const [hs, fx, ach, byId, att, signups, count] = await Promise.all([allHouses(), allFixtures(), allAchievements(), studentsById(), sportsAttendance.list(store()), sportsSignups.list(store()), participation(30, today)]);
  const students = [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    houses: hs.map((h) => ({ id: h.id, ...h.data })),
    table: pointsTable(fx),
    upcoming: fx.filter((f) => f.status === 'scheduled' && f.date >= today),
    played: fx.filter((f) => f.status === 'played').reverse(),
    achievements: ach,
    attendance: att.map((a) => ({ id: a.id, ...a.data })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14),
    signups: SPORTS.map((s) => ({ sport: s, n: signups.filter((x) => x.data.sport === s).length })),
    neverPlayed: students.filter((s) => !count.get(s.id)).map((s) => ({ id: s.id, name: s.fullName })),
    students: students.map((s) => ({ id: s.id, name: s.fullName, collegeId: s.collegeId, house: hs.find((h) => h.data.studentIds.includes(s.id))?.data.name ?? null, sessions30: count.get(s.id) ?? 0 })),
  };
}

/** Student / parent app. */
export async function studentSports(studentId: string, today = todayIST()) {
  const [house, fx, ach, signups, fitness, count] = await Promise.all([houseOf(studentId), allFixtures(), achievementsOf(studentId), signupsOf(studentId), fitnessOf(studentId), participation(30, today)]);
  const mine = (f: { home: string; away: string; teamIds: string[] }) => (house && (f.home === house.name || f.away === house.name)) || f.teamIds.includes(studentId);
  return {
    house,
    table: pointsTable(fx),
    upcoming: fx.filter((f) => f.status === 'scheduled' && f.date >= today && (mine(f) || f.kind === 'sports_day' || f.kind === 'inter_college')).slice(0, 8),
    results: fx.filter((f) => f.status === 'played' && mine(f)).reverse().slice(0, 8),
    sportsDay: fx.find((f) => f.kind === 'sports_day' && f.date >= today) ?? null,
    achievements: ach,
    signups,
    fitness: fitness[0] ?? null,
    sessions30: count.get(studentId) ?? 0,
    xp: await sportsXp(studentId),
  };
}

/** For the college assistant and the weekly report. */
export async function sportsProfile(studentId: string, today = todayIST()) {
  const [house, ach, week] = await Promise.all([houseOf(studentId), achievementsOf(studentId), participation(7, today)]);
  return { house: house?.name ?? null, achievements: ach.map((a) => `${a.medal[0].toUpperCase()}${a.medal.slice(1)}, ${a.event}`), playedThisWeek: week.get(studentId) ?? 0 };
}
