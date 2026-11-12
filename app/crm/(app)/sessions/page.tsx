import { addSpeakerAction, createSessionAction, sessionAttendanceForm, setRecordingAction } from '@/app/crm/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { allBatches } from '@/lib/school/common';
import { SESSION_TYPES } from '@/lib/studentLife/collections';
import { allSpeakers, staffSessions, typeLabel } from '@/lib/studentLife/sessions';

export const metadata = { title: 'Speaker sessions' };
export const dynamic = 'force-dynamic';

const d = (x: string) => formatDate(x, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default async function SessionsPage() {
  const user = await requireStaff();
  if (!can(user, 'sessions.manage') && !can(user, 'academics.view')) return <Panel title="Speaker sessions"><p className="text-sm text-muted">Your role doesn’t manage sessions.</p></Panel>;
  const manage = can(user, 'sessions.manage');
  const [list, speakers, batches] = await Promise.all([staffSessions(user), allSpeakers(), allBatches()]);
  const upcoming = list.filter((s) => !s.past);
  const past = list.filter((s) => s.past).reverse();
  const audience = [{ value: 'all_students', label: 'All students' }, { value: 'parents', label: 'Parents' }, ...batches.map((b) => ({ value: `batch:${b.id}`, label: `Batch ${b.data.name}` }))];
  const audLabel = (a: string) => audience.find((x) => x.value === a)?.label ?? a;

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Motivational speakers & sessions</h1>
        <p className="text-sm text-muted">{upcoming.length} upcoming · {past.length} held · new sessions go on the Events calendar and in Notices automatically; registered families get a WhatsApp reminder the day before.</p>
      </div>

      {manage && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Schedule a session">
            <QuickForm action={createSessionAction} submit="Schedule" cols={2} fields={[
              { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
              { name: 'type', label: 'Type', type: 'select', required: true, options: SESSION_TYPES.map((t) => ({ value: t.value, label: t.label })) },
              { name: 'speakerId', label: 'Speaker', type: 'select', options: [{ value: '', label: '(none / staff)' }, ...speakers.map((s) => ({ value: s.id, label: `${s.name}${s.sample ? ' (sample)' : ''}` }))] },
              { name: 'date', label: 'Date', type: 'date', required: true },
              { name: 'time', label: 'Time', type: 'time', required: true },
              { name: 'venue', label: 'Venue', type: 'text', placeholder: 'Seminar hall' },
              { name: 'onlineUrl', label: 'Online link (optional)', type: 'url' },
              { name: 'audience', label: 'Audience', type: 'select', required: true, options: audience },
              { name: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 5000, defaultValue: '150', required: true },
              { name: 'summary', label: 'Short description', type: 'textarea', wide: true },
            ]} />
          </Panel>
          <Panel title={`Speakers (${speakers.length})`}>
            <ul className="mb-3 max-h-48 divide-y divide-line overflow-y-auto text-sm">{speakers.map((s) => <li key={s.id} className="py-1.5"><span className="font-medium text-heading">{s.name}</span>{s.sample && <span className="ml-1 text-[10px] uppercase text-muted">sample</span>}<span className="block text-xs text-muted">{s.background} · {s.topic}{s.fee ? ` · ₹${s.fee.toLocaleString('en-IN')}` : ''}</span></li>)}</ul>
            <QuickForm action={addSpeakerAction} submit="Add speaker" cols={2} fields={[
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'background', label: 'Background', type: 'text', required: true, placeholder: 'IIT Bombay alumnus, engineer' },
              { name: 'topic', label: 'Topic', type: 'text', required: true },
              { name: 'contact', label: 'Contact', type: 'text' },
              { name: 'fee', label: 'Fee (₹)', type: 'number', min: 0 },
            ]} />
          </Panel>
        </div>
      )}

      <Panel title="Upcoming">
        {upcoming.length === 0 ? <Empty>Nothing scheduled.</Empty> : (
          <ul className="divide-y divide-line text-sm">{upcoming.map((s) => (
            <li key={s.id} className="py-2"><span className="font-medium text-heading">{s.title}</span>{s.sample && <span className="ml-1 text-[10px] uppercase text-muted">sample</span>}
              <span className="block text-xs text-muted">{typeLabel(s.type)} · {d(s.date)} {s.time} · {s.venue ?? 'Online'} · {audLabel(s.audience)} · {s.regs.length}/{s.capacity} registered{s.speaker ? ` · ${s.speaker.name}` : ''}</span>
            </li>
          ))}</ul>
        )}
      </Panel>

      <Panel title="Held: attendance, feedback and the Principal’s summary">
        {past.length === 0 ? <Empty>No sessions held yet.</Empty> : past.map((s) => (
          <details key={s.id} className="border-t border-line py-3 first:border-0">
            <summary className="cursor-pointer text-sm"><span className="font-medium text-heading">{s.title}</span> · {d(s.date)} · attendance {s.report.attendancePct ?? '–'}% · rating {s.report.avgRating ?? '–'}/5 ({s.report.feedbackCount})</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg bg-surface p-3 text-sm">
                <p className="font-semibold text-heading">Auto-summary for the Principal</p>
                <p className="mt-1">{s.report.attended} of {s.report.registered} registered attended ({s.report.attendancePct ?? '–'}%). Average rating {s.report.avgRating ?? '–'}/5 from {s.report.feedbackCount} responses.</p>
                {s.report.topComments.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{s.report.topComments.map((c, i) => <li key={i}>“{c}”</li>)}</ul>}
                {s.recordingPath ? <p className="mt-2 text-xs">Recording: <span className="font-mono">{s.recordingPath}</span></p> : manage && <div className="mt-2"><QuickForm action={setRecordingAction} submit="Save recording link" cols={1} fields={[{ name: 'sessionId', type: 'hidden', value: s.id }, { name: 'path', label: 'Private storage path or link', type: 'text', required: true }]} /></div>}
              </div>
              {manage ? (
                <form action={sessionAttendanceForm} className="text-sm">
                  <input type="hidden" name="sessionId" value={s.id} />
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">Attendance (list; QR check-in is the same list)</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-line p-2">{s.regs.map((r) => <label key={r.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" name="present" value={r.who} defaultChecked={r.attended} className="accent-maroon" />{r.name}</label>)}</div>
                  <button className="btn-outline mt-2 py-1.5 text-sm">Save attendance</button>
                </form>
              ) : <p className="text-sm text-muted">{s.regs.length} registered.</p>}
            </div>
          </details>
        ))}
      </Panel>
      <p className="text-xs text-muted">Today is {d(todayIST())}. Alumni sessions: invite alumni who offered to mentor from the Alumni page.</p>
    </div>
  );
}
