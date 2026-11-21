import 'server-only';
import { getCrmRepo } from '../crm/repo';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { getRecordStore } from '../records';
import { alumni, campusPreferences, CAMPUS_VALUES, doubts, staffProfiles, syllabusProgress, testResults, tests } from '../records/collections';
import { studentResults } from '../school/academics';
import { libraryOverview, listEvents } from '../school/backoffice';
import { allBatches, allStudents, batchOf, studentsById, visibleStudentIds } from '../school/common';
import { summary } from '../school/summary';
import { studentProfile } from '../staffAssistant/service';
import { weakChapters } from '../staffAssistant/insights';
import { DEPARTMENTS, type DepartmentId } from './centres';
import { deptRequests, kbGrievances, licences } from './collections';

/**
 * Live data for the centres (§0.2): shown from the existing modules, never copied into the KB. Each block is
 * built only when the user's permissions allow its source, using the same scoping as those modules.
 */
export interface Tile {
  label: string;
  value: string;
  href?: string;
  tone?: 'warn' | 'good';
}
export interface Table {
  title: string;
  headers: string[];
  rows: { cells: string[]; href?: string }[];
  note?: string;
}
export interface Live {
  tiles: Tile[];
  tables: Table[];
}

const st = () => getRecordStore();
const CAMPUS_LABEL: Record<string, string> = { girls_bairamalguda: 'Girls · Bairamalguda', boys_kuntloor: 'Boys · Kuntloor', day_lb_nagar: 'Day scholar · LB Nagar' };

async function summaryTiles(user: Staff): Promise<Tile[]> {
  const s = await summary(user);
  return s.sections.flatMap((sec) => sec.tiles.slice(0, 3).map((t) => ({ label: `${sec.area}: ${t.label}`, value: t.value, href: sec.href, tone: t.tone })));
}

/** Strength by program, batch and campus; campus comparison (§9). */
async function strength(): Promise<Table[]> {
  const [students, batches, prefs] = await Promise.all([allStudents(), allBatches(), campusPreferences.list(st())]);
  const campusOfLead = new Map(prefs.map((p) => [p.data.leadId, p.data.campus]));
  const byProgram = new Map<string, number>();
  const byCampus = new Map<string, number>();
  for (const s of students) {
    byProgram.set(s.program, (byProgram.get(s.program) ?? 0) + 1);
    const c = campusOfLead.get(s.leadId) ?? (s.stay === 'hostel' ? 'hostel (campus not recorded)' : 'day_lb_nagar');
    byCampus.set(c, (byCampus.get(c) ?? 0) + 1);
  }
  const results = await Promise.all(batches.map(async (b) => {
    const ts = (await tests.list(st(), { k1: b.id })).filter((t) => t.data.published);
    const pcts: number[] = [];
    for (const t of ts) for (const r of await testResults.list(st(), { k1: t.id })) if (r.data.max) pcts.push((r.data.score / r.data.max) * 100);
    return { b, avg: pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : null };
  }));
  return [
    { title: 'Students by program', headers: ['Program', 'Students'], rows: [...byProgram.entries()].map(([p, n]) => ({ cells: [p, String(n)] })) },
    { title: 'Students by batch (with average test %)', headers: ['Batch', 'Students', 'Avg %'], rows: results.map(({ b, avg }) => ({ cells: [b.data.name, String(b.data.studentIds.length), avg === null ? '–' : `${avg}%`], href: '/crm/academics' })) },
    { title: 'Campus comparison', headers: ['Campus', 'Students'], rows: [...CAMPUS_VALUES, ...[...byCampus.keys()].filter((k) => !(CAMPUS_VALUES as readonly string[]).includes(k))].map((c) => ({ cells: [CAMPUS_LABEL[c] ?? c, String(byCampus.get(c) ?? 0)] })), note: 'Campus comes from the campus preference recorded at the visit / in the CRM.' },
  ];
}

