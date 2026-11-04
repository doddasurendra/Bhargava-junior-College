import Link from 'next/link';
import { addPeriodAction, allotStudentAction, assignMentorAction, removePeriodAction, saveBatchAction } from '@/app/crm/school-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { programs } from '@/content/programs';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { mentorships, SUBJECTS, timetable } from '@/lib/records/collections';
import { batchTests } from '@/lib/school/academics';
import { allBatches, allStudents, store } from '@/lib/school/common';

export const metadata = { title: 'Academics' };
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function AcademicsPage() {
  const user = await requireStaff('academics.manage');
  const [list, students, staff, periods, mentors] = await Promise.all([allBatches(), allStudents(), getCrmRepo().listStaff(), timetable.list(store()), mentorships.list(store())]);
  const teachers = staff.filter((s) => s.roles.some((r) => r === 'faculty' || r === 'class_teacher' || r === 'academic_coordinator'));
  const tOpts = teachers.map((t) => ({ value: t.id, label: t.fullName }));
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const inBatch = new Map(list.flatMap((b) => b.data.studentIds.map((sid) => [sid, b.data.name] as const)));
  const mentorOf = new Map(mentors.map((m) => [m.data.studentId, names.get(m.data.mentorId) ?? 'Mentor']));
  const tests = (await Promise.all(list.map((b) => batchTests(b.id)))).flat().slice(0, 30);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Academics</h1>
          <p className="text-sm text-muted">Batches (max 40), timetable, mentors and tests. {students.length} students with a College ID.</p>
        </div>
        <div className="flex gap-2 text-sm">
          {can(user, 'academics.view') && <Link href="/crm/academics/overview" className="btn-outline py-1.5">Academic overview</Link>}
          <Link href="/crm/notices" className="btn-outline py-1.5">Notices</Link>
        </div>
      </div>

      <Panel title={`Batches (${list.length})`}>
        {list.length === 0 ? (
          <Empty>No batches yet. Create the first one below.</Empty>
        ) : (
          <ul className="-my-2 divide-y divide-line">
            {list.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <Link href={`/crm/academics/batch/${b.id}`} className="font-semibold text-heading hover:underline">{b.data.name}</Link>
                  <span className="text-muted"> · {programShort(b.data.program)} · year {b.data.year} · section {b.data.section} · class teacher {b.data.classTeacherId ? names.get(b.data.classTeacherId) ?? '—' : '—'}</span>
                </span>
                <span className="font-mono">{b.data.studentIds.length}/{b.data.capacity}{!b.data.active && ' · inactive'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-semibold text-heading">New batch</p>
          <QuickForm action={saveBatchAction} submit="Create batch" cols={3} fields={[
            { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'JEE-1A' },
            { name: 'program', label: 'Program', type: 'select', options: programs.map((p) => ({ value: p.slug, label: p.short })) },
            { name: 'year', label: 'Year', type: 'select', options: [{ value: '1', label: 'Year 1' }, { value: '2', label: 'Year 2' }] },
            { name: 'section', label: 'Section', type: 'text', required: true, defaultValue: 'A', maxLength: 4 },
            { name: 'capacity', label: 'Capacity (max 40)', type: 'number', required: true, defaultValue: '40', min: 1, max: 40 },
            { name: 'classTeacherId', label: 'Class teacher / mentor', type: 'select', options: [{ value: '', label: 'Not yet' }, ...tOpts] },
          ]} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Allot a student to a batch">
          <QuickForm action={allotStudentAction} submit="Allot" fields={[
            { name: 'studentId', label: 'Student', type: 'select', required: true, options: students.map((s) => ({ value: s.id, label: `${s.fullName} · ${s.collegeId}${inBatch.has(s.id) ? ` (${inBatch.get(s.id)})` : ''}` })) },
            { name: 'batchId', label: 'Batch', type: 'select', options: [{ value: '', label: 'Remove from batch' }, ...list.map((b) => ({ value: b.id, label: `${b.data.name} (${b.data.studentIds.length}/${b.data.capacity})` }))] },
          ]} />
          <p className="mt-2 text-xs text-muted">{students.filter((s) => !inBatch.has(s.id)).length} students are not in a batch yet.</p>
        </Panel>
        <Panel title="Assign a mentor (1 mentor : 20 students)">
          <QuickForm action={assignMentorAction} submit="Assign" fields={[
            { name: 'studentId', label: 'Student', type: 'select', required: true, options: students.map((s) => ({ value: s.id, label: `${s.fullName}${mentorOf.has(s.id) ? ` (mentor ${mentorOf.get(s.id)})` : ''}` })) },
            { name: 'mentorId', label: 'Mentor', type: 'select', required: true, options: teachers.filter((t) => t.roles.includes('class_teacher')).map((t) => ({ value: t.id, label: `${t.fullName} (${mentors.filter((m) => m.data.mentorId === t.id).length}/20)` })) },
          ]} />
        </Panel>
      </div>

      <Panel title="Timetable">
        {list.length === 0 ? (
          <Empty>Create a batch first.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[640px] text-[13px]">
                <thead>
                  <tr><th>Batch</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th /></tr>
                </thead>
                <tbody>
                  {periods
                    .map((p) => ({ id: p.id, ...p.data }))
                    .sort((a, b) => a.batchId.localeCompare(b.batchId) || a.day - b.day || a.start.localeCompare(b.start))
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{list.find((b) => b.id === p.batchId)?.data.name ?? '—'}</td>
                        <td>{DAYS[p.day]}</td>
                        <td className="font-mono">{p.start}–{p.end}</td>
                        <td>{p.subject}</td>
                        <td>{names.get(p.facultyId) ?? '—'}</td>
                        <td>{p.room ?? ''}</td>
                        <td><ActionButton action={removePeriodAction} label="Remove" hidden={{ id: p.id }} className="text-xs text-maroon underline dark:text-gold" /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <QuickForm action={addPeriodAction} submit="Add period" cols={4} fields={[
                { name: 'batchId', label: 'Batch', type: 'select', options: list.map((b) => ({ value: b.id, label: b.data.name })) },
                { name: 'day', label: 'Day', type: 'select', options: DAYS.slice(1).map((d, i) => ({ value: String(i + 1), label: d })) },
                { name: 'start', label: 'Start', type: 'time', required: true, defaultValue: '08:30' },
                { name: 'end', label: 'End', type: 'time', required: true, defaultValue: '09:30' },
                { name: 'subject', label: 'Subject', type: 'select', options: SUBJECTS.map((x) => ({ value: x, label: x })) },
                { name: 'facultyId', label: 'Teacher', type: 'select', options: tOpts },
                { name: 'room', label: 'Room', type: 'text', maxLength: 20 },
              ]} />
            </div>
          </>
        )}
      </Panel>

      <Panel title="Recent tests">
        {tests.length === 0 ? (
          <Empty>No tests yet. Faculty create them from their batch page.</Empty>
        ) : (
          <ul className="-my-2 divide-y divide-line text-sm">
            {tests.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/crm/academics/test/${t.id}`} className="font-medium text-heading hover:underline">{t.title}</Link>
                <span className="text-muted">{list.find((b) => b.id === t.batchId)?.data.name} · {t.date} · {t.mode} · {t.published ? 'published' : 'not published'}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
