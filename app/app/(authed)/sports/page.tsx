import { signUpSportForm } from '@/app/app/studentlife-actions';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { SPORTS } from '@/lib/studentLife/collections';
import { studentSports } from '@/lib/studentLife/sports';

export const metadata = { title: 'Sports & games' };

const KIND: Record<string, string> = { daily_games: 'Games period', inter_house: 'Inter-house', sports_day: 'Sports Day', inter_college: 'Inter-college' };
const MEDAL: Record<string, string> = { gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze', certificate: '📜 Certificate', participation: '🎽 Participation' };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default async function SportsPage() {
  const { p } = await requireEnrolled();
  const d = await studentSports(p.studentId);
  const student = p.kind === 'student';
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Sports & games</h1>

      <section className="card flex items-center gap-3 p-4">
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-full" style={{ background: d.house?.color ?? '#999' }} />
        <div className="text-sm">
          <p className="font-semibold text-heading">{d.house ? `${d.house.name} House` : 'House not assigned yet'}</p>
          <p className="text-muted">{d.sessions30} games periods in the last 30 days · {d.xp} sports XP</p>
        </div>
      </section>

      {d.sportsDay && (
        <section className="card p-4 text-sm">
          <p className="font-semibold text-heading">Sports Day: {formatDate(d.sportsDay.date)}</p>
          <p className="text-muted">{d.sportsDay.title}{d.sportsDay.venue ? ` · ${d.sportsDay.venue}` : ''}</p>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-2 font-semibold text-heading">House points table</p>
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] text-muted"><tr><th>House</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">Pts</th></tr></thead>
          <tbody>
            {d.table.map((r) => (
              <tr key={r.house} className={d.house?.name === r.house ? 'font-semibold text-heading' : ''}>
                <td>{r.house}</td><td className="text-right font-mono">{r.played}</td><td className="text-right font-mono">{r.won}</td><td className="text-right font-mono">{r.drawn}</td><td className="text-right font-mono">{r.lost}</td><td className="text-right font-mono">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <p className="mb-2 font-semibold text-heading">Coming up</p>
        {d.upcoming.length ? (
          <ul className="divide-y divide-line text-sm">
            {d.upcoming.map((f) => (
              <li key={f.id} className="py-2"><p className="font-medium">{f.title}</p><p className="text-[11px] text-muted">{KIND[f.kind]} · {f.sport} · {formatDate(f.date)}{f.time ? ` ${f.time}` : ''}{f.venue ? ` · ${f.venue}` : ''} · {f.home} vs {f.away}</p></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No fixtures scheduled.</p>}
      </section>

      {d.results.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 font-semibold text-heading">Recent results</p>
          <ul className="divide-y divide-line text-sm">
            {d.results.map((f) => (
              <li key={f.id} className="py-2"><p className="font-medium">{f.home} {f.homeScore ?? ''} – {f.awayScore ?? ''} {f.away}</p><p className="text-[11px] text-muted">{f.sport} · {formatDate(f.date)} · {f.winner === 'draw' ? 'Draw' : `${f.winner === 'home' ? f.home : f.away} won`}</p></li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-2 font-semibold text-heading">Achievements</p>
        {d.achievements.length ? (
          <ul className="space-y-1 text-sm">{d.achievements.map((a, i) => <li key={i}>{MEDAL[a.medal]} · {a.title} <span className="text-[11px] text-muted">({a.event}, {formatDate(a.date)})</span></li>)}</ul>
        ) : <p className="text-sm text-muted">No medals or certificates yet. Every games period counts!</p>}
      </section>

      {d.fitness && (
        <section className="card p-4 text-sm">
          <p className="mb-1 font-semibold text-heading">Fitness check ({formatDate(d.fitness.date)})</p>
          <ul className="space-y-0.5">
            {d.fitness.run600mSec != null && <li>600 m run: <span className="font-mono">{mmss(d.fitness.run600mSec)}</span></li>}
            {d.fitness.sitReachCm != null && <li>Sit and reach: <span className="font-mono">{d.fitness.sitReachCm} cm</span></li>}
            {d.fitness.bmi != null && <li>BMI: <span className="font-mono">{d.fitness.bmi}</span> <span className="text-[11px] text-muted">(private: only you, your parents and the coach see this)</span></li>}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-1 font-semibold text-heading">{student ? 'Sign up for a sport' : 'Sports your child signed up for'}</p>
        {student && <p className="mb-2 text-xs text-muted">Tap to join or leave. The coach uses this to plan teams.</p>}
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((sp) => {
            const on = d.signups.includes(sp);
            return student ? (
              <form key={sp} action={signUpSportForm}>
                <input type="hidden" name="sport" value={sp} />
                <button className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-maroon bg-maroon text-white dark:border-gold dark:bg-gold dark:text-navy' : 'border-line'}`} aria-pressed={on}>{on ? '✓ ' : ''}{sp}</button>
              </form>
            ) : on ? <span key={sp} className="rounded-full border border-line px-3 py-1 text-xs">{sp}</span> : null;
          })}
          {!student && d.signups.length === 0 && <p className="text-sm text-muted">None yet.</p>}
        </div>
      </section>
    </div>
  );
}