/** Subject performance for a department: average % in that subject across published tests (§7). */
async function subjectPerformance(dept: DepartmentId): Promise<Table> {
  const subjects = DEPARTMENTS.find((d) => d.id === dept)!.subjects as readonly string[];
  const batches = await allBatches();
  const rows: Table['rows'] = [];
  for (const b of batches) {
    const ts = (await tests.list(st(), { k1: b.id })).filter((t) => t.data.published);
    const pcts: number[] = [];
    const chapters = new Map<string, { right: number; total: number }>();
    for (const t of ts) {
      const n = t.data.subjects.filter((s) => subjects.some((x) => s.toLowerCase().includes(x.toLowerCase()))).length;
      if (!n) continue;
      const perSubject = t.data.maxMarks / t.data.subjects.length;
      for (const r of await testResults.list(st(), { k1: t.id })) {
        for (const [s, v] of Object.entries(r.data.bySubject)) if (subjects.some((x) => s.toLowerCase().includes(x.toLowerCase()))) pcts.push((v / perSubject) * 100);
        for (const [ch, c] of Object.entries(r.data.byChapter)) {
          const cur = chapters.get(ch) ?? { right: 0, total: 0 };
          chapters.set(ch, { right: cur.right + c.right, total: cur.total + c.right + c.wrong + c.skipped });
        }
      }
    }
    const weakest = [...chapters.entries()].filter(([, c]) => c.total >= 3).sort((a, c) => a[1].right / a[1].total - c[1].right / c[1].total).slice(0, 2).map(([ch, c]) => `${ch} ${Math.round((c.right / c.total) * 100)}%`);
    if (pcts.length) rows.push({ cells: [b.data.name, `${Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length)}%`, String(pcts.length), weakest.join(', ') || '–'], href: '/crm/academics/overview' });
  }
  return { title: 'Subject performance by batch', headers: ['Batch', 'Avg %', 'Scores', 'Weakest chapters'], rows, note: 'From published tests (subject-wise marks and chapter-wise answers).' };
}

