import { requireEnrolled } from '@/lib/app/portal';
import { todayIST, weekday } from '@/lib/dates';
import { batchTimetable } from '@/lib/school/academics';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'Timetable' };
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function TimetablePage() {
  const { p } = await requireEnrolled();
  const b = await batchOf(p.studentId);
  const tt = b ? await batchTimetable(b.id) : [];
  const today = weekday(todayIST());
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Timetable{b ? ` · ${b.data.name}` : ''}</h1>
      {tt.length === 0 ? <p className="card p-4 text-sm text-muted">The timetable appears once the batch is allotted.</p> : DAYS.slice(1).map((d, i) => {
        const list = tt.filter((x) => x.day === i + 1);
        if (!list.length) return null;
        return (
          <section key={d} className={`card p-3 ${today === i + 1 ? 'ring-2 ring-gold' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{d}{today === i + 1 ? ' · today' : ''}</p>
            <ul className="mt-1 text-sm">{list.map((x) => <li key={x.id}><span className="font-mono">{x.start}–{x.end}</span> {x.subject}{x.room ? ` · ${x.room}` : ''}</li>)}</ul>
          </section>
        );
      })}
    </div>
  );
}
