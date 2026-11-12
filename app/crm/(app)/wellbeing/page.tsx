import { alertStatusForm, answerAnonAction, bookingStatusForm, counsellorNoteAction, flagForm, removeHelplineForm, saveHelplineAction } from '@/app/crm/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, formatDateTime } from '@/lib/dates';
import { helplines as helplineRows } from '@/lib/studentLife/collections';
import { store } from '@/lib/school/common';
import { counsellorDashboard, counsellorStudent, listHelplines, openAlerts, trends } from '@/lib/studentLife/wellbeing';

export const metadata = { title: 'Wellbeing' };
export const dynamic = 'force-dynamic';

const d = (x: string) => formatDate(x, { day: 'numeric', month: 'short' });
const cellTone = (v: number | null) => (v === null ? 'text-muted' : v >= 3.5 ? 'bg-maroon/15 font-semibold text-maroon dark:text-red-300' : v >= 2.8 ? 'bg-gold/20' : 'bg-emerald-500/10');

export default async function WellbeingPage({ searchParams }: { searchParams: { student?: string } }) {
  const user = await requireStaff();
  const counsel = can(user, 'wellbeing.counsel');
  const trendsOk = can(user, 'wellbeing.trends');
  if (!counsel && !trendsOk) return <Panel title="Wellbeing"><p className="text-sm text-muted">Wellbeing data is private. Mentors see a “needs a conversation” flag on the Mentoring page; check-ins and notes are for the Student Counsellor only.</p></Panel>;

  const [alerts, t, lines, editable] = await Promise.all([openAlerts(user), trends(user), listHelplines(), can(user, 'wellbeing.helplines') ? helplineRows.list(store()) : Promise.resolve([])]);
  const dash = counsel ? await counsellorDashboard(user) : null;
  const file = counsel && searchParams.student ? await counsellorStudent(user, searchParams.student) : null;
  const fileName = dash?.students.find((s) => s.id === searchParams.student)?.name;

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">{counsel ? 'Counsellor dashboard' : 'Wellbeing: anonymous trends'}</h1>
        <p className="text-sm text-muted">{counsel ? 'Private: only the Student Counsellor sees check-ins, notes, bookings and questions. Every view is logged.' : 'College-wide and anonymous: averages by batch and week, never names or notes. Cells with fewer than 3 check-ins are hidden.'}</p>
      </div>

      <Panel title={`Safety alerts (${alerts.length} open)`}>
        {alerts.length === 0 ? <Empty>No open alerts.</Empty> : (
          <ul className="divide-y divide-line text-sm">{alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
              <span><span className="rounded bg-maroon px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white">{a.status}</span> <span className="font-medium text-heading">{a.student}</span> · {a.source.replace('_', ' ')} · {formatDateTime(a.at)}{a.excerpt && <span className="mt-1 block text-xs text-muted">“{a.excerpt}”</span>}</span>
              <span className="flex gap-2">
                {a.status === 'open' && <form action={alertStatusForm}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="acknowledged" /><button className="btn-outline py-1 text-xs">I’m on it</button></form>}
                <form action={alertStatusForm}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="closed" /><button className="text-xs underline">Close</button></form>
              </span>
            </li>
          ))}</ul>
        )}
        <p className="mt-2 text-xs text-muted">Protocol: contact the student the same day, in person; involve parents if there is a safety need; record a private note. The AI chat never counsels: it hands over and shows the helpline.</p>
      </Panel>

      {dash && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={`High stress 2+ weeks (${dash.highStress.length})`}>
              {dash.highStress.length === 0 ? <Empty>No one.</Empty> : <ul className="divide-y divide-line text-sm">{dash.highStress.map((h) => <li key={h.studentId} className="flex justify-between py-1.5"><a href={`/crm/wellbeing?student=${h.studentId}`} className="font-medium text-heading underline">{h.name}</a><span className="font-mono">{h.stress.join(' → ')}/5</span></li>)}</ul>}
            </Panel>
            <Panel title={`Flagged “needs a conversation” (${dash.flagged.length})`}>
              {dash.flagged.length === 0 ? <Empty>No flags.</Empty> : <ul className="divide-y divide-line text-sm">{dash.flagged.map((f) => <li key={f.studentId} className="flex items-center justify-between py-1.5"><a href={`/crm/wellbeing?student=${f.studentId}`} className="underline">{f.name}</a><form action={flagForm}><input type="hidden" name="studentId" value={f.studentId} /><input type="hidden" name="status" value="resolved" /><button className="text-xs underline">Resolve</button></form></li>)}</ul>}
              <p className="mt-2 text-xs text-muted">The mentor sees only this flag, never the reason or notes.</p>
            </Panel>
          </div>

          <Panel title={`Bookings (${dash.bookings.length})`}>
            {dash.bookings.length === 0 ? <Empty>No bookings.</Empty> : <ul className="divide-y divide-line text-sm">{dash.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span><span className="font-medium text-heading">{b.name}</span> · {d(b.date)} {b.time} · {b.mode === 'call' ? 'call' : 'in person'} · <span className="uppercase text-[11px]">{b.status}</span>{b.topic && <span className="block text-xs text-muted">{b.topic}</span>}</span>
                <span className="flex gap-2">{(['confirmed', 'done', 'cancelled'] as const).filter((x) => x !== b.status).map((x) => <form key={x} action={bookingStatusForm}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={x} /><button className="text-xs underline">{x}</button></form>)}</span></li>
            ))}</ul>}
          </Panel>

          <Panel title={`Anonymous questions (${dash.questions.filter((q) => !q.answer).length} open)`}>
            {dash.questions.length === 0 ? <Empty>No questions.</Empty> : <ul className="divide-y divide-line text-sm">{dash.questions.map((q) => (
              <li key={q.id} className="py-2"><p className="text-heading">“{q.text}”</p>{q.answer ? <p className="mt-1 text-muted">Answered: {q.answer}</p> : <div className="mt-2"><QuickForm action={answerAnonAction} submit="Answer" cols={1} fields={[{ name: 'id', type: 'hidden', value: q.id }, { name: 'answer', label: 'Your answer (shown only to whoever asked)', type: 'textarea', required: true }]} /></div>}</li>
            ))}</ul>}
          </Panel>

          <Panel title={file ? `Private file: ${fileName ?? 'Student'}` : 'Open a student’s private file'}>
            <form className="mb-3 flex gap-2"><select name="student" defaultValue={searchParams.student ?? ''} className="input py-2 text-sm">{[{ id: '', name: 'Pick a student', collegeId: null }, ...dash.students].map((s) => <option key={s.id} value={s.id}>{s.name}{s.collegeId ? ` · ${s.collegeId}` : ''}</option>)}</select><button className="btn-outline py-1.5 text-sm">Open</button></form>
            {file && searchParams.student && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div><p className="mb-1 text-xs font-semibold uppercase text-muted">Check-ins</p>{file.checks.length === 0 ? <Empty>None.</Empty> : <ul className="divide-y divide-line text-sm">{file.checks.map((c) => <li key={c.id} className="py-1">Week of {d(c.weekStart)}: mood {c.mood}/5 · stress {c.stress}/5 · sleep {c.sleepHours} h{c.note && <span className="block text-xs text-muted">“{c.note}”</span>}</li>)}</ul>}</div>
                <div><p className="mb-1 text-xs font-semibold uppercase text-muted">Counsellor notes</p><ul className="mb-2 divide-y divide-line text-sm">{file.notes.map((n, i) => <li key={i} className="py-1">{d(n.date)}: {n.note}</li>)}</ul>
                  <QuickForm action={counsellorNoteAction} submit="Add private note" cols={1} fields={[{ name: 'studentId', type: 'hidden', value: searchParams.student }, { name: 'note', label: 'Note (counsellor only)', type: 'textarea', required: true }]} />
                  <form action={flagForm} className="mt-2"><input type="hidden" name="studentId" value={searchParams.student} /><input type="hidden" name="status" value="needs_conversation" /><button className="text-xs underline">Flag “needs a conversation” for the mentor</button></form>
                </div>
              </div>
            )}
          </Panel>
        </>
      )}

      <Panel title="Average stress by batch and week (1 calm – 5 very stressed)">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1">Batch</th>{t.weeks.map((w) => <th key={w} className="px-1 text-center">{d(w)}</th>)}</tr></thead>
          <tbody>
            {t.byBatch.map((b) => <tr key={b.batch} className="border-t border-line"><td className="py-1.5 text-heading">{b.batch}</td>{b.values.map((v, i) => <td key={i} className={`px-1 text-center font-mono ${cellTone(v)}`}>{v ?? '–'}</td>)}</tr>)}
            <tr className="border-t-2 border-line font-semibold"><td className="py-1.5">College</td>{t.overall.map((v, i) => <td key={i} className={`px-1 text-center font-mono ${cellTone(v)}`}>{v ?? '–'}</td>)}</tr>
            <tr className="text-xs text-muted"><td className="py-1">Check-ins</td>{t.participation.map((n, i) => <td key={i} className="text-center">{n}</td>)}</tr>
          </tbody>
        </table></div>
        <p className="mt-2 text-xs text-muted">Watch the weeks before mock tests and exams. Optional check-ins: participation varies.</p>
      </Panel>

      <Panel title="Helplines shown to students">
        <ul className="text-sm">{lines.map((h) => <li key={h.name} className="py-0.5"><span className="font-medium text-heading">{h.name}</span>: <span className="font-mono">{h.number}</span>{h.hours ? ` · ${h.hours}` : ''}{h.note ? <span className="block text-xs text-muted">{h.note}</span> : null}</li>)}</ul>
        <p className="mt-1 text-xs text-maroon dark:text-gold">Verify every number before launch.</p>
        {can(user, 'wellbeing.helplines') && (
          <div className="mt-3 space-y-2">
            {editable.map((h) => <form key={h.id} action={removeHelplineForm} className="flex items-center justify-between text-xs"><input type="hidden" name="id" value={h.id} /><span>{h.data.name} · {h.data.number}</span><button className="underline">Remove</button></form>)}
            <QuickForm action={saveHelplineAction} submit="Add helpline" cols={2} fields={[{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'number', label: 'Number', type: 'text', required: true }, { name: 'hours', label: 'Hours', type: 'text' }, { name: 'note', label: 'Note', type: 'text' }]} />
          </div>
        )}
      </Panel>
    </div>
  );
}
