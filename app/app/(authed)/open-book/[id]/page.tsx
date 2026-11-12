import Link from 'next/link';
import { notFound } from 'next/navigation';
import { submitOpenBookAction } from '@/app/app/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireStudent } from '@/lib/app/portal';
import { formatDateTime } from '@/lib/dates';
import { AI_POLICY, attemptFor } from '@/lib/studentLife/openbook';
import { resourceList } from '@/lib/studentLife/openbookLogic';

export const metadata = { title: 'Open-book attempt' };

const KIND: Record<string, string> = { application: 'Application', analysis: 'Analysis', case_data: 'Case / data', own_words: 'In your own words', real_life: 'Real-life problem' };

export default async function OpenBookAttemptPage({ params }: { params: { id: string } }) {
  const { p } = await requireStudent();
  const d = await attemptFor(p.studentId, params.id);
  if (!d) notFound();
  const { assignment: a, attempt: at, questions } = d;
  const deadline = new Date(Math.min(Date.parse(a.closesAt), Date.parse(at.pledgedAt) + a.durationMin * 60_000)).toISOString();
  const done = Boolean(at.submittedAt);
  return (
    <div className="space-y-4">
      <Link href="/app/open-book" className="text-sm text-muted underline">← Open-book</Link>
      <h1 className="font-display text-2xl text-heading">{a.title}</h1>
      <section className="card p-3 text-xs">
        <p>Allowed: <span className="font-medium">{resourceList(a.resources)}</span></p>
        <p className="mt-1">{AI_POLICY}</p>
        {!done && <p className="mt-1 font-semibold">Submit by {formatDateTime(deadline)}.</p>}
      </section>

      {done ? (
        <ul className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="card p-4 text-sm">
              <p className="text-[11px] text-muted">Q{i + 1} · {KIND[q.kind] ?? q.kind}</p>
              <p className="whitespace-pre-line font-medium">{q.text}</p>
              <p className="mt-2 whitespace-pre-line rounded-lg bg-bg p-2">{at.answers[q.id] || '(no answer)'}</p>
              {at.marks?.[q.id] && <ul className="mt-2 text-xs">{q.rubric.map((r) => <li key={r.criterion} className="flex justify-between"><span>{r.criterion}</span><span className="font-mono">{at.marks![q.id][r.criterion] ?? 0}/{r.max}</span></li>)}</ul>}
            </li>
          ))}
          {at.total != null && <li className="card p-4 text-sm"><p className="font-mono text-2xl font-semibold text-heading">{at.total}<span className="text-sm text-muted">/{at.max}</span></p>{at.feedback && <p className="mt-1 whitespace-pre-line">{at.feedback}</p>}</li>}
        </ul>
      ) : (
        <section className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="card p-4 text-sm">
              <p className="text-[11px] text-muted">Q{i + 1} · {q.subject} · {q.chapter} · {KIND[q.kind] ?? q.kind} · {q.rubric.reduce((t, r) => t + r.max, 0)} marks</p>
              <p className="whitespace-pre-line font-medium">{q.text}</p>
              {q.options.length > 0 && <ol className="mt-1 list-[upper-alpha] pl-5">{q.options.map((o) => <li key={o}>{o}</li>)}</ol>}
              <p className="mt-1 text-[11px] text-muted">Marked on: {q.rubric.map((r) => `${r.criterion} (${r.max})`).join(' · ')}</p>
            </div>
          ))}
          <div className="card p-4">
            <QuickForm action={submitOpenBookAction} submit="Submit answers" cols={1} fields={[
              { name: 'assignmentId', type: 'hidden', value: a.id },
              ...questions.map((q, i) => ({ name: `a:${q.id}`, label: `Answer to Q${i + 1}${q.options.length ? ' (pick an option and explain why)' : ''}`, type: 'textarea' as const, rows: q.answerType === 'long' ? 8 : 4, maxLength: 5000, defaultValue: at.answers[q.id] ?? '' })),
            ]} />
          </div>
        </section>
      )}
    </div>
  );
}
