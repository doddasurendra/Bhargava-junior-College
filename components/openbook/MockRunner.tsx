'use client';
import { ui, type ObLang } from '@/lib/openbook/i18n';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import * as act from '@/app/app/(authed)/openbook/actions';

interface MQ { id: string; type: string; stem: string; options: string[]; subject: string }

/**
 * Exam screen (§8): countdown timer, question palette (answered / marked for review / not visited), mark for
 * review, autosave every change (resume on any device), automatic submission at 0:00.
 */
export function MockRunner({ attemptId, endsAt, questions, initialAnswers, initialReview, initialTime, marks, negative, lang = 'en' }: { attemptId: string; endsAt: string; questions: MQ[]; initialAnswers: Record<string, string[]>; initialReview: string[]; initialTime: Record<string, number>; marks: number; negative: number; lang?: ObLang }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [review, setReview] = useState(initialReview);
  const [visited, setVisited] = useState<Set<string>>(new Set([questions[0]?.id, ...Object.keys(initialAnswers)]));
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(endsAt) - Date.now()));
  const [saving, setSaving] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [pending, start] = useTransition();
  const time = useRef<Record<string, number>>({ ...initialTime });
  const lastTick = useRef(Date.now());
  const submitted = useRef(false);
  const q = questions[i];

  const save = async (patch: Parameters<typeof act.saveMockAction>[1]) => {
    setSaving('saving');
    const r = await act.saveMockAction(attemptId, { ...patch, time: { ...time.current } });
    setSaving(r.error ? 'offline' : 'saved');
    if ((r.data as { submitted?: boolean } | undefined)?.submitted) router.replace(`/app/openbook/mock/report/${attemptId}`);
  };
  const submit = (auto: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    start(async () => { await act.saveMockAction(attemptId, { answers, review, time: { ...time.current } }); const r = await act.submitMockAction(attemptId, auto); if (!r.error) router.replace(`/app/openbook/mock/report/${attemptId}`); else submitted.current = false; });
  };
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      if (q) time.current[q.id] = (time.current[q.id] ?? 0) + Math.round((now - lastTick.current) / 1000);
      lastTick.current = now;
      const l = Math.max(0, Date.parse(endsAt) - now);
      setLeft(l);
      if (l === 0) submit(true);
    }, 1000);
    const s = setInterval(() => void save({}), 30_000);
    return () => { clearInterval(t); clearInterval(s); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => { setI(n); setVisited((v) => new Set(v).add(questions[n].id)); };
  const setAns = (val: string[]) => { const next = { ...answers, [q.id]: val }; setAnswers(next); void save({ answers: { [q.id]: val } }); };
  const toggleReview = () => { const next = review.includes(q.id) ? review.filter((x) => x !== q.id) : [...review, q.id]; setReview(next); void save({ review: next }); };
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const answered = (id: string) => (answers[id] ?? []).some((x) => x.trim());
  if (!q) return null;
  return (
    <div className="space-y-3">
      <div className="sticky top-[60px] z-20 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <span className={`font-mono text-lg font-semibold ${left < 300_000 ? 'text-red-700' : 'text-heading'}`}>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
        <span className="text-xs text-muted">{saving === 'saving' ? ui(lang, 'saving') : saving === 'offline' ? 'Not saved: check your connection' : ui(lang, 'saved')}</span>
        <button disabled={pending} onClick={() => { if (confirmSubmit(questions.length - questions.filter((x) => answered(x.id)).length)) submit(false); }} className="btn-primary px-3 py-1.5 text-sm">{ui(lang, 'submit')}</button>
      </div>
      <div className="flex flex-wrap gap-1">{questions.map((x, n) => <button key={x.id} onClick={() => go(n)} aria-label={`Question ${n + 1}`} className={`h-8 w-8 rounded text-xs font-semibold ${n === i ? 'ring-2 ring-navy dark:ring-gold' : ''} ${review.includes(x.id) ? 'bg-purple-600 text-white' : answered(x.id) ? 'bg-emerald-600 text-white' : visited.has(x.id) ? 'bg-red-100 text-red-800' : 'bg-bg text-muted'}`}>{n + 1}</button>)}</div>
      <p className="text-[11px] text-muted">Green answered · purple marked for review · red visited, not answered · +{marks}{negative ? ` / −${negative}` : ''} per question</p>
      <article className="card space-y-3 p-4">
        <p className="text-xs text-muted">Question {i + 1} of {questions.length} · {q.subject} · {q.type.replace(/_/g, ' ')}</p>
        <p className="whitespace-pre-line text-[15px] text-heading">{q.stem}</p>
        {q.options.length ? (
          <ul className="space-y-1.5">{q.options.map((o, n) => {
            const on = (answers[q.id] ?? []).includes(String(n));
            return <li key={n}><button onClick={() => setAns(q.type === 'mcq_multi' ? (on ? (answers[q.id] ?? []).filter((x) => x !== String(n)) : [...(answers[q.id] ?? []), String(n)]) : [String(n)])} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${on ? 'border-navy bg-navy/5 dark:border-gold' : 'border-line'}`}><b>({'abcdefgh'[n]})</b> {o}</button></li>;
          })}</ul>
        ) : <textarea className="input w-full" rows={['numerical', 'one_word', 'fill_blank'].includes(q.type) ? 1 : 6} value={(answers[q.id] ?? [''])[0]} onChange={(e) => setAnswers({ ...answers, [q.id]: [e.target.value] })} onBlur={() => void save({ answers: { [q.id]: answers[q.id] ?? [''] } })} placeholder="Your answer" />}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAns([])} className="btn-outline px-3 py-1.5 text-sm">{ui(lang, 'clear')}</button>
          <button onClick={toggleReview} className="btn-outline px-3 py-1.5 text-sm">{review.includes(q.id) ? ui(lang, 'unmark') : ui(lang, 'markReview')}</button>
          <button disabled={i === 0} onClick={() => go(i - 1)} className="btn-outline px-3 py-1.5 text-sm">{ui(lang, 'previous')}</button>
          <button disabled={i === questions.length - 1} onClick={() => go(i + 1)} className="btn-primary px-3 py-1.5 text-sm">{ui(lang, 'saveNext')}</button>
        </div>
      </article>
    </div>
  );
}

function confirmSubmit(unanswered: number) {
  return unanswered === 0 || window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} not answered. Submit anyway?`);
}
