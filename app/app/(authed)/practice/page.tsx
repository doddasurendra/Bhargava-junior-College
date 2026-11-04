import Link from 'next/link';
import { setGoalAction } from '@/app/app/practice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDateTime } from '@/lib/dates';
import { chaptersOf, SUBJECTS, type Difficulty, type Subject } from '@/lib/practice/bank';
import { attemptsOf, reportsForStudent, startSession, studentPractice } from '@/lib/practice/service';
import { PracticeForm } from './PracticeForm';

export const metadata = { title: 'Practice' };
export const dynamic = 'force-dynamic';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

export default async function PracticePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { p } = await requireEnrolled();
  const data = await studentPractice(p.studentId);
  const reports = await reportsForStudent(p.studentId);
  const s = data.summary;
  const pct = s.nextLevelXp ? Math.min(100, Math.round((s.xp / s.nextLevelXp) * 100)) : 0;

  const Stats = (
    <section className="card grid grid-cols-4 gap-2 p-4 text-center text-sm">
      <div><p className="font-mono text-xl text-heading">{s.level}</p><p className="text-[11px] text-muted">Level</p></div>
      <div><p className="font-mono text-xl text-heading">{s.xp}</p><p className="text-[11px] text-muted">XP</p></div>
      <div><p className="font-mono text-xl text-heading">{s.streak}🔥</p><p className="text-[11px] text-muted">Day streak</p></div>
      <div><p className="font-mono text-xl text-heading">{s.accuracy ?? '–'}{s.accuracy !== null ? '%' : ''}</p><p className="text-[11px] text-muted">Accuracy</p></div>
      <div className="col-span-4 mt-1">
        <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-[11px] text-muted">{s.xp} / {s.nextLevelXp} XP to level {s.level + 1}</p>
      </div>
    </section>
  );

  // Parent view: progress, badges, weak chapters and reports the teacher shared.
  if (p.kind === 'parent') {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl text-heading">Practice progress</h1>
        {Stats}
        <section className="card p-4 text-sm">
          <p className="font-semibold text-heading">Badges</p>
          <p className="mt-1">{data.badges.length ? data.badges.map((b) => b.label).join(' · ') : 'No badges yet.'}</p>
          {data.weak.length > 0 && <p className="mt-2 text-muted">Needs practice: {data.weak.map((w) => `${w.chapter} (${w.accuracy}%)`).join(', ')}</p>}
        </section>
        <section className="card p-4 text-sm">
          <p className="font-semibold text-heading">Reports from teachers</p>
          {reports.length === 0 ? <p className="mt-1 text-muted">No reports shared yet.</p> : reports.map((r, i) => <p key={i} className="mt-2"><span className="text-[11px] text-muted">{formatDateTime(r.at)}</span><br />{r.text}</p>)}
        </section>
      </div>
    );
  }

  // Student: a session in progress (from filters or a weekly program item), or the practice home.
  const chapterSubject = searchParams.chapter ? SUBJECTS.find((x) => chaptersOf(x).includes(searchParams.chapter!)) ?? null : null;
  const subject = chapterSubject ?? (SUBJECTS.includes(searchParams.subject as Subject) ? (searchParams.subject as Subject) : null);
  const chapter = chapterSubject ? searchParams.chapter! : null;
  const difficulty = DIFFS.includes(searchParams.difficulty as Difficulty) ? (searchParams.difficulty as Difficulty) : null;
  const set = searchParams.set ? data.program.find((x) => x.id === searchParams.set) ?? null : null;
  if (searchParams.go === '1' || set) {
    const solved = new Set((await attemptsOf(p.studentId)).filter((a) => a.correct).map((a) => a.questionId));
    const qs = set
      ? startSession(p.studentId, solved, { subject: set.subject as Subject, chapter: set.chapter, difficulty: set.difficulty, count: Math.min(set.count, 10) })
      : startSession(p.studentId, solved, { subject, chapter, difficulty });
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h1 className="font-display text-2xl text-heading">Practice</h1><Link href="/app/practice" className="text-xs underline">Back</Link></div>
        <p className="text-xs text-muted">{set ? `This week: ${set.chapter} (${set.difficulty})` : [subject ?? 'All subjects', chapter, difficulty].filter(Boolean).join(' · ')}</p>
        <PracticeForm setId={set?.id ?? null} questions={qs.map((q) => ({ id: q.id, stem: q.stem, options: q.options, chapter: q.chapter, difficulty: q.difficulty }))} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Practice</h1>
      {Stats}
      {data.badges.length > 0 && <p className="text-xs text-muted">Badges: {data.badges.map((b) => b.label).join(' · ')}</p>}

      <section className="card p-4 text-sm">
        <p className="font-semibold text-heading">This week’s program{data.batch ? ` · ${data.batch}` : ''}</p>
        {data.program.length === 0 ? <p className="mt-1 text-muted">Your teacher hasn’t set this week’s program yet. Practise any chapter below.</p> : (
          <ul className="mt-2 space-y-1.5">
            {data.program.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span>{x.subject} · {x.chapter} <span className="text-[11px] text-muted">({x.difficulty}, {x.done} done)</span></span>
                <Link href={`/app/practice?set=${x.id}`} className="btn-outline px-3 py-1 text-xs">Start</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 text-sm">
        <p className="mb-2 font-semibold text-heading">Practise a chapter</p>
        <form method="get" className="grid gap-2">
          <input type="hidden" name="go" value="1" />
          <select name="subject" defaultValue={subject ?? ''} className="input"><option value="">Any subject</option>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
          <select name="chapter" defaultValue={chapter ?? ''} className="input">
            <option value="">Any chapter</option>
            {SUBJECTS.map((x) => <optgroup key={x} label={x}>{chaptersOf(x).map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
          </select>
          <select name="difficulty" defaultValue={difficulty ?? ''} className="input"><option value="">Any level</option>{DIFFS.map((d) => <option key={d}>{d}</option>)}</select>
          <button className="btn-primary">Start 5 questions</button>
        </form>
        <p className="mt-2 text-[11px] text-muted">Easy 5 XP, medium 10, hard 15 per correct answer. Practise every day to keep your streak.</p>
      </section>

      <section className="card p-4 text-sm">
        <p className="font-semibold text-heading">Weekly goal</p>
        {data.goal ? (
          <p className="mt-1">{data.goal.done}/{data.goal.questions} questions {data.goal.questionsMet ? '✓' : ''} · accuracy {data.goal.accuracyNow}% (target {data.goal.accuracy}%) {data.goal.accuracyMet ? '✓' : ''}</p>
        ) : <p className="mt-1 text-muted">No goal for this week yet.</p>}
        <div className="mt-2">
          <QuickForm action={setGoalAction} submit="Save goal" reset={false} fields={[
            { name: 'questions', label: 'Questions this week', type: 'number', min: 5, max: 500, defaultValue: String(data.goal?.questions ?? 50), required: true },
            { name: 'accuracy', label: 'Target accuracy %', type: 'number', min: 10, max: 100, defaultValue: String(data.goal?.accuracy ?? 70), required: true },
          ]} />
        </div>
      </section>

      {data.weak.length > 0 && (
        <section className="card p-4 text-sm">
          <p className="font-semibold text-heading">Work on these</p>
          <ul className="mt-1 space-y-1">{data.weak.map((w) => <li key={w.chapter}>{w.chapter} · {w.accuracy}%</li>)}</ul>
        </section>
      )}

      <section className="card p-4 text-sm">
        <p className="font-semibold text-heading">Class leaderboard (this week)</p>
        {data.leaderboard.length === 0 ? <p className="mt-1 text-muted">Be the first on the board.</p> : (
          <ol className="mt-1 space-y-1">{data.leaderboard.map((r, i) => <li key={i} className={`flex justify-between ${r.me ? 'font-semibold text-heading' : ''}`}><span>{i + 1}. {r.name}{r.me ? ' (you)' : ''}</span><span className="font-mono">{r.xp} XP</span></li>)}</ol>
        )}
      </section>
    </div>
  );
}
