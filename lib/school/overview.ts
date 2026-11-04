import 'server-only';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { attendance, discipline, leaveRequests, testResults, tests, timetable, wellbeing } from '../records/collections';
import { allBatches, SchoolError, store } from './common';
import { attendanceSummary } from './logic';

/** §9A.2 row 3: attendance across batches, test performance, weak-batch alerts, faculty workload, wellbeing alerts. */
export async function academicOverview(user: Staff, today = todayIST()) {
  if (!can(user, 'academics.view')) throw new SchoolError('You do not have permission to do this.');
  const from = addDays(today, -30);
  const [list, periods, staff, checks, leaves, disc] = await Promise.all([allBatches(), timetable.list(store()), getCrmRepo().listStaff(), wellbeing.list(store(), { k2: today.slice(0, 7) }), leaveRequests.list(store(), { k2: 'pending' }), discipline.list(store(), { k2From: from, k2To: today })]);
  const rows = [];
  for (const b of list.filter((x) => x.data.active)) {
    const regs = (await attendance.list(store(), { k1: b.id, k2From: from, k2To: today })).map((r) => r.data);
    const pcts = b.data.studentIds.map((s) => attendanceSummary(regs, s).pct).filter((x): x is number => x !== null);
    const att = pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : null;
    const bt = (await tests.list(store(), { k1: b.id })).filter((t) => t.data.published).sort((a, c) => c.data.date.localeCompare(a.data.date)).slice(0, 3);
    const scores: number[] = [];
    for (const t of bt) for (const r of await testResults.list(store(), { k1: t.id })) if (r.data.submittedAt && r.data.max) scores.push((r.data.score / r.data.max) * 100);
    const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null;
    const alerts: string[] = [];
    if (att !== null && att < 85) alerts.push(`attendance ${att}%`);
    if (avg !== null && avg < 50) alerts.push(`average test score ${avg}%`);
    rows.push({ id: b.id, name: b.data.name, program: b.data.program, students: b.data.studentIds.length, capacity: b.data.capacity, attendance: att, recentAvg: avg, registers: regs.length, alerts });
  }
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const load = new Map<string, number>();
  for (const p of periods) load.set(p.data.facultyId, (load.get(p.data.facultyId) ?? 0) + 1);
  const workload = [...load].map(([id, n]) => ({ id, name: names.get(id) ?? 'Staff', periods: n })).sort((a, b) => b.periods - a.periods);
  return {
    batches: rows,
    workload,
    wellbeingAlerts: checks.filter((c) => c.data.stress <= 2).length,
    pendingLeave: leaves.map((l) => ({ id: l.id, ...l.data, name: names.get(l.data.staffId) ?? 'Staff' })),
    disciplineCount: disc.length,
  };
}
