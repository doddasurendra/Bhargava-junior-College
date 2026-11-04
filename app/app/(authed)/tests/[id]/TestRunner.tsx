'use client';
import { useEffect, useRef, useState } from 'react';
import { submitTestAction } from '@/app/app/portal-actions';
import { ActionForm, Submit } from '@/components/crm/forms';

type Q = { id: string; subject: string; text: string; options: string[]; marks: number; negative: number };

/**
 * One question at a time with a palette, a countdown, and time-per-question tracking for analytics.
 * Auto-submits when the clock runs out; the server also enforces the limit.
 */
export function TestRunner({ testId, title, questions, endsAt }: { testId: string; title: string; questions: Q[]; endsAt: number }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));
  const seconds = useRef<Record<string, number>>({});
  const shownAt = useRef(Date.now());
  const form = useRef<HTMLDivElement>(null);
  const q = questions[i];

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, endsAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  useEffect(() => {
    if (left === 0) form.current?.querySelector('form')?.requestSubmit();
  }, [left]);

  const go = (n: number) => {
    seconds.current[q.id] = (seconds.current[q.id] ?? 0) + Math.round((Date.now() - shownAt.current) / 1000);
    shownAt.current = Date.now();
    setI(n);
  };
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  return (
    <div ref={form} className="space-y-3">
      <div className="sticky top-[60px] z-20 flex items-center justify-between rounded-xl bg-navy px-3 py-2 text-white">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className={`font-mono text-lg ${left < 120_000 ? 'text-gold-300' : ''}`} aria-live="polite">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
      </div>
      <nav aria-label="Questions" className="flex flex-wrap gap-1">
        {questions.map((x, n) => (
          <button key={x.id} type="button" onClick={() => go(n)} aria-current={n === i} className={`h-8 w-8 rounded-lg border text-xs font-semibold ${n === i ? 'border-maroon bg-maroon text-white' : answers[x.id] !== undefined ? 'border-navy bg-navy/10 text-navy dark:border-gold dark:text-gold' : 'border-line'}`}>
            {n + 1}
          </button>
        ))}
      </nav>
      <section className="card p-4">
        <p className="text-[11px] text-muted">Question {i + 1} of {questions.length} · {q.subject} · +{q.marks} / −{q.negative}</p>
        <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{q.text}</p>
        <ul className="mt-3 space-y-2" role="radiogroup">
          {q.options.map((o, k) => (
            <li key={k}>
              <button type="button" role="radio" aria-checked={answers[q.id] === k} onClick={() => setAnswers({ ...answers, [q.id]: k })} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${answers[q.id] === k ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line'}`}>
                <span className="mr-2 font-semibold">{String.fromCharCode(65 + k)}.</span>
                {o}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between gap-2">
          <button type="button" className="btn-outline py-1.5 text-sm" onClick={() => setAnswers(Object.fromEntries(Object.entries(answers).filter(([k]) => k !== q.id)))}>Clear</button>
          <span className="flex gap-2">
            <button type="button" disabled={i === 0} onClick={() => go(i - 1)} className="btn-outline py-1.5 text-sm disabled:opacity-40">Previous</button>
            <button type="button" disabled={i === questions.length - 1} onClick={() => go(i + 1)} className="btn-outline py-1.5 text-sm disabled:opacity-40">Next</button>
          </span>
        </div>
      </section>
      <ActionForm action={submitTestAction} reset={false}>
        <input type="hidden" name="testId" value={testId} />
        <input type="hidden" name="seconds" value={JSON.stringify(seconds.current)} />
        {Object.entries(answers).map(([k, v]) => (
          <input key={k} type="hidden" name={`q:${k}`} value={String(v)} />
        ))}
        <p className="text-xs text-muted">{Object.keys(answers).length} of {questions.length} answered</p>
        <Submit className="btn-primary w-full py-3">Submit test</Submit>
      </ActionForm>
    </div>
  );
}
