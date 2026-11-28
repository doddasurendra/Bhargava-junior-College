import Link from 'next/link';
import { BarList, Donut, TrendChart } from '@/components/crm/charts';
import { Empty, Panel, sourceLabel, Stat } from '@/components/crm/ui';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { ROLE_LABELS, type Staff } from '@/lib/crm/types';
import { formatDate, todayIST } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { academicYear, institution } from '@/lib/school/institution';

const MODULES = [
  ['#overview', 'Overview'], ['#academics', 'Academics'], ['#admissions', 'Admissions'], ['#students', 'Students & parents'], ['#staff', 'Staff'], ['#fees', 'Fees'], ['#openbook', 'Open Book & KB'], ['#other', 'Campus & modules'],
] as const;
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('en-IN'));
const p = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

/** Institution-wide Summary dashboard (task 1.2): every number counted from the college database. */
export async function InstitutionDashboard({ user, q }: { user: Staff; q: { from?: string; to?: string; year?: string } }) {
  const today = todayIST();
  const ay = academicYear(today);
  const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const preset = q.year === 'month' ? { from: `${today.slice(0, 7)}-01`, to: today } : q.year === '30d' ? { from: (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0, 10); })(), to: today } : null;
  const from = preset?.from ?? iso(q.from) ?? ay.from;
  const to = preset?.to ?? iso(q.to) ?? ay.to;
  const d = await institution(user, { from, to }, today);
  const o = d.overall;
  const a = d.academics;
  const m = d.admissions;
  const funnel = m ? [['Enquiries', m.totals.enquiries], ['Visited campus', m.totals.visited], ['Counselling done', d.admissions!.counselled], ['Applications', m.pipeline.find((x) => x.key === 'application')?.value ?? 0], ['Confirmed', m.totals.confirmed]] as [string, number][] : [];
  const fmax = Math.max(1, ...funnel.map(([, v]) => v));

  return (
    <div className="space-y-6" data-testid="institution-dashboard">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4 dark:bg-surface">
        <Crest size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl text-maroon dark:text-gold">Summary</h1>
          <p className="text-sm text-muted">{college.name} · the whole website and app in one place · {formatDate(from, { day: 'numeric', month: 'short', year: 'numeric' })} – {formatDate(to, { day: 'numeric', month: 'short', year: 'numeric' })} · counted live from the college database{d.testExcluded ? ` · ${d.testExcluded} test record(s) excluded` : ''}</p>
        </div>
        <form method="get" action="/crm/summary" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="text-xs">Period<select name="year" defaultValue={q.year ?? ''} className="input mt-1 w-auto py-1"><option value="">Academic year {ay.label}</option><option value="month">This month</option><option value="30d">Last 30 days</option><option value="custom">Dates below</option></select></label>
          <label className="text-xs">From<input type="date" name="from" defaultValue={from} max={today} className="input mt-1 py-1" /></label>
          <label className="text-xs">To<input type="date" name="to" defaultValue={to} max={today} className="input mt-1 py-1" /></label>
          <button className="btn-primary px-4 py-1.5">Apply</button>
        </form>
      </header>
      <nav aria-label="Dashboard modules" className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto bg-bg/90 px-1 py-2 backdrop-blur">
        {MODULES.map(([h, l]) => <a key={h} href={h} className="chip shrink-0">{l}</a>)}
      </nav>

      <section id="overview" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Institution</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/crm/students"><Stat label="Students" value={n(o.students)} /></Link>
          <Link href="/crm/staff-directory"><Stat label="Teachers" value={n(o.teachers)} /></Link>
          <Link href="/crm/staff-directory"><Stat label="Staff (active)" value={n(o.staff)} /></Link>
          <Stat label="Parents / guardians" value={n(o.parents)} />
          {m && <Link href="/crm/analytics?tab=marketing"><Stat label="Admissions confirmed" value={n(m.totals.confirmed)} tone="good" /></Link>}
          {m && <Stat label="Pending admissions" value={n(m.pipeline.filter((x) => ['application', 'counselling', 'follow_up', 'interested'].includes(x.key)).reduce((s, x) => s + x.value, 0))} />}
          <Link href="/programs"><Stat label="Programs" value={n(o.programs)} /></Link>
          <Link href="/crm/academics"><Stat label="Active batches" value={n(o.batches)} /></Link>
          <Stat label="Subjects (timetable)" value={n(o.subjects)} />
          <Link href="/crm/exams"><Stat label="Examinations" value={n(o.exams)} /></Link>
          <Link href="/crm/openbook"><Stat label="Study materials" value={n(o.studyMaterials)} /></Link>
          <Link href="/crm/hostel"><Stat label="Hostel students" value={n(o.hostel)} /></Link>
          <Link href="/crm/transport"><Stat label="Transport users" value={n(o.transport)} /></Link>
          <Stat label="Student accounts active / inactive" value={`${n(o.accountsActive)} / ${n(o.accountsInactive)}`} />
          <Link href="/crm/students?view=pending"><Stat label="Sign-ups awaiting verification" value={n(o.accountsPending)} tone={o.accountsPending ? 'warn' : 'default'} /></Link>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title={`Pending tasks (${d.pendingTasks.length})`}>{d.pendingTasks.length ? <ul className="divide-y divide-line text-sm">{d.pendingTasks.map((t) => <li key={t.label}><Link href={t.href} className="flex justify-between py-2 hover:underline"><span>{t.label}</span><span className="font-mono font-semibold text-maroon dark:text-gold">{t.n}</span></Link></li>)}</ul> : <Empty>Nothing waiting.</Empty>}</Panel>
          <Panel title="Recent activity">{d.recent.length ? <ul className="space-y-1 text-sm">{d.recent.map((r, i) => <li key={i}><Link href={r.href} className="flex justify-between gap-2 hover:underline"><span className="truncate">{r.text}</span><span className="shrink-0 text-xs text-muted">{formatDate(r.at, { day: 'numeric', month: 'short' })}</span></Link></li>)}</ul> : <Empty>No recent activity.</Empty>}</Panel>
        </div>
      </section>

      <section id="academics" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Academics</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Attendance in period" value={p(a.attendance?.overall.pct)} tone={a.attendance?.overall.pct !== null && (a.attendance?.overall.pct ?? 100) < 75 ? 'warn' : 'default'} />
          <Stat label="Present today" value={a.attendance ? `${a.attendance.today_.present + a.attendance.today_.late} / ${a.attendance.totalStudents}` : '—'} />
          <Stat label="Exams in period · results" value={`${a.examsInRange} · ${a.resultsInRange}`} />
          <Stat label="Average score in period" value={p(a.avgScore)} />
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Students by year"><BarList rows={a.years} color="var(--viz-1)" /></Panel>
          <Panel title="Students by group"><BarList rows={a.groups} color="var(--viz-2)" /></Panel>
          <Panel title="Students by program">{a.byProgram.some((x) => x.value) ? <Donut label="students" slices={a.byProgram.filter((x) => x.value).map((x, i) => ({ label: x.label, value: x.value, color: `var(--viz-${(i % 4) + 1})` }))} /> : <Empty>No students yet.</Empty>}</Panel>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Monthly attendance %">{a.attendance?.monthly.length ? <TrendChart rows={a.attendance.monthly.map((x) => ({ date: `${x.month}-01`, pct: x.pct ?? 0 }))} series={[{ key: 'pct', label: 'Attendance %', color: 'var(--viz-1)' }]} max={100} /> : <Empty>No attendance registers in this period.</Empty>}</Panel>
          <Panel title="Subject-wise performance">{a.subjects.length ? <BarList rows={a.subjects.map((s) => ({ label: `${s.subject} · ${s.batch}`, value: s.avg ?? 0 }))} unit="%" /> : <Empty>No marks yet.</Empty>}</Panel>
        </div>
        <Panel title="Mock exams (closed-book)">{a.mocks.length ? <BarList rows={a.mocks.filter((x) => x.average !== null).map((x) => ({ label: x.title, value: x.average!, note: `${x.taken}/${x.of} taken` }))} unit="%" /> : <Empty>No closed-book exams yet.</Empty>}<p className="mt-2 text-xs"><Link className="underline" href="/crm/analytics?tab=academics">Chapter-wise analysis →</Link> · <Link className="underline" href="/crm/analytics?tab=attendance">Attendance analytics →</Link></p></Panel>
      </section>

      <section id="admissions" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Admissions</h2>
        {!m ? <Panel title="Admissions"><Empty>Your role does not include admissions figures.</Empty></Panel> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Total enquiries" value={n(m.totals.enquiries)} />
              <Stat label="New (not contacted)" value={n(m.pipeline.find((x) => x.key === 'new')?.value)} />
              <Stat label="Follow-ups pending" value={n(m.pipeline.find((x) => x.key === 'follow_up')?.value)} />
              <Stat label="Applications" value={n(m.pipeline.find((x) => x.key === 'application')?.value)} />
              <Stat label="Documents pending" value={n(d.admissions!.docsPending)} tone={d.admissions!.docsPending ? 'warn' : 'default'} />
              <Stat label="Conversion" value={p(m.totals.conversion)} tone="good" />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Admission funnel">
                <ol className="space-y-2" data-testid="admission-funnel">
                  {funnel.map(([label, v], i) => (
                    <li key={label} className="text-sm">
                      <div className="flex justify-between"><span>{label}</span><span className="font-mono">{v}{i > 0 && funnel[0][1] ? <span className="ml-1 text-xs text-muted">({Math.round((v / funnel[0][1]) * 100)}%)</span> : null}</span></div>
                      <div className="mt-1 h-3 rounded-full bg-bg"><div className="mx-auto h-3 rounded-full" style={{ width: `${Math.max(4, (v / fmax) * 100)}%`, background: i === funnel.length - 1 ? 'var(--viz-4)' : 'var(--viz-1)' }} /></div>
                    </li>
                  ))}
                </ol>
              </Panel>
              <Panel title="Enquiry sources">{m.sources.length ? <Donut label="enquiries" slices={m.sources.slice(0, 5).map((s, i) => ({ label: sourceLabel(s.source), value: s.leads, color: `var(--viz-${(i % 4) + 1})` }))} /> : <Empty>No enquiries in this period.</Empty>}</Panel>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Counsellor & telecaller performance">{m.owners.length ? <BarList rows={m.owners.map((x) => ({ label: x.name, value: x.confirmed, note: `${x.leads} leads · ${x.calls} calls` }))} color="var(--viz-1)" /> : <Empty>No owned enquiries in this period.</Empty>}</Panel>
              <Panel title="Campaign performance">{m.campaigns.length ? <BarList rows={m.campaigns.map((c) => ({ label: c.name, value: c.confirmed, note: `${c.leads} enq · ${c.conversion ?? 0}%` }))} color="var(--viz-4)" /> : <Empty>No campaigns yet.</Empty>}</Panel>
            </div>
            <Panel title="Monthly enquiries and enrollment"><TrendChart rows={m.monthly} series={[{ key: 'leads', label: 'Enquiries', color: 'var(--viz-1)' }, { key: 'confirmed', label: 'Confirmed', color: 'var(--viz-4)' }, { key: 'enrolled', label: 'College IDs', color: 'var(--viz-2)' }]} /><p className="mt-2 text-xs"><Link className="underline" href="/crm/analytics?tab=marketing">Full marketing & admissions analytics →</Link></p></Panel>
          </>
        )}
      </section>

      <section id="students" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Students & parents</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link href="/crm/students"><Stat label="Student profiles" value={n(o.students)} /></Link>
          <Stat label="Parents with app access" value={n(o.parents)} />
          <Stat label="Below 75% attendance" value={n(d.students.belowAttendance)} tone={d.students.belowAttendance ? 'warn' : 'default'} />
          <Link href="/crm/notices"><Stat label="Notices in period" value={n(d.students.notices)} /></Link>
          <Stat label="Open doubts (support)" value={n(d.students.doubtsOpen)} tone={d.students.doubtsOpen ? 'warn' : 'default'} />
          <Stat label="Leave requests pending" value={n(d.students.leavePending)} />
        </div>
      </section>

      <section id="staff" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Staff & management</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Faculty" value={n(d.staff.teachers)} />
          <Link href="/crm/staff-attendance"><Stat label="Staff present today" value={d.staff.markedToday ? `${d.staff.presentToday} / ${d.staff.markedToday}` : 'not marked'} /></Link>
          <Stat label="Batches with a class teacher" value={`${d.staff.classTeachers} / ${d.staff.classTeachers + d.staff.batchesWithoutClassTeacher}`} tone={d.staff.batchesWithoutClassTeacher ? 'warn' : 'good'} />
          <Stat label="Approvals waiting" value={n(d.staff.approvals.leave + d.staff.approvals.attendanceCorrections + d.staff.approvals.signups)} />
          <Stat label="Homework set in period" value={n(d.staff.homeworkInRange)} />
          <Stat label="Inactive staff accounts" value={n(o.staffInactive)} />
        </div>
        <Panel title="Staff by department / role"><BarList rows={d.staff.departments.map((x) => ({ label: ROLE_LABELS[x.role] ?? x.role, value: x.n }))} color="var(--viz-2)" /></Panel>
      </section>

      <section id="fees" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Fees & finance</h2>
        {!d.fees ? <Panel title="Fees"><Empty>Fee figures are shown only to finance and management roles.</Empty></Panel> : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Collected in period" value={formatINR(d.fees.collected)} tone="good" />
              <Stat label="Payments" value={n(d.fees.payments)} />
              <Stat label="Outstanding (all)" value={formatINR(d.fees.outstanding)} />
              <Stat label="Overdue" value={`${formatINR(d.fees.overdue)} · ${d.fees.studentsOverdue} students`} tone={d.fees.overdue ? 'warn' : 'good'} />
            </div>
            <Panel title="Fee collection by month">{d.fees.monthly.length ? <TrendChart rows={d.fees.monthly} series={[{ key: 'amount', label: 'Collected (₹)', color: 'var(--viz-4)' }]} /> : <Empty>No approved payments in this period.</Empty>}<p className="mt-2 text-xs">Scholarships: BSAT concessions are recorded on each student’s fee plan. <Link href="/crm/accounts" className="underline">Accounts →</Link></p></Panel>
          </>
        )}
      </section>

      <section id="openbook" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Open Book & knowledge base</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link href="/crm/openbook?tab=books"><Stat label="Books" value={n(d.openBook.books)} /></Link>
          <Link href="/crm/openbook?tab=papers"><Stat label="Previous-year papers" value={n(d.openBook.papers)} /></Link>
          <Stat label="JEE / NEET resources" value={n(d.openBook.jeeNeet)} />
          <Link href="/crm/openbook?tab=bank"><Stat label="Shared questions" value={n(d.openBook.questionsShared)} /></Link>
          <Stat label="AI-generated questions" value={n(d.openBook.questionsAi)} />
          <Stat label="Student-created Q&A" value={n(d.openBook.questionsStudent + d.openBook.communityPosts)} />
          <Link href="/crm/knowledge"><Stat label="Knowledge base articles" value={n(d.openBook.kbArticles)} /></Link>
          <Stat label="Uploaded KB documents" value={n(d.openBook.kbFiles)} />
          <Stat label="Students reading" value={n(d.openBook.readers)} />
          <Stat label="Reading hours" value={n(d.openBook.readingHours)} />
        </div>
        <Panel title="Books by category">{d.openBook.booksByCategory.length ? <BarList rows={d.openBook.booksByCategory} color="var(--viz-1)" /> : <Empty>No books yet.</Empty>}</Panel>
      </section>

      <section id="other" className="space-y-3">
        <h2 className="font-display text-xl text-heading">Campus & other modules</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/crm/hostel"><Stat label="Hostel beds occupied" value={`${n(d.other.hostelOccupied)} / ${n(d.other.hostelBeds)}`} /></Link>
          <Link href="/crm/transport"><Stat label="Buses" value={n(d.other.buses)} /></Link>
          <Link href="/crm/library"><Stat label="Library titles / copies" value={`${n(d.other.libraryTitles)} / ${n(d.other.libraryCopies)}`} /></Link>
          <Link href="/crm/sports"><Stat label="Sports participation (7 days)" value={p(d.other.sportsParticipation)} /></Link>
          <Link href="/crm/sessions"><Stat label="Speaker sessions in period" value={n(d.other.speakerSessions)} /></Link>
          <Link href="/crm/events"><Stat label="Events next 60 days" value={n(d.other.events)} /></Link>
          <Link href="/crm/notices"><Stat label="Notices (all)" value={n(d.other.notices)} /></Link>
          <Link href="/crm/visits"><Stat label="Campus visits (done)" value={`${n(d.other.visits)} (${n(d.other.visitsCompleted)})`} /></Link>
          <Link href="/crm/leads"><Stat label="Enquiries in period" value={n(d.other.enquiries)} /></Link>
          <Link href="/parent-counselling"><Stat label="Parent counselling guide" value="Open" /></Link>
        </div>
      </section>
    </div>
  );
}
