import { createProgramAction, programAttendanceAction, toggleProgramAction } from '@/app/crm/studentlife-actions';
import { ActionForm, Submit } from '@/components/crm/forms';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { allBatches } from '@/lib/school/common';
import { kindLabel, programCalendar, staffPrograms } from '@/lib/studentLife/activities';
import { PROGRAM_KINDS, SPORTS, WEEKDAYS } from '@/lib/studentLife/collections';

export const metadata = { title: 'Yoga, wellness & practice timetable' };
export const dynamic = 'force-dynamic';

const day = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export default async function ActivitiesPage() {
  const user = await requireStaff('sports.view');
  const manage = can(user, 'sports.manage');
  const [list, cal, batches] = await Promise.all([staffPrograms(user), programCalendar(todayIST(), 7), allBatches()]);
  const audience = [{ value: 'all_students', label: 'All students' }, ...batches.map((b) => ({ value: `batch:${b.id}`, label: `Batch ${b.data.name}` }))];
  const audLabel = (a: string) => audience.find((x) => x.value === a)?.label ?? a;
  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Yoga, wellness & practice timetable</h1>
        <p className="text-sm text-muted">Weekly yoga, meditation, breathing, stress-relief, mindfulness, fitness and sports-practice classes. Students register in the app; instructors mark attendance per class. No health details are recorded.</p>
      </div>

      <Panel title="This week">
        {cal.length === 0 ? <Empty>No classes this week.</Empty> : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{cal.map((c, i) => <li key={i} className="rounded-lg border border-line p-2"><span className="text-xs text-muted">{day(c.date)} · {c.time}</span><span className="block font-medium text-heading">{c.title}</span><span className="text-xs text-muted">{kindLabel(c.kind)} · {c.venue ?? 'Campus'} · {c.instructor}</span></li>)}</ul>
        )}
      </Panel>

      {manage && (
        <Panel title="New program">
          <QuickForm action={createProgramAction} submit="Create program" cols={3} fields={[
            { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Morning yoga' },
            { name: 'kind', label: 'Type', type: 'select', required: true, options: PROGRAM_KINDS.map((k) => ({ value: k.value, label: k.label })) },
            { name: 'sport', label: 'Sport (for practice)', type: 'select', options: [{ value: '', label: '—' }, ...SPORTS.map((x) => ({ value: x, label: x }))] },
            { name: 'instructor', label: 'Instructor', type: 'text', required: true },
            { name: 'time', label: 'Time', type: 'time', required: true, defaultValue: '06:30' },
            { name: 'durationMin', label: 'Minutes', type: 'number', min: 10, max: 240, defaultValue: '45', required: true },
            { name: 'days', label: 'Days', type: 'checks', options: WEEKDAYS.map((d) => ({ value: d, label: cap(d) })), defaultValues: ['mon', 'wed', 'fri'], wide: true },
            { name: 'venue', label: 'Venue', type: 'text', placeholder: 'Yoga hall' },
            { name: 'audience', label: 'Audience', type: 'select', required: true, options: audience },
            { name: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 2000, defaultValue: '60', required: true },
            { name: 'startDate', label: 'Starts', type: 'date', required: true, defaultValue: todayIST() },
            { name: 'endDate', label: 'Ends (optional)', type: 'date' },
            { name: 'videoUrl', label: 'Practice video link (https, optional)', type: 'url' },
            { name: 'description', label: 'Description', type: 'textarea', wide: true, rows: 2 },
          ]} />
        </Panel>
      )}

      <Panel title={`Programs (${list.length})`}>
        {list.length === 0 ? <Empty>No programs yet.</Empty> : list.map((p) => (
          <details key={p.id} className="border-t border-line py-3 first:border-0">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium text-heading">{p.title}</span>{!p.active && <span className="ml-1 text-[10px] uppercase text-muted">paused</span>}
              <span className="block text-xs text-muted">{kindLabel(p.kind)}{p.sport ? ` · ${p.sport}` : ''} · {p.days.map(cap).join(', ')} {p.time} ({p.durationMin} min) · {p.venue ?? 'Campus'} · {p.instructor} · {audLabel(p.audience)} · {p.registered}/{p.capacity} registered · {p.held} classes held · average attendance {p.avgAttendance ?? '–'}%</span>
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="text-sm">
                {p.description && <p className="whitespace-pre-line">{p.description}</p>}
                {p.videoUrl && <p className="mt-1"><a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">Practice video</a></p>}
                {manage && <div className="mt-2"><ActionButton action={toggleProgramAction} label={p.active ? 'Pause program' : 'Resume program'} hidden={{ id: p.id, active: p.active ? '0' : '1' }} /></div>}
              </div>
              {manage && (p.recentDates.length === 0 ? <p className="text-sm text-muted">No classes due in the last two weeks.</p> : p.students.length === 0 ? <p className="text-sm text-muted">Nobody has registered yet.</p> : (
                <ActionForm action={programAttendanceAction} reset={false} className="text-sm">
                  <input type="hidden" name="programId" value={p.id} />
                  <label className="text-xs font-semibold uppercase text-muted">Class on <select name="date" className="input ml-1 inline w-auto py-1 text-sm">{p.recentDates.map((d) => <option key={d} value={d}>{day(d)}{p.presentOn[d] ? ` (${p.presentOn[d].length} marked)` : ''}</option>)}</select></label>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line p-2">{p.students.map((s) => <label key={s.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" name="present" value={s.id} defaultChecked={(p.presentOn[p.recentDates[0]] ?? []).includes(s.id)} className="accent-maroon" />{s.name}</label>)}</div>
                  <Submit className="btn-outline mt-2 py-1.5 text-sm">Save attendance</Submit>
                </ActionForm>
              ))}
            </div>
          </details>
        ))}
      </Panel>
    </div>
  );
}
