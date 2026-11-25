import { challengeFor, housePoints, leaderboard, type Board, type Period } from '@/lib/openbook/challenge';
import { obStudent } from '@/lib/openbook/session';
import { ChallengeSet } from './ChallengeSet';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ChallengePage({ searchParams }: { searchParams: { board?: Board; period?: Period; scope?: 'batch' | 'college' } }) {
  const me = await obStudent();
  const board = searchParams.board ?? 'effort', period = searchParams.period ?? 'weekly', scope = searchParams.scope ?? 'batch';
  const [c, lb, houses] = await Promise.all([challengeFor(me.studentId).catch((e: Error) => ({ error: e.message }) as const), leaderboard(me.studentId, scope, board, period), housePoints()]);
  const q = (p: Record<string, string>) => '?' + new URLSearchParams({ board, period, scope, ...p }).toString();
  return (
    <div className="space-y-4">
      <H1 sub="5 questions per subject, the same for your whole batch. Open 6 AM–11 PM.">Daily Challenge</H1>
      {'error' in c ? <p className="card p-3 text-sm">{c.error}</p> : (
        <>
          <p className="text-sm">🔥 Streak: <b>{c.streak}</b> day{c.streak === 1 ? '' : 's'} · {c.date}{!c.open && ' · closed now (opens at 6 AM)'}</p>
          {Object.entries(c.sets).map(([subject, qs]) => {
            const done = c.done.find((d) => d.subject === subject);
            return (
              <details key={subject} className="card p-3" open={!done && c.open}>
                <summary className="cursor-pointer text-sm font-semibold text-heading">{subject} {done ? `· ✅ ${done.correct}/${done.total} · +${done.xp} XP` : `· ${qs.length} questions`}</summary>
                {!done && c.open && qs.length > 0 && <div className="mt-3"><ChallengeSet subject={subject} questions={qs} /></div>}
                {!qs.length && <p className="mt-2 text-sm text-muted">No approved {subject} questions in the bank yet.</p>}
              </details>
            );
          })}
        </>
      )}
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold text-heading">Leaderboard</h2>
        <div className="flex flex-wrap gap-1">{(['effort', 'score', 'streak'] as const).map((b) => <a key={b} href={q({ board: b })} className={b === board ? 'chip chip-active' : 'chip'}>{b === 'effort' ? 'Questions practised' : b === 'score' ? 'Challenge XP' : 'Streaks'}</a>)}</div>
        <div className="flex flex-wrap gap-1">{(['daily', 'weekly', 'monthly'] as const).map((p) => <a key={p} href={q({ period: p })} className={p === period ? 'chip chip-active' : 'chip'}>{p}</a>)}{(['batch', 'college'] as const).map((s) => <a key={s} href={q({ scope: s })} className={s === scope ? 'chip chip-active' : 'chip'}>{s === 'batch' ? 'My batch' : 'Whole college'}</a>)}</div>
        {lb.top.length ? <ol className="space-y-0.5">{lb.top.map((r) => <li key={r.rank} className={r.me ? 'font-semibold text-navy dark:text-gold' : ''}>{r.rank}. {r.name} · {r.value} {lb.unit}</li>)}</ol> : <p className="text-muted">No one on this board yet.</p>}
        {lb.me && <p className="text-xs">Your position: <b>#{lb.me.rank}</b> of {lb.me.of} ({lb.me.value} {lb.unit})</p>}
        {lb.encouragement && <p className="rounded bg-bg p-2 text-xs">{lb.encouragement}</p>}
        <p className="text-[11px] text-muted">Only the top 10 and your own position are shown. Students who opted out appear as “Hidden”. Change your nickname or opt out on the Open Book home page.</p>
      </section>
      <section className="card p-4 text-sm"><h2 className="mb-1 font-semibold text-heading">House points this week</h2><ul>{houses.map((h) => <li key={h.name} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: h.color }} />{h.name}: {h.points}</li>)}</ul></section>
    </div>
  );
}
