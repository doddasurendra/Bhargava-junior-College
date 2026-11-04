import Link from 'next/link';
import { addLessonAction, assignSetAction, differentiateAction, shareReportAction, toggleLessonAction } from '@/app/crm/practice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { chaptersOf, curriculumMap, QUESTIONS, SUBJECTS } from '@/lib/practice/bank';
import { schoolStats, teacherPractice } from '@/lib/practice/service';

export const metadata = { title: 'Practice (teacher)' };
export const dynamic = 'force-dynamic';

const CHAPTER_OPTS = SUBJECTS.flatMap((s) => chaptersOf(s).map((c) => ({ value: `${s}|${c}`, label: `${s} · ${c}` })));
const LEVELS = [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }];

export default async function TeacherPracticePage({ searchParams }: { searchParams: { batch?: string } }) {
  const user = await requireStaff();
  if (!can(user, 'homework.assign') && !can(user, 'academics.view')) return <Panel title="Practice"><p className="text-sm text-muted">Your role doesn’t use practice.</p></Panel>;
  const [t, stats] = await Promise.all([teacherPractice(user, searchParams.batch ?? null), can(user, 'academics.view') ? schoolStats(user) : Promise.resolve(null)]);
  const teaches = can(user, 'homework.assign');

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Practice</h1>
        <p className="text-sm text-muted">{QUESTIONS.length} auto-marked questions across Mathematics, Physics, Chemistry and Biology, tagged to TS Inter, JEE Main and NEET chapters.</p>
      </div>

      {stats && (
        <Panel title="School-wide statistics">
          <div className="grid gap-4 sm:grid-cols-3">
            <p className="text-sm"><span className="font-mono text-2xl text-heading">{stats.questions}</span><br /><span className="text-muted">questions answered</span></p>
            <p className="text-sm"><span className="font-mono text-2xl text-heading">{stats.accuracy ?? '–'}{stats.accuracy !== null ? '%' : ''}</span><br /><span className="text-muted">accuracy</span></p>
            <p className="text-sm"><span className="font-mono text-2xl text-heading">{stats.activeThisWeek}</span><br /><span className="text-muted">students active this week</span></p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3 text-sm">
            <ul>{stats.bySubject.map((x) => <li key={x.subject} className="flex justify-between"><span>{x.subject}</span><span className="font-mono">{x.questions} · {x.accuracy ?? '–'}{x.accuracy !== null ? '%' : ''}</span></li>)}</ul>
            <ul>{stats.byBatch.map((x) => <li key={x.batch} className="flex justify-between"><span>{x.batch}</span><span className="font-mono">{x.students} students · {x.accuracy ?? '–'}{x.accuracy !== null ? '%' : ''}</span></li>)}</ul>
            <ul>{stats.weakest.length === 0 ? <li className="text-muted">Weakest chapters appear after 5+ answers.</li> : stats.weakest.map((x) => <li key={x.chapter} className="flex justify-between"><span>{x.chapter}</span><span className="font-mono">{x.accuracy}%</span></li>)}</ul>
          </div>
        </Panel>
      )}

      {t.batches.length > 0 && (
        <nav className="flex flex-wrap gap-1.5">
          {t.batches.map((b) => <Link key={b.id} href={`/crm/practice?batch=${b.id}`} className={`chip px-3 py-1 text-sm ${t.batch?.id === b.id ? 'chip-active' : ''}`}>{b.data.name}</Link>)}
        </nav>
      )}

      {!t.batch ? <Panel title="Batches"><Empty>No batches yet. Practice analytics appear once you teach a batch.</Empty></Panel> : (
        <>
          <Panel title={`Students who need help · ${t.batch.data.name}`}>
            {t.misconceptions!.length === 0 ? <Empty>No shared misconceptions yet (shown when 2+ students make the same mistake).</Empty> : (
              <ul className="divide-y divide-line text-sm">
                {t.misconceptions!.slice(0, 10).map((m) => (
                  <li key={m.chapter + m.misconception} className="py-2"><span className="font-medium text-heading">{m.chapter}: {m.misconception}</span><span className="block text-xs text-muted">{m.names.length} students · {m.times} times · {m.names.join(', ')}</span></li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Students (progress, strengths and weaknesses)">
            {t.students!.length === 0 ? <Empty>No students in this batch.</Empty> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1">Student</th><th>Questions</th><th>This week</th><th>Accuracy</th><th>Level / XP</th><th>Streak</th><th>Weak chapters</th>{teaches && <th />}</tr></thead>
                <tbody>
                  {t.students!.map((s) => (
                    <tr key={s.id} className="border-t border-line align-top">
                      <td className="py-1.5 text-heading">{s.name}<span className="block font-mono text-[11px] text-muted">{s.collegeId}</span></td>
                      <td className="font-mono">{s.questions}</td>
                      <td className="font-mono">{s.week}</td>
                      <td className="font-mono">{s.accuracy ?? '–'}{s.accuracy !== null ? '%' : ''}</td>
                      <td className="font-mono">{s.level} / {s.xp}</td>
                      <td className="font-mono">{s.streak}</td>
                      <td className="text-xs">{s.weak.join(', ') || '—'}</td>
                      {teaches && <td><QuickForm action={shareReportAction} submit="Share with parent" cols={1} fields={[{ name: 'studentId', type: 'hidden', value: s.id }]} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={`Weekly program (week of ${formatDate(t.weekStart!, { day: 'numeric', month: 'short' })})`}>
              {t.program!.length === 0 ? <Empty>Nothing assigned this week.</Empty> : (
                <ul className="mb-3 space-y-1 text-sm">{t.program!.map((x) => <li key={x.id}>{x.subject} · {x.chapter} · <strong>{x.difficulty}</strong> · {x.count} questions · {x.names.length ? x.names.join(', ') : 'whole batch'}</li>)}</ul>
              )}
              {teaches && (
                <div className="space-y-3">
                  <QuickForm action={assignSetAction} submit="Assign to batch" fields={[
                    { name: 'batchId', type: 'hidden', value: t.batch.id },
                    { name: 'chapter', label: 'Chapter', type: 'select', options: CHAPTER_OPTS, wide: true },
                    { name: 'difficulty', label: 'Level', type: 'select', options: LEVELS },
                    { name: 'count', label: 'Questions', type: 'number', min: 3, max: 30, defaultValue: '5' },
                  ]} />
                  <div className="rounded-xl border border-line p-3">
                    <p className="mb-2 text-xs text-muted">One-click differentiation: splits the batch into easy / medium / hard groups by each student’s accuracy in the chapter and assigns each group its level.</p>
                    <QuickForm action={differentiateAction} submit="Differentiate & assign" fields={[
                      { name: 'batchId', type: 'hidden', value: t.batch.id },
                      { name: 'chapter', label: 'Chapter', type: 'select', options: CHAPTER_OPTS, wide: true },
                      { name: 'count', label: 'Questions', type: 'number', min: 3, max: 30, defaultValue: '5' },
                    ]} />
                  </div>
                </div>
              )}
            </Panel>

            <Panel title={`Lesson plan${t.lessonProgress !== null ? ` · ${t.lessonProgress}% done` : ''}`}>
              {t.lessons!.length === 0 ? <Empty>No lessons planned.</Empty> : (
                <ul className="mb-3 divide-y divide-line text-sm">
                  {t.lessons!.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className={l.status === 'done' ? 'text-muted line-through' : ''}>{formatDate(l.date, { day: 'numeric', month: 'short' })} · {l.subject} · {l.topic}</span>
                      {teaches && <QuickForm action={toggleLessonAction} submit={l.status === 'done' ? 'Undo' : 'Mark done'} cols={1} fields={[{ name: 'id', type: 'hidden', value: l.id }]} />}
                    </li>
                  ))}
                </ul>
              )}
              {teaches && (
                <QuickForm action={addLessonAction} submit="Plan lesson" fields={[
                  { name: 'batchId', type: 'hidden', value: t.batch.id },
                  { name: 'subject', label: 'Subject', type: 'select', options: SUBJECTS.map((x) => ({ value: x, label: x })) },
                  { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayIST() },
                  { name: 'topic', label: 'Topic', type: 'text', required: true, wide: true },
                ]} />
              )}
            </Panel>
          </div>

          <Panel title="Chapter accuracy (this batch)">
            {t.chapters!.length === 0 ? <Empty>No answers yet.</Empty> : (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">{t.chapters!.map((c) => <li key={c.chapter} className="flex justify-between gap-2"><span>{c.subject} · {c.chapter}</span><span className={`font-mono ${c.accuracy < 50 ? 'text-maroon dark:text-red-300' : ''}`}>{c.accuracy}% of {c.questions}</span></li>)}</ul>
            )}
          </Panel>
        </>
      )}

      <Panel title="Curriculum mapping">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1">Chapter</th><th>Questions</th><th>TS Inter</th><th>JEE Main</th><th>NEET</th></tr></thead>
          <tbody>{curriculumMap().map((r) => <tr key={r.subject + r.chapter} className="border-t border-line"><td className="py-1">{r.subject} · {r.chapter}</td><td className="font-mono">{r.total}</td><td className="font-mono">{r.byCurriculum['TS Inter'] || '—'}</td><td className="font-mono">{r.byCurriculum['JEE Main'] || '—'}</td><td className="font-mono">{r.byCurriculum.NEET || '—'}</td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  );
}
