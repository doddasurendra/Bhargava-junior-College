'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Content } from '@/lib/cms/blocks';
import { jeeRank, likelyColleges, neetRank } from '@/lib/predictor';
import { scoreAttempt, weakChapters } from '@/lib/school/logic';
import { LeadForm } from './forms';

const UNLOCK = 'bjc_resources_unlocked';
const readUnlock = () => {
  try {
    return localStorage.getItem(UNLOCK) === '1';
  } catch {
    return false;
  }
};
const writeUnlock = () => {
  try {
    localStorage.setItem(UNLOCK, '1');
  } catch {
    /* private mode: unlocks for this page view only */
  }
};

/**
 * §4.2 rows 7 & 18: downloads ask for a name and mobile once (they become CRM leads with the source), then
 * every gated file on the site opens for that visitor.
 */
export function GatedDownloads({ items, source }: { items: { title: string; url: string | null; gated: boolean; tag?: string }[]; source: 'resource' | 'brochure' }) {
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  useEffect(() => setUnlocked(readUnlock()), []);
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.title} className="card flex items-center justify-between gap-3 p-4 text-sm">
            <span>
              <span className="font-medium text-heading">{r.title}</span>
              {r.tag && <span className="block text-xs text-muted">{r.tag}</span>}
            </span>
            {!r.url ? (
              <span className="shrink-0 text-xs text-muted">Coming soon</span>
            ) : !r.gated || unlocked ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-outline shrink-0 py-1.5 text-xs">Download</a>
            ) : (
              <button type="button" onClick={() => setAsking(r.title)} className="btn-primary shrink-0 py-1.5 text-xs">Get it free</button>
            )}
          </li>
        ))}
      </ul>
      {asking && !unlocked && (
        <div className="card p-5">
          <LeadForm
            source={source}
            heading="Where should we send updates?"
            sub="Free downloads ask for your name and mobile once. We’ll only contact you about admissions."
            submitLabel="Unlock downloads"
            note={`Download: ${asking}`}
            successTitle="Unlocked"
            successText="All free downloads on this site are now open for you."
            onSuccess={() => {
              writeUnlock();
              setUnlocked(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** §4.2 row 8: one JEE/NEET-pattern test with an instant score and analysis; it captures a lead first. */
export function MockTest({ test }: { test: Content['mockTest'] }) {
  const [stage, setStage] = useState<'lead' | 'test' | 'done'>('lead');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [endsAt, setEndsAt] = useState(0);
  const [left, setLeft] = useState(test.durationMin * 60_000);
  useEffect(() => {
    if (stage !== 'test') return;
    const t = setInterval(() => {
      const l = Math.max(0, endsAt - Date.now());
      setLeft(l);
      if (l === 0) setStage('done');
    }, 1000);
    return () => clearInterval(t);
  }, [stage, endsAt]);
  const result = useMemo(() => (stage === 'done' ? scoreAttempt({ questions: test.questions, maxMarks: 0 }, answers) : null), [stage, answers, test.questions]);

  if (stage === 'lead')
    return (
      <div className="card p-5">
        <LeadForm
          source="mock_test"
          heading={test.title}
          sub={`${test.questions.length} questions · ${test.durationMin} minutes · +marks for right answers, −negative for wrong. Your score and analysis appear instantly.`}
          submitLabel="Start the test"
          showClass
          successTitle="Starting…"
          successText="Good luck!"
          onSuccess={() => {
            setEndsAt(Date.now() + test.durationMin * 60_000);
            setStage('test');
          }}
        />
      </div>
    );

  if (stage === 'done' && result) {
    const weak = weakChapters(result.byChapter, 1);
    return (
      <div className="card space-y-3 p-5">
        <p className="font-display text-2xl text-heading">Your score: {result.score} / {result.max}</p>
        <ul className="text-sm">{Object.entries(result.bySubject).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{v}</span></li>)}</ul>
        {weak.length > 0 && <p className="text-sm"><span className="font-semibold">Worth revising:</span> {weak.map((w) => w.chapter).join(', ')}</p>}
        <p className="text-xs text-muted">This short sample test is only a taste of the weekly tests and full mock series at Bhargava. An admission counsellor will call you to talk through your result.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-16 z-10 flex justify-between rounded-xl bg-navy px-4 py-2 text-white"><span className="text-sm">{Object.keys(answers).length}/{test.questions.length} answered</span><span className="font-mono">{String(Math.floor(left / 60000)).padStart(2, '0')}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}</span></div>
      <ol className="space-y-3">
        {test.questions.map((q, i) => (
          <li key={q.id} className="card p-4">
            <p className="text-[11px] text-muted">Q{i + 1} · {q.subject} · +{q.marks} / −{q.negative}</p>
            <p className="mt-1 text-[15px]">{q.text}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
              {q.options.map((o, k) => (
                <button key={k} type="button" role="radio" aria-checked={answers[q.id] === k} onClick={() => setAnswers({ ...answers, [q.id]: k })} className={`rounded-xl border px-3 py-2 text-left text-sm ${answers[q.id] === k ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line'}`}>
                  {String.fromCharCode(65 + k)}. {o}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setStage('done')} className="btn-primary w-full py-3">Submit and see my score</button>
    </div>
  );
}

/** §4.2 row 9: JEE percentile → rank; NEET score → rank band → likely colleges. */
export function Predictor({ cfg }: { cfg: Content['predictor'] }) {
  const [exam, setExam] = useState<'jee' | 'neet'>('jee');
  const [value, setValue] = useState('');
  const n = Number(value);
  const r = value === '' ? null : exam === 'jee' ? jeeRank(n, cfg) : neetRank(n, cfg);
  const colleges = r ? likelyColleges(exam, r.estimate, cfg) : [];
  return (
    <div className="card space-y-4 p-5">
      <div className="flex gap-2" role="radiogroup" aria-label="Exam">
        {(['jee', 'neet'] as const).map((e) => (
          <button key={e} type="button" role="radio" aria-checked={exam === e} onClick={() => { setExam(e); setValue(''); }} className={`rounded-full border px-4 py-1.5 text-sm ${exam === e ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line'}`}>
            {e === 'jee' ? 'JEE Main percentile' : 'NEET score'}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">{exam === 'jee' ? 'Your JEE Main percentile (0–100)' : 'Your NEET score (out of 720)'}</span>
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.-]/g, '').slice(0, 7))} className="input font-mono text-lg" placeholder={exam === 'jee' ? '98.5' : '620'} />
      </label>
      {value !== '' && !r && <p className="text-sm text-red-700 dark:text-red-300">Enter a valid {exam === 'jee' ? 'percentile between 0 and 100' : 'score between −180 and 720'}.</p>}
      {r && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Estimated {exam === 'jee' ? 'JEE Main' : 'NEET'} rank</p>
          <p className="font-mono text-3xl font-semibold text-heading">{r.from.toLocaleString('en-IN')} – {r.to.toLocaleString('en-IN')}</p>
          {colleges.length > 0 ? (
            <ul className="list-disc pl-5 text-sm">{colleges.map((c) => <li key={c.name}>{c.name}</li>)}</ul>
          ) : (
            <p className="text-sm">At this rank, private and state-quota options are worth exploring. A counsellor can help.</p>
          )}
        </div>
      )}
      <p className="text-xs text-muted">An estimate from past-year patterns{cfg.sample ? ' (sample inputs)' : ''}, not a prediction or a promise. Actual ranks depend on the year’s paper, normalisation and category.</p>
    </div>
  );
}