export async function liveFor(user: Staff, centre: string, opts: { dept?: DepartmentId | null; student?: string | null } = {}): Promise<Live> {
  const tiles: Tile[] = [];
  const tables: Table[] = [];
  const today = todayIST();
  switch (centre) {
    case 'student':
    case 'exams': {
      const vis = await visibleStudentIds(user);
      const batches = (await allBatches()).filter((b) => vis === 'all' || b.data.studentIds.some((s) => vis.has(s)));
      const up = (await Promise.all(batches.map(async (b) => (await tests.list(st(), { k1: b.id })).filter((t) => t.data.date >= today).map((t) => ({ t, b }))))).flat().sort((a, c) => a.t.data.date.localeCompare(c.t.data.date));
      const published = (await Promise.all(batches.map(async (b) => (await tests.list(st(), { k1: b.id })).filter((t) => t.data.published).length))).reduce((a, n) => a + n, 0);
      tiles.push({ label: 'Upcoming tests', value: String(up.length), href: '/crm/academics' }, { label: 'Published results', value: String(published), href: '/crm/academics/overview' });
      if (centre === 'student' && can(user, 'doubts.answer')) tiles.push({ label: 'Open doubts', value: String((await doubts.list(st())).filter((d) => d.data.status === 'open').length), href: '/crm/academics/my-classes' });
      tables.push({ title: 'Exam timetable (next 10)', headers: ['Date', 'Test', 'Batch', 'Mode'], rows: up.slice(0, 10).map(({ t, b }) => ({ cells: [t.data.date, t.data.title, b.data.name, t.data.mode] })) });
      break;
    }
    case 'student360': {
      if (!can(user, 'students.view')) break;
      const [byId, vis] = await Promise.all([studentsById(), visibleStudentIds(user)]);
      const list = [...byId.values()].filter((s) => vis === 'all' || vis.has(s.id));
      tiles.push({ label: 'Students you can see', value: String(list.length), href: '/crm/students' });
      const s = opts.student ? list.find((x) => x.id === opts.student) : null;
      if (s) {
        const p = await studentProfile(user, s);
        const res = await studentResults(s.id);
        const pcts = res.map((r) => r.pct);
        const ranks = res.map((r) => (r.of ? Math.round((r.rank / r.of) * 100) : null)).filter((x): x is number => x !== null);
        const readiness = pcts.length ? (pcts.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, pcts.length) >= 70 ? 'On track' : pcts.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, pcts.length) >= 50 ? 'Building' : 'Needs support') : 'No tests yet';
        tiles.push({ label: 'Attendance (30 days)', value: p.attendance.pct === null ? '–' : `${p.attendance.pct}%`, tone: p.attendance.pct !== null && p.attendance.pct < 75 ? 'warn' : undefined }, { label: 'Test trend', value: p.trend === null ? '–' : `${p.trend >= 0 ? '+' : ''}${p.trend} pts` }, { label: 'JEE/NEET readiness band', value: readiness }, { label: 'Latest rank percentile', value: ranks.length ? `top ${ranks[ranks.length - 1]}%` : '–' });
        if (p.fees) tiles.push({ label: 'Fees outstanding', value: p.fees.outstanding === null ? '–' : `₹${p.fees.outstanding.toLocaleString('en-IN')}`, tone: p.fees.overdue ? 'warn' : 'good' });
        tables.push({ title: `${p.name} · ${p.collegeId ?? ''} · ${p.batch ?? 'no batch'}`, headers: ['Item', 'Value'], rows: [
          { cells: ['Program', p.program] }, { cells: ['Previous school / board', `${p.previousSchool ?? '–'} / ${p.board ?? '–'}`] }, { cells: ['SSC marks', p.sscMarks ?? 'not recorded'] }, { cells: ['Stay', `${p.stay}${p.hostelRoom ? ` · room ${p.hostelRoom}` : ''}${p.bus ? ` · bus ${p.bus}` : ''}`] },
          { cells: ['Sports / house', `${p.house ?? '–'}${p.sportsAchievements.length ? ` · ${p.sportsAchievements.join(', ')}` : ''}`] }, { cells: ['Workshops & sessions attended', p.sessionsAttended.join(', ') || '–'] }, { cells: ['Warnings', p.warnings.join('; ') || 'none'] },
          { cells: ['Mentor notes (latest)', p.mentorNotes.map((n) => `${n.date}: ${n.note}`).join(' · ') || '–'] },
        ], note: 'Live from Students, Attendance, Tests, Fees, Sports and Mentoring.' });
        tables.push({ title: 'Test scores', headers: ['Test', 'Date', 'Score', '%', 'Rank'], rows: p.tests.map((x) => ({ cells: [x.title, x.date, `${x.score}/${x.max}`, `${x.pct}%`, `${x.rank}/${x.of}`] })) });
        const weak = weakChapters(res);
        // per-subject max = test max split evenly across the subjects it covered
        const subjectsLow = [...new Set(res.flatMap((r) => {
          const n = Object.keys(r.bySubject).length;
          return n ? Object.entries(r.bySubject).filter(([, v]) => (v / (r.max / n)) * 100 < 40).map(([sub]) => sub) : [];
        }))];
        tables.push({ title: 'Subjects needing improvement & AI recommendations', headers: ['Area', 'Recommendation'], rows: [
          ...subjectsLow.map((sub) => ({ cells: [sub, 'Below 40% in a test: schedule a doubt session and a supplementary-style revision plan'] })),
          ...weak.slice(0, 5).map((w) => ({ cells: [`${w.chapter}`, `Weak chapter (${w.accuracy}% right): assign the chapter DPP and 20 practice questions; review in the next mentor one-to-one`], href: '/crm/practice' })),
          ...(p.attendance.pct !== null && p.attendance.pct < 75 ? [{ cells: ['Attendance', 'Below 75%: call the parent and agree a plan (TSBIE minimum attendance applies)'] }] : []),
        ], note: 'Recommendations are rules on the live numbers above (weak chapters, low subjects, attendance), not predictions.' });
      } else {
        tables.push({ title: 'Choose a student', headers: ['Student', 'College ID', 'Program'], rows: list.slice(0, 60).map((x) => ({ cells: [x.fullName, x.collegeId ?? '', x.program], href: `/crm/knowledge/centres/student360?student=${x.id}` })), note: list.length > 60 ? `Showing 60 of ${list.length}: open Students for the full list.` : undefined });
      }
      break;
    }
    case 'parent': {
      if (can(user, 'ptm.manage') || can(user, 'messages.reply')) tiles.push({ label: 'Parent messages & PTMs', value: 'open', href: '/crm/mentor' });
      const ev = (await listEvents(today)).upcoming.filter((e) => e.audience === 'all' || e.audience === 'parents').slice(0, 8);
      tables.push({ title: 'Upcoming for parents', headers: ['Date', 'Event', 'Kind'], rows: ev.map((e) => ({ cells: [e.date, e.title, e.kind] })) });
      break;
    }
    case 'faculty': {
      const profiles = await staffProfiles.list(st());
      tiles.push({ label: 'Staff with profiles', value: String(profiles.length), href: can(user, 'staff.records') ? '/crm/staff-directory' : undefined });
      const mine = (await allBatches()).filter((b) => b.data.classTeacherId === user.id);
      if (mine.length) tiles.push({ label: 'Batches you class-teach', value: String(mine.length), href: '/crm/academics/my-classes' });
      const prog = await syllabusProgress.list(st());
      const done = prog.filter((p) => p.data.status === 'done').length;
      tiles.push({ label: 'Syllabus chapters done (all batches)', value: prog.length ? `${done}/${prog.length} (${Math.round((done / prog.length) * 100)}%)` : '–', href: '/crm/syllabus' });
      break;
    }
    case 'departments': {
      const dept = opts.dept ?? 'physics';
      const [profiles, items] = await Promise.all([staffProfiles.list(st()), deptRequests.list(st(), { k1: dept })]);
      const staff = new Map((await getCrmRepo().listStaff()).map((s) => [s.id, s]));
      const subjects = DEPARTMENTS.find((d) => d.id === dept)!.subjects as readonly string[];
      const faculty = profiles.filter((p) => subjects.some((s) => p.data.department.toLowerCase().includes(s.toLowerCase())));
      tables.push({ title: 'Faculty in this department', headers: ['Name', 'Designation', 'Employee ID'], rows: faculty.map((f) => ({ cells: [staff.get(f.data.staffId)?.fullName ?? f.data.staffId, f.data.designation, f.data.employeeId] })), note: faculty.length ? undefined : 'No staff profile lists this department yet (Staff records → department).' });
      if (can(user, 'academics.view') || can(user, 'tests.manage')) tables.push(await subjectPerformance(dept));
      const eq = items.filter((i) => i.data.kind === 'equipment');
      tables.push({ title: 'Lab equipment inventory', headers: ['Item', 'Qty', 'Condition'], rows: eq.map((i) => ({ cells: [i.data.item, String(i.data.qty), i.data.condition.replace('_', ' ')] })) });
      tables.push({ title: 'Purchase & expense requests', headers: ['Item', 'Qty', 'Amount', 'Status'], rows: items.filter((i) => i.data.kind !== 'equipment').map((i) => ({ cells: [i.data.item, String(i.data.qty), i.data.amount ? `₹${i.data.amount.toLocaleString('en-IN')}` : '–', i.data.status] })) });
      break;
    }
    case 'principal': {
      if (can(user, 'dashboard.view') || can(user, 'academics.view')) tiles.push(...(await summaryTiles(user)));
      const g = await kbGrievances.list(st());
      tiles.push({ label: 'Open grievances', value: String(g.filter((x) => x.data.status !== 'resolved').length), href: '/crm/knowledge/grievances', tone: g.some((x) => x.data.status === 'open') ? 'warn' : 'good' });
      break;
    }
    case 'management': {
      if (can(user, 'dashboard.view')) tiles.push(...(await summaryTiles(user)));
      if (can(user, 'students.view') || can(user, 'dashboard.view')) tables.push(...(await strength()));
      break;
    }
    case 'admission': {
      if (can(user, 'lead.viewAll') || can(user, 'dashboard.view')) {
        const leads = await getCrmRepo().listLeads({});
        const by = (s: string) => leads.filter((l) => l.status === s).length;
        tiles.push({ label: 'Open leads', value: String(leads.filter((l) => !['lost', 'admitted', 'invalid'].includes(l.status)).length), href: '/crm/leads' }, { label: 'Visits scheduled', value: String(by('visit_scheduled')), href: '/crm/visits' }, { label: 'Counselled', value: String(by('counselled')) }, { label: 'Admitted', value: String(by('admitted')), tone: 'good' });
      }
      break;
    }
    case 'career': {
      const al = (await alumni.list(st())).filter((a) => a.data.approved);
      tiles.push({ label: 'Alumni in the network', value: String(al.length), href: can(user, 'alumni.manage') ? '/crm/alumni' : undefined }, { label: 'Willing to mentor', value: String(al.filter((a) => a.data.mentorWilling).length) });
      tables.push({ title: 'Where alumni are now', headers: ['Name', 'Passed out', 'Now at', 'Course'], rows: al.filter((a) => a.data.nowAt).slice(0, 20).map((a) => ({ cells: [a.data.name, String(a.data.passedOut), a.data.nowAt ?? '', a.data.course ?? ''] })) });
      break;
    }
    case 'library': {
      if (can(user, 'library.manage') || can(user, 'students.view')) {
        const l = await libraryOverview(user, today);
        tiles.push({ label: 'Titles', value: String(l.books.length), href: '/crm/library' }, { label: 'On loan', value: String(l.out.length) }, { label: 'Overdue', value: String(l.out.filter((x) => x.late > 0).length), tone: l.out.some((x) => x.late > 0) ? 'warn' : 'good' });
      }
      break;
    }
    case 'admin_ops':
    case 'compliance': {
      const lic = (await licences.list(st())).map((r) => r.data).sort((a, b) => a.validTo.localeCompare(b.validTo));
      const soon = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
      tiles.push({ label: 'Licences / NOCs', value: String(lic.length) }, { label: 'Expiring in 60 days', value: String(lic.filter((l) => l.validTo <= soon).length), tone: lic.some((l) => l.validTo <= soon) ? 'warn' : 'good' });
      if (centre === 'compliance') tiles.push({ label: 'TSBIE College Code', value: '58560' });
      tables.push({ title: 'Licences & NOCs (renewal reminders 60 days before expiry)', headers: ['Name', 'Campus', 'Kind', 'Number', 'Valid to'], rows: lic.map((l) => ({ cells: [`${l.name}${l.sample ? ' (sample)' : ''}`, CAMPUS_LABEL[l.campus] ?? l.campus, l.kind, l.number ?? '–', `${l.validTo}${l.validTo < today ? ' (EXPIRED)' : l.validTo <= soon ? ' (soon)' : ''}`] })) });
      if (centre === 'admin_ops' && (can(user, 'hostel.view') || can(user, 'transport.view'))) tiles.push({ label: 'Hostel board', value: 'open', href: '/crm/hostel' }, { label: 'Transport', value: 'open', href: '/crm/transport' });
      break;
    }
    case 'events': {
      const ev = (await listEvents(today)).upcoming.slice(0, 12);
      tables.push({ title: 'Upcoming events', headers: ['Date', 'Event', 'Kind', 'For'], rows: ev.map((e) => ({ cells: [e.date, e.title, e.kind, e.audience] })) });
      tiles.push({ label: 'Upcoming events', value: String(ev.length), href: '/crm/events' }, { label: 'Sports', value: 'open', href: '/crm/sports' }, { label: 'Speaker sessions', value: 'open', href: '/crm/sessions' });
      break;
    }
  }
  return { tiles, tables };
}

/** The family's own child (app): a compact version of the same live data. */
export async function familyLive(studentId: string) {
  const [res, b] = await Promise.all([studentResults(studentId), batchOf(studentId)]);
  const up = b ? (await tests.list(st(), { k1: b.id })).filter((t) => t.data.date >= todayIST()).sort((a, c) => a.data.date.localeCompare(c.data.date)).slice(0, 5) : [];
  return { batch: b?.data.name ?? null, recent: res.slice(-5).reverse().map((r) => ({ title: r.test.title, date: r.test.date, pct: Math.round(r.pct), rank: `${r.rank}/${r.of}` })), upcoming: up.map((t) => ({ title: t.data.title, date: t.data.date })) };
}
