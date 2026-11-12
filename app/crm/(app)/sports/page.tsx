import { addAchievementAction, addFitnessAction, addFixtureAction, assignHouseAction, recordResultAction, sportsAttendanceForm } from '@/app/crm/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, todayIST } from '@/lib/dates';
import { FIXTURE_KINDS, HOUSES, MEDALS, SPORTS } from '@/lib/studentLife/collections';
import { coachOverview } from '@/lib/studentLife/sports';

export const metadata = { title: 'Sports' };
export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = { daily_games: 'Daily games', inter_house: 'Inter-house', sports_day: 'Sports Day', inter_college: 'Inter-college' };
const d = (x: string) => formatDate(x, { weekday: 'short', day: 'numeric', month: 'short' });

export default async function SportsPage() {
  const user = await requireStaff();
  if (!can(user, 'sports.manage') && !can(user, 'sports.view')) return <Panel title="Sports"><p className="text-sm text-muted">Your role doesn’t use the sports module.</p></Panel>;
  const o = await coachOverview(user);
  const manage = can(user, 'sports.manage');
  const teams = [...HOUSES.map((h) => ({ value: h.name, label: `${h.name} house` })), { value: 'BJC', label: 'BJC college team' }, { value: 'Opponent college', label: 'Another college' }];
  const studentOpts = o.students.map((s) => ({ value: s.id, label: `${s.name}${s.house ? ` · ${s.house}` : ''}` }));
  const today = todayIST();

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Sports & games</h1>
        <p className="text-sm text-muted">Daily games 5:30–6:30 PM · {o.students.length} students · {o.neverPlayed.length} haven’t played in 30 days</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="House points table">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">House</th><th>P</th><th>W</th><th>D</th><th>L</th><th className="text-right">Pts</th></tr></thead>
            <tbody>{o.table.map((r, i) => (
              <tr key={r.house} className="border-t border-line"><td className="py-1.5 font-semibold text-heading"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: HOUSES.find((h) => h.name === r.house)?.color }} />{i + 1}. {r.house}</td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td className="text-right font-mono font-semibold">{r.points}</td></tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Win 3 · draw 1 · loss 0 (inter-house and Sports Day).</p>
        </Panel>
        <Panel title="Houses">
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {o.houses.map((h) => <li key={h.id} className="rounded-lg border border-line p-2"><span className="font-semibold text-heading" style={{ color: h.color }}>{h.name}</span><span className="block text-xs text-muted">{h.studentIds.length} students</span></li>)}
          </ul>
          {manage && <div className="mt-3"><QuickForm action={assignHouseAction} submit="Assign house" cols={2} fields={[{ name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOpts }, { name: 'house', label: 'House', type: 'select', required: true, options: HOUSES.map((h) => ({ value: h.key, label: h.name })) }]} /></div>}
        </Panel>
      </div>

      <Panel title={`Upcoming fixtures (${o.upcoming.length})`}>
        {o.upcoming.length === 0 ? <Empty>No fixtures scheduled.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {o.upcoming.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span><span className="font-medium text-heading">{f.title}</span> · {f.sport} · {f.home} vs {f.away}<span className="block text-xs text-muted">{KIND_LABEL[f.kind]} · {d(f.date)}{f.time ? ` ${f.time}` : ''}{f.venue ? ` · ${f.venue}` : ''}</span></span>
                {manage && f.date <= today && (
                  <QuickForm action={recordResultAction} submit="Save result" cols={4} fields={[{ name: 'id', type: 'hidden', value: f.id }, { name: 'homeScore', label: f.home, type: 'text', required: true }, { name: 'awayScore', label: f.away, type: 'text', required: true }, { name: 'winner', label: 'Result', type: 'select', required: true, options: [{ value: 'home', label: `${f.home} won` }, { value: 'away', label: `${f.away} won` }, { value: 'draw', label: 'Draw' }] }]} />
                )}
              </li>
            ))}
          </ul>
        )}
        {manage && (
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-maroon dark:text-gold">Add a fixture</summary>
            <div className="mt-3"><QuickForm action={addFixtureAction} submit="Add fixture" cols={3} fields={[
              { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Inter-house volleyball, round 2' },
              { name: 'sport', label: 'Sport', type: 'select', required: true, options: SPORTS.map((s) => ({ value: s, label: s })) },
              { name: 'kind', label: 'Type', type: 'select', required: true, options: FIXTURE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] })) },
              { name: 'date', label: 'Date', type: 'date', required: true },
              { name: 'time', label: 'Time', type: 'time' },
              { name: 'venue', label: 'Venue', type: 'text' },
              { name: 'home', label: 'Team 1', type: 'select', required: true, options: teams },
              { name: 'away', label: 'Team 2', type: 'select', required: true, options: teams },
            ]} /></div>
          </details>
        )}
      </Panel>

      <Panel title={`Results (${o.played.length})`}>
        {o.played.length === 0 ? <Empty>No results yet.</Empty> : (
          <ul className="divide-y divide-line text-sm">{o.played.map((f) => <li key={f.id} className="py-2"><span className="font-medium text-heading">{f.title}</span> · {f.home} <span className="font-mono">{f.homeScore}</span> – <span className="font-mono">{f.awayScore}</span> {f.away}<span className="block text-xs text-muted">{d(f.date)} · {f.winner === 'draw' ? 'Draw' : `${f.winner === 'home' ? f.home : f.away} won`}</span></li>)}</ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Games attendance">
          {manage && (
            <form action={sportsAttendanceForm} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold uppercase text-muted">Date<input type="date" name="date" defaultValue={today} max={today} className="input mt-1 text-sm" required /></label>
                <label className="block text-xs font-semibold uppercase text-muted">Sport<select name="sport" className="input mt-1 py-2 text-sm">{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-line p-2 text-sm">
                {o.students.map((s) => <label key={s.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" name="present" value={s.id} className="accent-maroon" />{s.name}<span className="text-xs text-muted">{s.house}</span></label>)}
              </div>
              <button className="btn-primary py-2 text-sm">Save attendance</button>
            </form>
          )}
          <ul className="mt-3 divide-y divide-line text-sm">{o.attendance.map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{d(a.date)} · {a.sport}</span><span className="font-mono">{a.present.length} present</span></li>)}</ul>
        </Panel>
        <Panel title={`Not playing (30 days): ${o.neverPlayed.length}`}>
          <p className="mb-2 text-xs text-muted">Shown on the mentor view too, so mentors can encourage them.</p>
          {o.neverPlayed.length === 0 ? <Empty>Everyone played this month.</Empty> : <ul className="flex flex-wrap gap-1.5 text-xs">{o.neverPlayed.map((s) => <li key={s.id} className="rounded-full bg-surface px-2 py-1">{s.name}</li>)}</ul>}
          <p className="mt-4 text-xs font-semibold uppercase text-muted">Sign-ups</p>
          <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">{o.signups.map((x) => <li key={x.sport}>{x.sport}: <span className="font-mono">{x.n}</span></li>)}</ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Achievements (${o.achievements.length})`}>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">{o.achievements.map((a) => <li key={a.id} className="py-1.5"><span className="font-medium text-heading">{a.name}</span>: {a.medal} · {a.event}<span className="block text-xs text-muted">{a.title} · {d(a.date)}</span></li>)}</ul>
          {manage && <div className="mt-3"><QuickForm action={addAchievementAction} submit="Add achievement" cols={2} fields={[
            { name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOpts },
            { name: 'medal', label: 'Medal / certificate', type: 'select', required: true, options: MEDALS.map((m) => ({ value: m, label: m })) },
            { name: 'event', label: 'Event', type: 'text', required: true, placeholder: 'Inter-house badminton' },
            { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Singles runner-up' },
            { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today },
          ]} /></div>}
        </Panel>
        {manage && (
          <Panel title="Fitness check (twice a year)">
            <p className="mb-2 text-xs text-muted">Simple and private: the student, their parents and the coach see it. BMI is optional.</p>
            <QuickForm action={addFitnessAction} submit="Save" cols={2} fields={[
              { name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOpts },
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today },
              { name: 'run', label: '600 m run (seconds)', type: 'number', min: 60, max: 900 },
              { name: 'reach', label: 'Sit-and-reach (cm)', type: 'number', min: -30, max: 60 },
              { name: 'bmi', label: 'BMI (optional, private)', type: 'number', min: 10, max: 50, step: 0.1 },
            ]} />
          </Panel>
        )}
      </div>
    </div>
  );
}
