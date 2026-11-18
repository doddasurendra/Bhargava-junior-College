import Link from 'next/link';
import { notFound } from 'next/navigation';
import { certificateAction, checkInAction, disciplineAction, mentorNoteAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { can } from '@/lib/crm/permissions';
import { addDays, formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { batchMaterials, batchRegisters, studentResults } from '@/lib/school/academics';
import { batchOf, requireReadsStudent, roomOf, SchoolError, store, studentsById } from '@/lib/school/common';
import { attendanceSummary } from '@/lib/school/logic';
import { getAppStore } from '@/lib/app/service';
import { homework, timetable } from '@/lib/records/collections';
import { deliveryLabel, getMessageStore } from '@/lib/whatsapp/service';
import { studentFile } from '@/lib/school/mentoring';
import { busFor, certificatesFor } from '@/lib/school/operations';

export const metadata = { title: 'Student' };

export default async function StudentPage({ params }: { params: { id: string } }) {
  const user = await requireStaff('students.view');
  try {
    await requireReadsStudent(user, params.id);
  } catch (e) {
    if (e instanceof SchoolError) notFound();
    throw e;
  }
  const s = (await studentsById()).get(params.id);
  if (!s) notFound();
  const today = todayIST();
  const [batch, room, bus, certs, file, results, guardians, wa] = await Promise.all([batchOf(s.id), roomOf(s.id), busFor(s.id), certificatesFor(s.id), studentFile(user, s.id), studentResults(s.id), getAppStore().guardiansOf(s.id), getMessageStore().listForLead(s.leadId, 30)]);
  const [regs, hw, mats, subjectsTaught] = batch
    ? await Promise.all([batchRegisters(batch.id, addDays(today, -180), today), homework.list(store(), { k1: batch.id }), batchMaterials(batch.id), timetable.list(store(), { k1: batch.id })])
    : [[], [], [], []];
  const months = [...new Set(regs.map((r) => r.date.slice(0, 7)))].sort().reverse().slice(0, 6);
  const last30 = regs.filter((r) => r.date >= addDays(today, -30) && r.marks[s.id]).sort((a, b) => b.date.localeCompare(a.date));
  const own = file.own; // in the user's own classes / office scope: may edit; otherwise read-only Student 360
  const teachers = [...new Set(subjectsTaught.map((p) => p.data.subject))];
  const parentMsgs = wa.outbound.filter((m) => guardians.some((g) => g.phone === m.to)).slice(0, 10);

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
          <Link href={`/crm/students/${s.id}/report-card`} className="btn-outline py-1.5 text-sm">Report card</Link>
          {can(user, 'certificates.issue') && <Link href={`/crm/students/${s.id}/id-card`} className="btn-outline py-1.5 text-sm">ID card</Link>}
        </div>
      </div>

      {file.signals.warnings.length > 0 && (
        <div role="status" className="rounded-xl bg-gold-100/70 px-4 py-3 text-sm dark:bg-gold/10">
          <p className="font-semibold text-heading">Early warning</p>
          <ul className="list-disc pl-5">{file.signals.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {!own && <p role="status" className="rounded-xl border border-line bg-surface px-4 py-2 text-sm text-muted">Student 360 (read-only): this student is not in your classes, so you can view their academic record but not change it. Private mentor and wellbeing notes stay with their mentor.</p>}

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Personal details">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Date of birth</dt><dd>{formatDate(s.dob)}</dd>
            <dt className="text-muted">Gender</dt><dd className="capitalize">{s.gender}</dd>
            <dt className="text-muted">Program</dt><dd>{programShort(s.program)}</dd>
            <dt className="text-muted">Class · section</dt><dd>{batch ? `${batch.data.name} · ${batch.data.section}` : 'Not allotted'}</dd>
            <dt className="text-muted">Student ID</dt><dd className="font-mono text-xs">{s.id}</dd>
            <dt className="text-muted">Admitted</dt><dd>{formatDate(s.createdAt.slice(0, 10))}</dd>
          </dl>
        </Panel>
        <Panel title={`Parents (${guardians.length})`}>
          {guardians.length === 0 ? <Empty>No parent linked.</Empty> : (
            <ul className="space-y-1 text-sm">{guardians.map((g) => <li key={g.phone} className="flex justify-between gap-2"><span>{g.name} <span className="text-xs capitalize text-muted">{g.relation}</span></span><span className="font-mono text-xs">{phoneFor(user, g.phone)}</span></li>)}</ul>
          )}
          <p className="mt-2 text-xs text-muted">Parent numbers are verified by the admin office when the College ID is issued.</p>
        </Panel>
        <Panel title="Academic progress">
          {results.length === 0 ? <Empty>No published results yet.</Empty> : (
            <>
              <p className="text-sm">Average {Math.round(results.reduce((a, r) => a + r.pct, 0) / results.length)}% over {results.length} test{results.length === 1 ? '' : 's'}</p>
              <p className="mt-1 text-sm">Last 3: {results.slice(-3).map((r) => `${Math.round(r.pct)}%`).join(' → ')}{results.length >= 2 ? (results.at(-1)!.pct >= results.at(-2)!.pct ? ' (improving)' : ' (dropped)') : ''}</p>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Attendance (30 days)">
          <p className="text-sm">{file.signals.attendance.pct === null ? 'Not recorded yet.' : `${file.signals.attendance.pct}% · ${file.signals.attendance.absent} absent · ${file.signals.attendance.late} late · ${file.signals.attendance.leave} leave`}</p>
          {last30.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1 text-[11px]" aria-label="Daily attendance">
              {last30.map((r) => <li key={r.date} title={`${formatDate(r.date)}: ${r.marks[s.id]}${r.remarks?.[s.id] ? ` (${r.remarks[s.id]})` : ''}`} className={`rounded px-1.5 py-0.5 ${r.marks[s.id] === 'absent' ? 'bg-maroon text-white' : 'bg-bg'}`}>{formatDate(r.date, { day: 'numeric', month: 'short' })} {r.marks[s.id][0].toUpperCase()}</li>)}
            </ul>
          )}
          {months.length > 0 && (
            <table className="table-base mt-3 text-sm">
              <thead><tr><th>Month</th><th className="text-right">Attendance</th><th className="text-right">Absent</th><th className="text-right">Late</th></tr></thead>
              <tbody>{months.map((m) => { const a = attendanceSummary(regs.filter((r) => r.date.startsWith(m)), s.id); return <tr key={m}><td>{m}</td><td className="text-right font-mono">{a.pct === null ? '–' : `${a.pct}%`}</td><td className="text-right font-mono">{a.absent}</td><td className="text-right font-mono">{a.late}</td></tr>; })}</tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted">Attendance is taken once a day per class, so it is the same for every subject ({teachers.join(', ') || 'no subjects on the timetable'}).</p>
        </Panel>
        <Panel title="Examination marks">
          {results.length === 0 ? <Empty>No published results.</Empty> : (
            <ul className="space-y-2 text-sm">
              {[...results].reverse().map((r) => (
                <li key={r.test.id}>
                  <div className="flex justify-between gap-2"><span>{r.test.title} <span className="text-xs text-muted">{formatDate(r.test.date, { day: 'numeric', month: 'short' })}{r.answers && Object.keys(r.answers).length ? ' · online' : ' · internal'}</span></span><span className="font-mono">{r.score}/{r.max} · {Math.round(r.pct)}% · rank {r.rank}/{r.of}</span></div>
                  {Object.keys(r.bySubject ?? {}).length > 0 && <p className="text-xs text-muted">{Object.entries(r.bySubject).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Only published results are shown. Marks still being entered are visible to the subject teacher and exam cell only.</p>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Homework">
          {hw.length === 0 ? <Empty>No homework for this class.</Empty> : (
            <ul className="space-y-1 text-sm">{hw.sort((a, b) => b.data.dueOn.localeCompare(a.data.dueOn)).slice(0, 8).map((h) => <li key={h.id} className="flex justify-between gap-2"><span>{h.data.subject}: {h.data.title}</span><span className="text-xs text-muted">due {formatDate(h.data.dueOn, { day: 'numeric', month: 'short' })}</span></li>)}</ul>
          )}
        </Panel>
        <Panel title="Assignments and study material">
          {mats.length === 0 ? <Empty>Nothing shared with this class yet.</Empty> : (
            <ul className="space-y-1 text-sm">{mats.slice(0, 8).map((m) => <li key={m.id}><span className="mr-1 rounded bg-bg px-1.5 py-0.5 text-[10px] uppercase">{m.kind}</span>{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="underline">{m.title}</a> : m.title} <span className="text-xs text-muted">· {m.subject}{m.dueDate ? ` · due ${formatDate(m.dueDate, { day: 'numeric', month: 'short' })}` : ''}</span></li>)}</ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Teacher remarks">
          {file.notes.length === 0 ? <Empty>No remarks{own ? '' : ' shared with the family'} yet.</Empty> : (
            <ul className="space-y-2 text-sm">{[...file.notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((n, i) => <li key={i}><span className="text-xs text-muted">{formatDate(n.date, { day: 'numeric', month: 'short' })} · {n.kind.replace('_', ' ')}{n.shareWithParent ? ' · shared with parent' : ' · private'}</span><p>{n.note}</p></li>)}</ul>
          )}
        </Panel>
        <Panel title="Parent communication (WhatsApp)">
          {parentMsgs.length === 0 ? <Empty>No messages to the parents yet.</Empty> : (
            <ul className="space-y-1 text-sm">{parentMsgs.map((m) => <li key={m.id}><span className="text-xs text-muted">{new Date(m.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {m.template.replace(/^bjc_/, '').replace(/_/g, ' ')} · {deliveryLabel(m)}</span><p className="line-clamp-2 text-xs">{m.body}</p></li>)}</ul>
          )}
        </Panel>
      </div>

      {own && can(user, 'mentor.notes') && (
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
        {own && can(user, 'discipline.record') && (
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
