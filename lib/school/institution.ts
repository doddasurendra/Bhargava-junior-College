import 'server-only';
import { programs as PROGRAMS } from '@/content/programs';
import { canSeeMarketing, marketingAnalytics } from '../crm/marketingAnalytics';
import { can } from '../crm/permissions';
import { getCrmRepo } from '../crm/repo';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { getAppStore } from '../app/service';
import { kbArticles, kbFiles } from '../kb/collections';
import { obBooks, obPapers, obPosts, obQuestions, obReading } from '../openbook/collections';
import { examsOverview } from '../openbook/closedExam';
import { attendanceCorrections, buses, doubts, events, homework, hostelRooms, libraryBooks, notices, pendingSignups, staffAttendance, studentCredentials, studentLeave, tests, testResults, timetable } from '../records/collections';
import { duesList } from './accounts';
import { attendanceAnalytics } from './attendanceTools';
import { allBatches, store } from './common';
import { subjectComparison } from './performance';
import { testStudentIds } from '../app/pendingAdmin';
import { participationPct } from '../studentLife/sports';
import { allSessions } from '../studentLife/sessions';

/**
 * Institution-wide Summary dashboard (master prompt task 1.2). Every figure is counted from the college database
 * at request time; test-marked students are left out; a section appears only for roles allowed to see it.
 */
export const canSeeInstitution = (u: Staff) => can(u, 'dashboard.view') || u.roles.includes('super_admin') || u.roles.includes('principal');

const TEACHING = ['faculty', 'class_teacher', 'academic_coordinator'];
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch((e) => { console.error('[institution] section failed', (e as Error).message); return fallback; });

export function academicYear(today = todayIST()) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const start = m >= 6 ? y : y - 1;
  return { from: `${start}-06-01`, to: today < `${start + 1}-05-31` ? today : `${start + 1}-05-31`, label: `${start}-${String(start + 1).slice(2)}` };
}

