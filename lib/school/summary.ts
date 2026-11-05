import 'server-only';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import { followUp } from '../crm/rules';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { schoolStats } from '../practice/service';
import { weekStart } from '../practice/logic';
import { attendance, doubts, studentLeave, tests } from '../records/collections';
import { duesList } from './accounts';
import { libraryOverview, listEvents } from './backoffice';
import { allStudents, store } from './common';

/**
 * Summary dashboard: one screen with today's numbers from every module, each linking to its detail page.
 * Each section appears only if the user's role may see it.
 */
export async function summary(user: Staff, today = todayIST()) {
  const ws = weekStart(today);
  const out: { area: string; href: string; tiles: { label: string; value: string; tone?: 'warn' | 'good' }[] }[] = [];

  if (can(user, 'lead.viewAll') || can(user, 'dashboard.view')) {
    const leads = await getCrmRepo().listLeads({});
    const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const open = leads.filter((l) => !['lost', 'admitted', 'invalid'].includes(l.status));
    const overdue = open.filter((l) => followUp(l).state === 'overdue').length;
    out.push({ area: 'Admissions', href: '/crm/dashboard', tiles: [
      { label: 'New leads today', value: String(leads.filter((l) => istDay(l.createdAt) === today).length) },
      { label: 'Open leads', value: String(open.length) },
      { label: 'Follow-ups overdue', value: String(overdue), tone: overdue ? 'warn' : 'good' },
      { label: 'Unqualified', value: String(open.filter((l) => !l.category).length) },
      { label: 'Confirmed / admitted', value: String(leads.filter((l) => l.status === 'confirmed' || l.status === 'admitted').length), tone: 'good' },
    ] });
  }

  if (can(user, 'fees.dues')) {
    const dues = await duesList(user, today);
    const overdueAmt = dues.reduce((t, d) => t + d.overdue, 0);
    out.push({ area: 'Fees', href: '/crm/accounts', tiles: [
      { label: 'Students with overdue fees', value: String(dues.filter((d) => d.overdue > 0).length), tone: overdueAmt ? 'warn' : 'good' },
      { label: 'Overdue amount', value: `₹${overdueAmt.toLocaleString('en-IN')}`, tone: overdueAmt ? 'warn' : 'good' },
      { label: 'Outstanding (all)', value: `₹${dues.reduce((t, d) => t + d.outstanding, 0).toLocaleString('en-IN')}` },
    ] });
  }

  if (can(user, 'students.view') || can(user, 'academics.view')) {
    const [students, regs, testList, openDoubts, leave] = await Promise.all([
      allStudents(),
      attendance.list(store(), { k2From: today, k2To: today }),
      tests.list(store()),
      doubts.list(store()),
      studentLeave.list(store()),
    ]);
    let present = 0;
    let marked = 0;
    for (const r of regs) for (const m of Object.values(r.data.marks)) {
      marked++;
      if (m === 'present' || m === 'late') present++;
    }
    out.push({ area: 'Academics', href: '/crm/academics/overview', tiles: [
      { label: 'Students', value: String(students.length) },
      { label: 'Attendance today', value: marked ? `${Math.round((present / marked) * 100)}%` : 'not marked', tone: marked && present / marked < 0.75 ? 'warn' : undefined },
      { label: 'Exams this week', value: String(testList.filter((t) => t.data.date >= ws && t.data.date <= today).length) },
      { label: 'Open doubts', value: String(openDoubts.filter((d) => d.data.status === 'open').length), tone: openDoubts.some((d) => d.data.status === 'open') ? 'warn' : 'good' },
      { label: 'Leave requests pending', value: String(leave.filter((l) => l.data.status === 'pending').length) },
    ] });
    if (can(user, 'academics.view') || can(user, 'dashboard.view')) {
      const p = await schoolStats(user, today);
      out.push({ area: 'Practice', href: '/crm/practice', tiles: [
        { label: 'Questions answered', value: String(p.questions) },
        { label: 'Accuracy', value: p.accuracy === null ? '–' : `${p.accuracy}%` },
        { label: 'Students active this week', value: String(p.activeThisWeek) },
      ] });
    }
    const lib = await libraryOverview(user, today);
    out.push({ area: 'Library', href: '/crm/library', tiles: [
      { label: 'Books on loan', value: String(lib.out.length) },
      { label: 'Overdue', value: String(lib.out.filter((l) => l.late > 0).length), tone: lib.out.some((l) => l.late > 0) ? 'warn' : 'good' },
    ] });
  }

  const ev = (await listEvents(today)).upcoming.slice(0, 5);
  return { sections: out, events: ev };
}
