'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { submitPracticeAction, type PracticeResult } from '@/app/app/practice-actions';

type Q = { id: string; stem: string; options: string[]; chapter: string; difficulty: string };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? 'Marking…' : 'Submit answers'}</button>;
}

/** A practice session: answer, submit, see instant marking with solutions. */
export function PracticeForm({ questions, setId }: { questions: Q[]; setId: string | null }) {
  const [state, action] = useFormState<PracticeResult, FormData>(submitPracticeAction, {});
  if (state.results) {
    const right = state.results.filter((r) => r.correct).length;
    const xp = state.results.reduce((t, r) => t + r.xp, 0);
    return (
      <div className="space-y-3">
        <p role="status" className="card p-4 text-sm"><strong className="text-heading">{right}/{state.results.length} correct</strong> · +{xp} XP</p>
        {state.results.map((r, i) => (
          <article key={r.id} className={`card p-4 text-sm ${r.correct ? 'border-emerald-300' : 'border-red-300'}`}>
            <p className="font-medium text-heading">{i + 1}. {r.stem}</p>
            <p className="mt-1">{r.correct ? '✓ Correct' : `✗ You chose “${r.options[r.chosen]}”. Correct: “${r.options[r.answer]}”.`}</p>
            {!r.correct && r.misconception && <p className="mt-1 text-xs text-muted">Common mistake: {r.misconception}</p>}
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs">Solution: {r.solution}</p>
          </article>
        ))}
        <Link href="/app/practice" className="btn-outline block text-center">Practise more</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {setId && <input type="hidden" name="setId" value={setId} />}
      {questions.map((q, i) => (
        <fieldset key={q.id} className="card p-4 text-sm">
          <legend className="sr-only">Question {i + 1}</legend>
          <p className="font-medium text-heading">{i + 1}. {q.stem}</p>
          <p className="text-[11px] text-muted">{q.chapter} · {q.difficulty}</p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o, j) => (
              <label key={j} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 has-[:checked]:border-gold has-[:checked]:bg-gold-100/40">
                <input type="radio" name={`q:${q.id}`} value={j} required />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {state.error && <p role="alert" className="text-sm text-maroon">{state.error}</p>}
      <Submit />
    </form>
  );
}
