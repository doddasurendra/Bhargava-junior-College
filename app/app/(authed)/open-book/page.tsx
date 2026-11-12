import Link from 'next/link';
import { bigAnswerAction, startOpenBookForm } from '@/app/app/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDateTime } from '@/lib/dates';
import { AI_POLICY, bigQuestionBoard, CLOSED_BOOK_NOTE, featuredXp, studentAssignments } from '@/lib/studentLife/openbook';
import { resourceList } from '@/lib/studentLife/openbookLogic';

export const metadata = { title: 'Open-book learning' };

export default async function OpenBookPage({ searchParams }: { searchParams: { error?: string } }) {
  const { p } = await requireEnrolled();
  const student = p.kind === 'student';
  const [list, board, xp] = await Promise.all([studentAssignments(p.studentId), bigQuestionBoard(), featuredXp(p.studentId)]);
  const now = new Date().toISOString();
  const current = board.filter((q) => q.current);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Open-book learning</h1>
      <p className="rounded-lg bg-bg p-3 text-xs text-muted">{CLOSED_BOOK_NOTE}</p>
      {searchParams.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{searchParams.error}</p>}

      <section className="space-y-2">
        <p className="font-semibold text-heading">Assignments</p>
        {list.length === 0 && <p className="card p-3 text-sm text-muted">No open-book assignments yet.</p>}
        {list.map((a) => {
          const open = now >= a.opensAt && now <= a.closesAt;
          const at = a.attempt;
          return (
            <article key={a.id} className="card p-4 text-sm">
              <p className="font-semibold text-heading">{a.title}</p>
              <p className="text-[11px] text-muted">{a.subject} · {a.perStudent} questions · {a.durationMin} min · open {formatDateTime(a.opensAt)} – {formatDateTime(a.closesAt)}</p>
              <p className="mt-1 text-xs">Allowed: {resourceList(a.resources)}</p>
              {at?.total != null ? (
                <div className="mt-2 rounded-lg bg-bg p-2">
                  <p className="font-mono text-lg font-semibold text-heading">{at.total}<span className="text-sm text-muted">/{at.max}</span></p>
                  {at.feedback && <p className="whitespace-pre-line text-xs">{at.feedback}</p>}
                </div>
              ) : at?.submittedAt ? <p className="mt-2 text-xs font-medium">Submitted {formatDateTime(at.submittedAt)}. Waiting for marking.</p>
                : !student ? <p className="mt-2 text-xs text-muted">{at ? 'Started, not submitted yet' : open ? 'Open now' : now < a.opensAt ? 'Not open yet' : 'Closed, not attempted'}</p>
                : at ? <Link href={`/app/open-book/${a.id}`} className="btn-primary mt-2 inline-block px-3 py-1 text-xs">Continue</Link>
                : open ? (
                  <form action={startOpenBookForm} className="mt-2 space-y-2">
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="pledge" required className="mt-0.5" /> <span><span className="font-semibold">Honesty pledge:</span> {AI_POLICY}</span></label>
                    <button className="btn-primary px-3 py-1 text-xs">Start ({a.durationMin} min)</button>
                  </form>
                ) : <p className="mt-2 text-xs text-muted">{now < a.opensAt ? 'Opens soon' : 'Closed'}</p>}
            </article>
          );
        })}
      </section>

      <section className="space-y-2">
        <p className="font-semibold text-heading">Big question of the week</p>
        {student && xp.featured > 0 && <p className="text-xs">⭐ {xp.featured} of your explanations featured · +{xp.xp} XP</p>}
        {current.length === 0 && <p className="card p-3 text-sm text-muted">No big question this week yet.</p>}
        {current.map((q) => {
          const mine = q.answers.find((a) => a.studentId === p.studentId);
          const featured = q.answers.filter((a) => a.featured);
          return (
            <article key={q.id} className="card p-4 text-sm">
              <p className="text-[11px] text-muted">{q.subject}</p>
              <p className="whitespace-pre-line font-medium text-heading">{q.text}</p>
              {student && (
                <div className="mt-2">
                  <QuickForm action={bigAnswerAction} submit={mine ? 'Update my answer' : 'Post my answer'} cols={1} fields={[
                    { name: 'questionId', type: 'hidden', value: q.id },
                    { name: 'text', label: 'Explain in your own words', type: 'textarea', required: true, rows: 4, maxLength: 4000, defaultValue: mine?.text ?? '' },
                  ]} />
                </div>
              )}
              {!student && mine && <p className="mt-2 whitespace-pre-line rounded-lg bg-bg p-2">{mine.text}{mine.featured ? ' ⭐' : ''}</p>}
              {featured.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold">Featured explanations</p>
                  <ul className="mt-1 space-y-1">{featured.map((a) => <li key={a.id} className="rounded-lg bg-bg p-2 text-xs"><span className="font-semibold">{a.name}:</span> {a.text}</li>)}</ul>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