export async function institution(user: Staff, f: { from: string; to: string }, today = todayIST()) {
  if (!canSeeInstitution(user)) throw new Error('not permitted');
  const repo = getCrmRepo();
  const app = getAppStore();
  const [studentsAll, testIds, staffAll, batchList, creds, pend] = await Promise.all([app.listStudents(), testStudentIds(), repo.listAllStaff(), allBatches(), studentCredentials.list(store()), pendingSignups.list(store())]);
  const students = studentsAll.filter((s) => !testIds.has(s.id));
  const real = new Set(students.map((s) => s.id));
  const guardians = new Set<string>();
  for (const s of students) for (const g of await app.guardiansOf(s.id)) guardians.add(g.phone);
  const staff = staffAll.filter((s) => s.active);
  const teachers = staff.filter((s) => s.roles.some((r) => TEACHING.includes(r)));
  const roleCount = new Map<string, number>();
  for (const s of staff) for (const r of s.roles) roleCount.set(r, (roleCount.get(r) ?? 0) + 1);

  const [testList, results, tt, ttStaff, busList, rooms, books, papers, questions, posts, reading, articles, files, noticeList, eventList, doubtList, leave, corrections, hw, libBooks, staffAtt] = await Promise.all([
    tests.list(store()), testResults.list(store()), timetable.list(store()), Promise.resolve(null), buses.list(store()), hostelRooms.list(store()),
    obBooks.list(store()), obPapers.list(store()), obQuestions.list(store()), obPosts.list(store()), obReading.list(store()), kbArticles.list(store()), kbFiles.list(store()),
    notices.list(store()), events.list(store()), doubts.list(store()), studentLeave.list(store()), attendanceCorrections.list(store()), homework.list(store()), libraryBooks.list(store()), staffAttendance.list(store(), { k1: undefined }),
  ]);
  void ttStaff;
  const inRange = (d: string | null | undefined) => !!d && d.slice(0, 10) >= f.from && d.slice(0, 10) <= f.to;
  const studentCreds = creds.filter((c) => !c.data.isTest);

  // ------------------------------------------------ A. overall
  const overall = {
    students: students.length,
    teachers: teachers.length,
    staff: staff.length,
    staffInactive: staffAll.length - staff.length,
    parents: guardians.size,
    programs: PROGRAMS.length,
    batches: batchList.filter((b) => b.data.active).length,
    subjects: new Set(tt.map((t) => t.data.subject)).size,
    exams: testList.length,
    studyMaterials: books.length + papers.length,
    hostel: students.filter((s) => s.stay === 'hostel').length,
    transport: new Set(busList.flatMap((b) => b.data.studentIds).filter((id) => real.has(id))).size,
    accountsActive: studentCreds.filter((c) => c.data.status === 'active' && !c.data.pendingId).length,
    accountsInactive: studentCreds.filter((c) => c.data.status !== 'active').length,
    accountsPending: pend.filter((p) => p.data.status === 'pending' && !p.data.isTest).length,
  };

  // ------------------------------------------------ B. academics
  const byProgram = PROGRAMS.map((p) => ({ label: p.name, value: students.filter((s) => s.program === p.slug).length }));
  const groups = [
    { label: 'MPC (JEE / IIT preparation)', value: students.filter((s) => s.program === 'iit-jee' || s.program === 'long-term-jee').length },
    { label: 'BiPC (NEET preparation)', value: students.filter((s) => s.program === 'neet' || s.program === 'long-term-neet').length },
  ];
  const years = [1, 2].map((y) => ({ label: `Intermediate ${y === 1 ? '1st' : '2nd'} year`, value: batchList.filter((b) => b.data.active && b.data.year === y).reduce((n, b) => n + b.data.studentIds.filter((id) => real.has(id)).length, 0) }));
  const att = await safe(attendanceAnalytics(user, { from: f.from, to: f.to, threshold: 75 }), null);
  const subjects = await safe(subjectComparison(user), [] as Awaited<ReturnType<typeof subjectComparison>>);
  const mocks = await safe(examsOverview(user), [] as Awaited<ReturnType<typeof examsOverview>>);
  const testsInRange = testList.filter((t) => inRange(t.data.date));
  const resInRange = results.filter((r) => r.data.submittedAt && testsInRange.some((t) => t.id === r.data.testId) && real.has(r.data.studentId));
  const avgScore = resInRange.length ? Math.round((resInRange.reduce((n, r) => n + (r.data.max ? (r.data.score / r.data.max) * 100 : 0), 0) / resInRange.length) * 10) / 10 : null;
  const academics = { byProgram, groups, years, attendance: att, subjects, mocks, examsInRange: testsInRange.length, resultsInRange: resInRange.length, avgScore };

  // ------------------------------------------------ C. admissions
  let admissions: null | (Awaited<ReturnType<typeof marketingAnalytics>> & { docsPending: number; counselled: number }) = null;
  if (canSeeMarketing(user)) {
    const m = await safe(marketingAnalytics(user, { from: f.from, to: f.to }), null);
    if (m) {
      const leads = await repo.listLeads({});
      const stageIdx = (s: string) => ['enquiry', 'visit', 'counselling', 'application', 'documents', 'fee', 'receipt', 'student_record', 'college_id'].indexOf(s);
      admissions = {
        ...m,
        docsPending: leads.filter((l) => (l.status === 'confirmed' || stageIdx(l.stage) === 3) && stageIdx(l.stage) < 4).length,
        counselled: leads.filter((l) => stageIdx(l.stage) >= 2 && inRange(l.createdAt)).length,
      };
    }
  }

  // ------------------------------------------------ D. students & parents
  const studentsSection = {
    notices: noticeList.filter((n) => inRange(n.data.date)).length,
    announcementsAll: noticeList.filter((n) => n.data.audience === 'all' || n.data.audience === 'students' || n.data.audience === 'parents').length,
    doubtsOpen: doubtList.filter((d) => d.data.status === 'open').length,
    doubtsInRange: doubtList.filter((d) => inRange((d as { createdAt?: string }).createdAt)).length,
    leavePending: leave.filter((l) => l.data.status === 'pending').length,
    belowAttendance: att?.below.length ?? null,
  };

  // ------------------------------------------------ E. staff & management
  const todayAtt = staffAtt.filter((a) => a.data.date === today);
  const staffSection = {
    teachers: teachers.length,
    departments: [...roleCount].map(([role, n]) => ({ role, n })).sort((a, b) => b.n - a.n),
    presentToday: todayAtt.filter((a) => a.data.status === 'present' || a.data.status === 'half_day').length,
    markedToday: todayAtt.length,
    classTeachers: batchList.filter((b) => b.data.active && b.data.classTeacherId).length,
    batchesWithoutClassTeacher: batchList.filter((b) => b.data.active && !b.data.classTeacherId).length,
    approvals: { leave: studentsSection.leavePending, attendanceCorrections: corrections.filter((c) => c.data.status === 'pending').length, signups: overall.accountsPending },
    homeworkInRange: hw.filter((h) => inRange(h.data.setOn)).length,
  };

  // ------------------------------------------------ F. fees (finance roles only)
  let fees: null | { collected: number; payments: number; outstanding: number; overdue: number; studentsOverdue: number; monthly: { date: string; amount: number }[] } = null;
  if (can(user, 'fees.dues')) {
    const ay = academicYear(today);
    const [dues, exp] = await Promise.all([safe(duesList(user, today), []), repo.exportForMetrics(new Date(`${ay.from}T00:00:00+05:30`).toISOString())]);
    const pays = exp.payments.filter((p) => inRange(p.approvedAt));
    const months = new Map<string, number>();
    for (const p of pays) months.set(p.approvedAt.slice(0, 7), (months.get(p.approvedAt.slice(0, 7)) ?? 0) + p.amount);
    fees = {
      collected: pays.reduce((n, p) => n + p.amount, 0), payments: pays.length,
      outstanding: dues.reduce((n, d) => n + d.outstanding, 0), overdue: dues.reduce((n, d) => n + d.overdue, 0), studentsOverdue: dues.filter((d) => d.overdue > 0).length,
      monthly: [...months].sort().map(([m, amount]) => ({ date: `${m}-01`, amount })),
    };
  }

  // ------------------------------------------------ G. Open Book & knowledge base
  const qStatus = (q: (typeof questions)[number]) => String((q.data as { status?: string }).status ?? '');
  const openBook = {
    books: books.length,
    booksByCategory: [...books.reduce((m, b) => m.set(b.data.category, (m.get(b.data.category) ?? 0) + 1), new Map<string, number>())].map(([label, value]) => ({ label, value })),
    papers: papers.length,
    jeeNeet: books.filter((b) => b.data.examIds.some((e) => /jee|neet/.test(e))).length + papers.filter((p) => /jee|neet/.test(p.data.examId)).length,
    questionsShared: questions.filter((q) => !q.data.ownerId).length,
    questionsAi: questions.filter((q) => (q.data as { ai?: boolean }).ai).length,
    questionsStudent: questions.filter((q) => q.data.origin === 'community' || q.data.origin === 'scan').length,
    questionsPendingReview: questions.filter((q) => qStatus(q) === 'pending').length,
    communityPosts: posts.length,
    readers: new Set(reading.map((r) => r.data.studentId)).size,
    readingHours: Math.round(reading.reduce((n, r) => n + r.data.seconds, 0) / 360) / 10,
    kbArticles: articles.filter((a) => String((a.data as { status?: string }).status) === 'published').length,
    kbFiles: files.length,
  };

  // ------------------------------------------------ H. other modules
  const visits = await safe(repo.listVisits({ from: f.from, to: f.to }), []);
  const sessions = await safe(allSessions(), []);
  const other = {
    hostelRooms: rooms.length, hostelBeds: rooms.reduce((n, r) => n + r.data.capacity, 0), hostelOccupied: rooms.reduce((n, r) => n + r.data.studentIds.length, 0),
    buses: busList.length, libraryTitles: libBooks.length, libraryCopies: libBooks.reduce((n, b) => n + b.data.copies, 0),
    sportsParticipation: await safe(participationPct(today), null),
    speakerSessions: sessions.filter((s) => inRange(s.date)).length,
    events: eventList.filter((e) => e.data.date >= today && e.data.date <= addDays(today, 60)).length,
    notices: noticeList.length,
    visits: visits.length, visitsCompleted: visits.filter((v) => v.status === 'completed').length,
    enquiries: admissions?.totals.enquiries ?? null,
  };

  // ------------------------------------------------ pending tasks & recent activity
  const pendingTasks = [
    { label: 'Student sign-ups to verify', n: overall.accountsPending, href: '/crm/students?view=pending' },
    { label: 'Attendance corrections to approve', n: staffSection.approvals.attendanceCorrections, href: '/crm/analytics?tab=attendance' },
    { label: 'Student leave requests', n: studentsSection.leavePending, href: '/crm/academics' },
    { label: 'Open student doubts', n: studentsSection.doubtsOpen, href: '/crm/academics' },
    { label: 'AI / extracted questions to review', n: openBook.questionsPendingReview, href: '/crm/openbook?tab=bank' },
    ...(admissions ? [{ label: 'Leads needing immediate follow-up', n: admissions.attention.length, href: '/crm/analytics?tab=marketing' }] : []),
    ...(fees ? [{ label: 'Students with overdue fees', n: fees.studentsOverdue, href: '/crm/accounts' }] : []),
  ].filter((t) => t.n > 0);
  const recent = [
    ...noticeList.map((n) => ({ at: n.data.date, text: `Notice: ${n.data.title}`, href: '/crm/notices' })),
    ...testList.map((t) => ({ at: t.data.date, text: `Exam: ${t.data.title}`, href: '/crm/academics' })),
    ...visits.map((v) => ({ at: v.date, text: `Campus visit (${v.status})`, href: '/crm/visits' })),
    ...pend.filter((p) => !p.data.isTest).map((p) => ({ at: p.data.createdAt.slice(0, 10), text: `Student sign-up: ${p.data.fullName}`, href: '/crm/students?view=pending' })),
  ].filter((x) => x.at <= today).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);

  return { range: f, overall, academics, admissions, students: studentsSection, staff: staffSection, fees, openBook, other, pendingTasks, recent, testExcluded: testIds.size };
}
