import Link from 'next/link';
import { notFound } from 'next/navigation';
import { certificateAction, checkInAction, disciplineAction, mentorNoteAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { can } from '@/lib/crm/permissions';
import { formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { studentResults } from '@/lib/school/academics';
import { batchOf, requireSeesStudent, roomOf, SchoolError, studentsById } from '@/lib/school/common';
import { studentFile } from '@/lib/school/mentoring';
import { busFor, certificatesFor } from '@/lib/school/operations';

export const metadata = { title: 'Student' };

export default async function StudentPage({ params }: { params: { id: string } }) {
  const user = await requireStaff('students.view');
  try {
    await requireSeesStudent(user, params.id);
  } catch (e) {
    if (e instanceof SchoolError) notFound();
    throw e;
  }
  const s = (await studentsById()).get(params.id);
  if (!s) notFound();
  const [batch, room, bus, certs, file, results] = await Promise.all([batchOf(s.id), roomOf(s.id), busFor(s.id), certificatesFor(s.id), studentFile(user, s.id), studentResults(s.id)]);

  return (
    <div className="space-y-5">
      <Link href="/crm/students" className="text-sm text-muted underline">← Students</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">{s.fullName}</h1>
          <p className="text-sm text-muted"><span className="font-mono">{s.collegeId}</span> · {programShort(s.program)} · {batch?.data.name ?? 'no batch'} · {s.stay === 'hostel' ? `hostel${room ? ` room ${room.data.room}` : ''}` : `day scholar${bus ? ` · bus ${bus.data.busNo}` : ''}`}</p>
          <p className="text-sm text-muted">Guardian: {s.guardianName} · <span className="font-mono">{phoneFor(user, s.guardianPhone)}</span></p>
        </div>
        <div className="flex gap-2">
          <Link href={`/crm/leads/${s.leadId}`} className="btn-outline py-1.5 text-sm">Admission record</Link>
          {can(user, 'certificates.issue') && <Link href={`/crm/students/${s.id}/id-card`} className="btn-outline py-1.5 text-sm">ID card</Link>}
        </div>
      </div>

      {file.signals.warnings.length > 0 && (
        <div role="status" className="rounded-xl bg-gold-100/70 px-4 py-3 text-sm dark:bg-gold/10">
          <p className="font-semibold text-heading">Early warning</p>
          <ul className="list-disc pl-5">{file.signals.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Attendance (30 days)">
          <p className="text-sm">{file.signals.attendance.pct === null ? 'Not recorded yet.' : `${file.signals.attendance.pct}% · ${file.signals.attendance.absent} absent · ${file.signals.attendance.late} late · ${file.signals.attendance.leave} leave`}</p>
          {file.signals.attendance.absentDates.length > 0 && <p className="mt-1 text-xs text-muted">Absent: {file.signals.attendance.absentDates.map((d) => formatDate(d, { day: 'numeric', month: 'short' })).join(', ')}</p>}
        </Panel>
        <Panel title="Test results">
          {results.length === 0 ? <Empty>No published results.</Empty> : (
            <ul className="space-y-1 text-sm">{results.map((r) => <li key={r.test.id} className="flex justify-between gap-2"><span>{r.test.title}</span><span className="font-mono">{r.score}/{r.max} · rank {r.rank}/{r.of}</span></li>)}</ul>
          )}
        </Panel>
      </div>

      {can(user, 'mentor.notes') && (
        <div id="mentor" className="grid gap-5 xl:grid-cols-2">
          <Panel title="Mentor notes">
            {file.notes.length === 0 ? <Empty>No notes yet.</Empty> : (
              <ul className="mb-3 space-y-2 text-sm">{file.notes.sort((a, b) => b.date.localeCompare(a.date)).map((n, i) => <li key={i}><span className="text-xs text-muted">{formatDate(n.date, { day: 'numeric', month: 'short' })} · {n.kind.replace('_', ' ')}{n.shareWithParent ? ' · shared with parent' : ''}</span><p>{n.note}</p></li>)}</ul>
            )}
            <QuickForm action={mentorNoteAction} submit="Add note" fields={[
              { name: 'studentId', type: 'hidden', value: s.id },
              { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'one_to_one', label: 'Weekly one-to-one' }, { value: 'note', label: 'Note' }, { value: 'parent_call', label: 'Parent call' }] },
              { name: 'share', label: 'Include in the Sunday parent report', type: 'checkbox' },
              { name: 'note', label: 'Note', type: 'textarea', required: true, wide: true },
            ]} />
          </Panel>
          {can(user, 'wellbeing.view') && (
            <Panel title="Monthly wellbeing check-in">
              {file.checks.length === 0 ? <Empty>No check-ins yet.</Empty> : (
                <ul className="mb-3 space-y-1 text-sm">{file.checks.map((c) => <li key={c.month} className="flex justify-between"><span>{c.month}</span><span className={c.stress <= 2 ? 'font-semibold text-maroon dark:text-gold' : ''}>stress {c.stress}/5 · sleep {c.sleep}/5{c.followUp !== 'none' ? ` · ${c.followUp.replace('_', ' ')}` : ''}</span></li>)}</ul>
              )}
              <QuickForm action={checkInAction} submit="Save check-in" cols={3} fields={[
                { name: 'studentId', type: 'hidden', value: s.id },
                { name: 'month', label: 'Month', type: 'month', required: true, defaultValue: todayIST().slice(0, 7) },
                { name: 'stress', label: 'How are they coping? (1 = very stressed, 5 = well)', type: 'select', options: [5, 4, 3, 2, 1].map((x) => ({ value: String(x), label: String(x) })) },
                { name: 'sleep', label: 'Sleep (1–5)', type: 'select', options: [5, 4, 3, 2, 1].map((x) => ({ value: String(x), label: String(x) })) },
                { name: 'note', label: 'Private note', type: 'textarea', wide: true },
              ]} />
            </Panel>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {can(user, 'certificates.issue') && (
          <Panel title="Certificates">
            {certs.length === 0 ? <Empty>None issued.</Empty> : (
              <ul className="mb-3 space-y-1 text-sm">{certs.map((c) => <li key={c.id} className="flex justify-between gap-2"><span className="font-mono">{c.number}</span><span className="text-muted">{c.kind.toUpperCase()} · {formatDateTime(c.issuedAt)} · <Link href={`/crm/students/${s.id}/certificate/${c.id}`} className="underline">Print</Link></span></li>)}</ul>
            )}
            <QuickForm action={certificateAction} submit="Issue" fields={[
              { name: 'studentId', type: 'hidden', value: s.id },
              { name: 'kind', label: 'Certificate', type: 'select', options: [{ value: 'bonafide', label: 'Bonafide' }, { value: 'study', label: 'Study certificate' }, { value: 'conduct', label: 'Conduct certificate' }, { value: 'tc', label: 'Transfer certificate (once)' }] },
              { name: 'purpose', label: 'Purpose', type: 'text' },
              { name: 'conduct', label: 'Conduct (TC / conduct)', type: 'text', defaultValue: 'Good' },
            ]} />
          </Panel>
        )}
        {can(user, 'discipline.record') && (
          <Panel title="Discipline record">
            {file.discipline.length === 0 ? <Empty>Nothing recorded.</Empty> : <ul className="mb-3 space-y-1 text-sm">{file.discipline.map((d, i) => <li key={i}>{formatDate(d.date, { day: 'numeric', month: 'short' })}: {d.note}{d.action ? ` · ${d.action}` : ''}</li>)}</ul>}
            <QuickForm action={disciplineAction} submit="Record" fields={[
              { name: 'studentId', type: 'hidden', value: s.id },
              { name: 'note', label: 'What happened', type: 'textarea', required: true, wide: true },
              { name: 'actionTaken', label: 'Action taken', type: 'text', wide: true },
            ]} />
          </Panel>
        )}
      </div>
    </div>
  );
}
