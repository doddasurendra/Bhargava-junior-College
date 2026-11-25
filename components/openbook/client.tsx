'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import * as act from '@/app/app/(authed)/openbook/actions';

type R<T = unknown> = act.R<T>;
export interface ExamOpt { id: string; name: string; subjects: string[]; types: { id: string; label: string }[]; classes: string[]; ready: boolean; note: string }
export interface ChapterOpt { subject: string; cls: string; name: string; concepts: string[] }
export interface QView { id: string; type: string; stem: string; options: string[]; answer: string[]; marks: number; difficulty: string; subject: string; chapter: string; concept: string; ai: boolean; explanation: { answer: string; explanation: string; steps: string[]; formulas: string[]; concepts: string[]; outcome: string; mistakes: string[]; related: string[]; whyOptions: string[] } | null; similarity?: { method: string; maxScore: number; checkedAgainst: number } | null }

const L = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';
export const Note = ({ r }: { r: R | null | undefined }) => (r?.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{r.error}</p> : r?.message ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{r.message}</p> : null);

function SubmitBtn({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn-primary w-full py-2.5 disabled:opacity-60">{pending ? 'Working…' : children}</button>;
}

/** A server-action form that supports file inputs and shows progress and the result. */
export function ObForm({ action, children, submit }: { action: (s: R, fd: FormData) => Promise<R>; children: ReactNode; submit: string }) {
  const [state, formAction] = useFormState(action, {} as R);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {children}
      <Note r={state} />
      <SubmitBtn>{submit}</SubmitBtn>
    </form>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (<label className="block"><span className={L}>{label}</span>{children}</label>);

const letter = (i: number) => 'abcdefgh'[i] ?? String(i + 1);
const typeLabel = (t: string) => t.replace(/_/g, ' ');

/** Attempt → mark → reveal answer, full explanation, and "explain simpler / advanced". */
export function QuestionCard({ q, n, lang = 'en' }: { q: QView; n: number; lang?: 'en' | 'te' | 'hi' }) {
  const [given, setGiven] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ correct: boolean | null; score: number; feedback: string | null } | null>(null);
  const [show, setShow] = useState(false);
  const [extra, setExtra] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const started = useRef(Date.now());
  const objective = q.options.length > 0 || ['numerical', 'fill_blank', 'one_word', 'true_false'].includes(q.type);
  const multi = q.type === 'mcq_multi';
  const toggle = (i: number) => setGiven((g) => (multi ? (g.includes(String(i)) ? g.filter((x) => x !== String(i)) : [...g, String(i)]) : [String(i)]));
  const submit = () => start(async () => {
    setErr(null);
    const r = await act.attemptAction(q.id, q.options.length ? given : [text], (Date.now() - started.current) / 1000);
    if (r.error) setErr(r.error); else { setRes(r.data as never); setShow(true); }
  });
  const explain = (level: 'simpler' | 'advanced' | 'standard') => start(async () => { const r = await act.explainAction(q.id, level, lang); if (r.error) setErr(r.error); else setExtra(String(r.data)); });
  const fmtAns = q.answer.map((a) => (q.options.length && /^\d$/.test(a) ? `(${letter(Number(a))}) ${q.options[Number(a)]}` : a)).join(', ');
  return (
    <article className="card space-y-3 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">Q{n} · {typeLabel(q.type)} · {q.difficulty.replace('_', ' ')} · {q.marks} marks {q.ai && <span className="ml-1 rounded bg-navy/10 px-1.5 py-0.5 font-semibold text-navy dark:bg-gold/20 dark:text-gold">AI</span>}</p>
      <p className="whitespace-pre-line text-[15px] text-heading">{q.stem}</p>
      {q.options.length > 0 ? (
        <ul className="space-y-1.5">
          {q.options.map((o, i) => {
            const picked = given.includes(String(i));
            const right = show && q.answer.includes(String(i));
            return <li key={i}><button type="button" disabled={!!res} onClick={() => toggle(i)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${right ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-400/10' : picked ? 'border-navy bg-navy/5 dark:border-gold' : 'border-line'}`}><b>({letter(i)})</b> {o}</button></li>;
          })}
        </ul>
      ) : (
        <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!!res} rows={objective ? 1 : 5} placeholder={objective ? 'Your answer' : 'Write your answer'} className="input w-full" />
      )}
      <div className="flex flex-wrap gap-2">
        {!res && q.answer.length === 0 && <span className="self-center text-xs text-muted">No answer key for this question yet.</span>}
        {!res && q.answer.length > 0 && <button onClick={submit} disabled={pending || (q.options.length ? !given.length : !text.trim())} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">{pending ? 'Checking…' : 'Check answer'}</button>}
        <button onClick={() => setShow((v) => !v)} className="btn-outline px-3 py-1.5 text-sm">{show ? 'Hide answer' : 'Reveal answer'}</button>
        {show && <><button onClick={() => explain('simpler')} disabled={pending} className="btn-outline px-3 py-1.5 text-sm">Explain simpler</button><button onClick={() => explain('advanced')} disabled={pending} className="btn-outline px-3 py-1.5 text-sm">Advanced</button></>}
      </div>
      {res && <p className={`text-sm font-semibold ${res.correct ? 'text-emerald-700' : res.correct === false ? 'text-red-700' : 'text-muted'}`}>{res.correct ? `Correct (+${res.score})` : res.correct === false ? `Not quite (${res.score})` : 'Answer recorded'}</p>}
      {res?.feedback && <p className="whitespace-pre-line rounded-lg bg-bg p-2 text-sm">{res.feedback}</p>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {show && (
        <div className="space-y-2 rounded-lg bg-bg p-3 text-sm">
          <p><b>Answer:</b> {fmtAns || '—'}</p>
          {q.explanation && <>
            <p className="whitespace-pre-line">{q.explanation.explanation}</p>
            {q.explanation.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5">{q.explanation.steps.map((s, i) => <li key={i} className="whitespace-pre-line">{s}</li>)}</ol>}
            {q.explanation.whyOptions.length > 0 && <ul className="list-disc space-y-1 pl-5">{q.explanation.whyOptions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
            {q.explanation.formulas.length > 0 && <p><b>Formulas:</b> {q.explanation.formulas.join(' · ')}</p>}
            {q.explanation.mistakes.length > 0 && <p><b>Common mistakes:</b> {q.explanation.mistakes.join(' · ')}</p>}
            {q.explanation.outcome && <p><b>Learning outcome:</b> {q.explanation.outcome}</p>}
            {q.explanation.related.length > 0 && <p><b>Related:</b> {q.explanation.related.join(', ')}</p>}
          </>}
          {extra && <p className="whitespace-pre-line border-t border-line pt-2">{extra}</p>}
          <p className="text-[11px] text-muted">{q.subject} › {q.chapter} › {q.concept}{q.similarity ? ` · duplicate check: ${q.similarity.method}, checked against ${q.similarity.checkedAgainst}, closest ${Math.round(q.similarity.maxScore * 100)}%` : ''}</p>
        </div>
      )}
    </article>
  );
}

/** Cascading exam → subject → chapter → concept pickers. */
export function useTaxonomy(exams: ExamOpt[], chapters: ChapterOpt[], initialExam: string) {
  const [examId, setExamId] = useState(initialExam);
  const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const [subject, setSubject] = useState(exam.subjects[0]);
  const chs = useMemo(() => chapters.filter((c) => c.subject === subject && exam.classes.includes(c.cls)), [chapters, subject, exam]);
  const [chapter, setChapter] = useState(chs[0]?.name ?? '');
  const ch = chs.find((c) => c.name === chapter);
  const [concept, setConcept] = useState(ch?.concepts[0] ?? '');
  useEffect(() => { if (!exam.subjects.includes(subject)) setSubject(exam.subjects[0]); }, [exam, subject]);
  useEffect(() => { if (!chs.some((c) => c.name === chapter)) setChapter(chs[0]?.name ?? ''); }, [chs, chapter]);
  useEffect(() => { if (ch && !ch.concepts.includes(concept) && concept !== '') setConcept(ch.concepts[0] ?? ''); }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps
  return { examId, setExamId, exam, subject, setSubject, chs, chapter, setChapter, ch, concept, setConcept };
}

export function TaxonomyPickers({ t, exams, conceptFree = true }: { t: ReturnType<typeof useTaxonomy>; exams: ExamOpt[]; conceptFree?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Examination"><select className="input w-full" value={t.examId} onChange={(e) => t.setExamId(e.target.value)}>{exams.map((e) => <option key={e.id} value={e.id} disabled={!e.ready}>{e.name}{e.ready ? '' : ' (coming soon)'}</option>)}</select></Field>
      <Field label="Subject"><select className="input w-full" value={t.subject} onChange={(e) => t.setSubject(e.target.value)}>{t.exam.subjects.map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Chapter"><select className="input w-full" value={t.chapter} onChange={(e) => t.setChapter(e.target.value)}>{t.chs.length ? t.chs.map((c) => <option key={c.name}>{c.name}</option>) : <option value="">No chapters yet (coming soon)</option>}</select></Field>
      <Field label="Concept">
        {conceptFree ? (<><input list="ob-concepts" className="input w-full" value={t.concept} onChange={(e) => t.setConcept(e.target.value)} placeholder="Choose or type a concept" /><datalist id="ob-concepts">{t.ch?.concepts.map((c) => <option key={c} value={c} />)}</datalist></>) : (<select className="input w-full" value={t.concept} onChange={(e) => t.setConcept(e.target.value)}>{t.ch?.concepts.map((c) => <option key={c}>{c}</option>)}</select>)}
      </Field>
    </div>
  );
}

const DIFFS = [['beginner', 'Beginner'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['very_hard', 'Very hard'], ['advanced', 'Advanced competitive']];

export function Generator({ exams, chapters, initialExam, aiReady }: { exams: ExamOpt[]; chapters: ChapterOpt[]; initialExam: string; aiReady: boolean }) {
  const t = useTaxonomy(exams, chapters, initialExam);
  const [types, setTypes] = useState<string[]>([t.exam.types[0]?.id ?? 'mcq_single']);
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(10);
  const [custom, setCustom] = useState('');
  const [out, setOut] = useState<R<{ questions: QView[]; rejected: number; rounds: number; checkedAgainst: number; method: string; shortfall: number }> | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { setTypes((ts) => { const ok = ts.filter((x) => t.exam.types.some((y) => y.id === x)); return ok.length ? ok : [t.exam.types[0]?.id ?? 'mcq_single']; }); }, [t.exam]);
  const n = custom ? Math.max(1, Math.min(50, Number(custom) || 1)) : count;
  const go = () => start(async () => setOut((await act.generateAction({ examId: t.examId, subject: t.subject, chapter: t.chapter, concept: t.concept, types: types as never, difficulty: difficulty as never, count: n })) as never));
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <TaxonomyPickers t={t} exams={exams} />
        <p className="text-xs text-muted">{t.exam.note}</p>
        <div><span className={L}>Question format (only formats this exam uses)</span><div className="flex flex-wrap gap-1.5">{t.exam.types.map((x) => <button key={x.id} type="button" aria-pressed={types.includes(x.id)} onClick={() => setTypes((ts) => (ts.includes(x.id) ? ts.filter((y) => y !== x.id) : [...ts, x.id]))} className={types.includes(x.id) ? 'chip-active chip' : 'chip'}>{x.label}</button>)}</div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Difficulty"><select className="input w-full" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{DIFFS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Number of questions"><div className="flex gap-1.5">{[5, 10, 20, 30, 50].map((c) => <button key={c} type="button" onClick={() => { setCount(c); setCustom(''); }} className={!custom && count === c ? 'chip-active chip' : 'chip'}>{c}</button>)}<input aria-label="Custom number" className="input w-20" inputMode="numeric" placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div></Field>
        </div>
        {!aiReady && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">AI question generation is not switched on yet: the college needs to add the AI key on the server. Until then, practise with the question bank, past papers and the daily challenge.</p>}
        <button onClick={go} disabled={pending || !t.concept.trim() || !types.length || !t.chapter} className="btn-primary w-full py-2.5 disabled:opacity-50">{pending ? `Generating ${n} questions and checking for duplicates…` : 'Generate questions'}</button>
      </section>
      <Note r={out?.error ? out : null} />
      {out?.data && (
        <>
          <p className="rounded-lg bg-bg px-3 py-2 text-xs text-muted">{out.data.questions.length} new question{out.data.questions.length === 1 ? '' : 's'} · {out.data.rejected} rejected as duplicates and regenerated ({out.data.rounds} round{out.data.rounds > 1 ? 's' : ''}) · compared with {out.data.checkedAgainst} earlier questions on this concept · checks: {out.data.method}{out.data.shortfall > 0 ? ` · ${out.data.shortfall} could not be made unique; try a different difficulty or format` : ''}</p>
          {out.data.questions.map((q, i) => <QuestionCard key={q.id} q={q} n={i + 1} />)}
        </>
      )}
    </div>
  );
}

/** A fixed set of MCQ/numerical questions answered together (diagnostic, daily challenge). */
export function QuizSet({ questions, onSubmit, submitLabel }: { questions: QView[]; onSubmit: (answers: Record<string, string>) => Promise<R<{ correct: number; total: number; xp?: number }>>; submitLabel: string }) {
  const [ans, setAns] = useState<Record<string, string>>({});
  const [res, setRes] = useState<R<{ correct: number; total: number; xp?: number }> | null>(null);
  const [pending, start] = useTransition();
  if (res?.data) return <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200">You got {res.data.correct} of {res.data.total} right{res.data.xp ? ` · +${res.data.xp} XP` : ''}. Your answers are saved and your mastery is updated.</p>;
  return (
    <div className="space-y-3">
      {questions.map((q, n) => (
        <div key={q.id} className="card p-3">
          <p className="whitespace-pre-line text-sm text-heading"><b>{n + 1}.</b> {q.stem}</p>
          {q.options.length ? <div className="mt-2 grid gap-1">{q.options.map((o, i) => <label key={i} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-sm ${ans[q.id] === String(i) ? 'border-navy dark:border-gold' : 'border-line'}`}><input type="radio" name={q.id} checked={ans[q.id] === String(i)} onChange={() => setAns((a) => ({ ...a, [q.id]: String(i) }))} />({letter(i)}) {o}</label>)}</div>
            : <input className="input mt-2 w-full" placeholder="Answer" value={ans[q.id] ?? ''} onChange={(e) => setAns((a) => ({ ...a, [q.id]: e.target.value }))} />}
        </div>
      ))}
      <Note r={res} />
      <button disabled={pending} onClick={() => start(async () => setRes(await onSubmit(ans)))} className="btn-primary w-full py-2.5 disabled:opacity-50">{pending ? 'Marking…' : submitLabel}</button>
    </div>
  );
}

export function CardReview({ cards }: { cards: { id: string; front: string; back: string; kind: string }[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [pending, start] = useTransition();
  const c = cards[i];
  if (!c) return <p className="card p-4 text-sm">Session done. Cards come back when they are due again.</p>;
  const rate = (r: 'again' | 'hard' | 'good' | 'easy') => start(async () => { await act.rateCardAction(c.id, r); setFlip(false); setI((x) => x + 1); });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Card {i + 1} of {cards.length} · {c.kind}</p>
      <button onClick={() => setFlip((f) => !f)} className="card block min-h-[160px] w-full whitespace-pre-line p-5 text-left text-[15px] text-heading">{flip ? c.back : c.front}<span className="mt-3 block text-[11px] text-muted">{flip ? 'Answer' : 'Tap to show the answer'}</span></button>
      {flip && <div className="grid grid-cols-4 gap-2">{(['again', 'hard', 'good', 'easy'] as const).map((r) => <button key={r} disabled={pending} onClick={() => rate(r)} className="btn-outline py-2 text-sm capitalize">{r}</button>)}</div>}
    </div>
  );
}

type Win = Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
interface SpeechRec { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void }
const LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' } as const;

/** Study assistant chat and the voice tutor (speech in → text answer → speech out, with barge-in). */
export function Chat({ mode, tasks, initialSession, initialTurns, voice = false }: { mode: 'assistant' | 'tutor'; tasks: { id: string; label: string }[]; initialSession?: string | null; initialTurns?: { role: string; text: string; sources: { label: string; bookId: string | null; page: number | null }[] }[]; voice?: boolean }) {
  const [turns, setTurns] = useState(initialTurns ?? []);
  const [task, setTask] = useState(tasks[0].id);
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en');
  const [q, setQ] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(initialSession ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [rate, setRate] = useState(1);
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopSpeaking = () => { window.speechSynthesis?.cancel(); audio.current?.pause(); };
  const speak = async (text: string) => {
    stopSpeaking();
    try {
      const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 1400), lang }) });
      if (r.status === 200) { const url = URL.createObjectURL(await r.blob()); audio.current = new Audio(url); audio.current.playbackRate = rate; await audio.current.play(); return; }
    } catch { /* fall back to the browser voice */ }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE[lang]; u.rate = rate;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang === LOCALE[lang] && /female|zira|heera|swara|shruti|google/i.test(x.name)) ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };
  const send = (text: string) => start(async () => {
    setErr(null);
    stopSpeaking(); // barge-in
    const r = await act.readerAsk({ task: task as never, question: text, lang, bookId: null, sessionId });
    if (r.error || !r.data) { setErr(r.error ?? 'No answer'); return; }
    const d = r.data as { answer: string; sources: { label: string; bookId: string | null; page: number | null }[]; sessionId: string; mode: string };
    setSessionId(d.sessionId);
    setTurns((t) => [...t, { role: 'user', text, sources: [] }, { role: 'assistant', text: d.answer, sources: d.sources }]);
    setQ('');
    if (voice) void speak(d.answer);
  });
  const listen = () => {
    const W = window as Win;
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) { setErr('Voice input is not supported in this browser. Type your question instead (Chrome works best).'); return; }
    stopSpeaking();
    const r = new Rec();
    r.lang = LOCALE[lang]; r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0][0].transcript; setQ(t); send(t); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    setListening(true); r.start();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Mode" className="input w-auto" value={task} onChange={(e) => setTask(e.target.value)}>{tasks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select aria-label="Language" className="input w-auto" value={lang} onChange={(e) => setLang(e.target.value as 'en')}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिंदी</option></select>
        {voice && <label className="flex items-center gap-1 text-xs">Speed <input type="range" min={0.7} max={1.4} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>}
      </div>
      <ul className="space-y-2">
        {turns.map((t, i) => (
          <li key={i} className={`rounded-xl p-3 text-sm ${t.role === 'user' ? 'ml-8 bg-navy text-white dark:bg-gold dark:text-navy-950' : 'card mr-4'}`}>
            <p className="whitespace-pre-line">{t.text}</p>
            {t.sources.length > 0 && <p className="mt-2 text-[11px] opacity-80">Sources: {t.sources.map((s, n) => s.bookId ? <Link key={n} className="underline" href={`/app/openbook/book/${s.bookId}?page=${s.page ?? 1}`}>{s.label}{n < t.sources.length - 1 ? '; ' : ''}</Link> : <span key={n}>{s.label}</span>)}</p>}
            {voice && t.role === 'assistant' && <button onClick={() => speak(t.text)} className="mt-1 text-[11px] underline">Play again</button>}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) send(q.trim()); }} className="flex gap-2">
        <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'tutor' ? 'Ask or answer…' : 'Ask about any concept, chapter or passage'} />
        {voice && <button type="button" onClick={listening ? stopSpeaking : listen} className="btn-outline px-3" aria-label="Speak">{listening ? '…' : '🎤'}</button>}
        <button disabled={pending || !q.trim()} className="btn-primary px-4 disabled:opacity-50">{pending ? '…' : 'Send'}</button>
      </form>
      {sessionId && <p className="text-[11px] text-muted">Saved to your history (you can delete it there).</p>}
    </div>
  );
}

/** Camera / photo → OCR → editable text with confidence → solve, similar, save, flashcard, community, doubt. */
export function Scanner({ exams, defaultExam }: { exams: ExamOpt[]; defaultExam: string }) {
  const [examId, setExamId] = useState(defaultExam);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<{ imageKey: string; confidence: number | null; ocr: string; questions: { text: string; subject: string; chapter: string; concept: string; difficulty: string; latex: string }[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [tag, setTag] = useState({ subject: '', chapter: '', concept: '' });
  const [msg, setMsg] = useState<R | null>(null);
  const [solution, setSolution] = useState<QView | null>(null);
  const [similar, setSimilar] = useState<QView[]>([]);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const pick = (n: number, s = scan) => { const q = s?.questions[n]; setIdx(n); setText(q?.text ?? ''); setTag(q ? { subject: q.subject, chapter: q.chapter, concept: q.concept } : { subject: exam.subjects[0], chapter: '', concept: '' }); };
  const upload = (f: File) => start(async () => {
    setMsg(null); setSolution(null); setSimilar([]);
    setPreview(URL.createObjectURL(f));
    // auto-enhance: downscale large photos and boost contrast before upload (keeps the original on the phone)
    const fd = new FormData();
    fd.set('image', await enhance(f));
    fd.set('examId', examId);
    const r = await act.scanAction(fd);
    if (r.error) { setMsg(r); return; }
    const s = r.data as never as NonNullable<typeof scan>;
    setScan(s); pick(0, s);
  });
  const q = () => ({ examId, subject: tag.subject || exam.subjects[0], chapter: tag.chapter || 'General', concept: tag.concept || 'General', text, difficulty: (scan?.questions[idx]?.difficulty ?? 'medium') as never, imageKey: scan?.imageKey ?? null });
  const reclassify = () => start(async () => { const r = await act.classifyAction(examId, text); if (r.data) setTag(r.data as never); });
  const low = scan?.confidence !== null && scan?.confidence !== undefined && scan.confidence < 0.7;
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <Field label="Examination"><select className="input w-full" value={examId} onChange={(e) => setExamId(e.target.value)}>{exams.filter((e) => e.ready).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={pending} className="btn-primary w-full py-3">{pending ? 'Reading the question…' : '📷 Scan with camera or choose a photo'}</button>
        {preview && <img src={preview} alt="Your photo" className="max-h-60 w-full rounded-lg object-contain" />}
      </section>
      <Note r={msg} />
      {(scan || preview) && (
        <section className="card space-y-3 p-4">
          {scan?.ocr === 'not_configured' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">Your photo is saved privately. Automatic reading (OCR) is not switched on yet, so type the question below. You can still save it, make a flashcard, post it or send it to a teacher.</p>}
          {scan && scan.questions.length > 1 && <div className="flex flex-wrap gap-1.5">{scan.questions.map((_, n) => <button key={n} onClick={() => pick(n)} className={n === idx ? 'chip chip-active' : 'chip'}>Question {n + 1}</button>)}</div>}
          {scan?.confidence !== null && scan?.confidence !== undefined && <p className={`text-xs ${low ? 'font-semibold text-amber-700' : 'text-muted'}`}>OCR confidence {Math.round(scan.confidence * 100)}%{low ? ' — please check the text carefully before continuing.' : ''}</p>}
          <Field label="Recognised question (edit to fix any mistakes)"><textarea className="input w-full font-mono text-sm" rows={6} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          {scan?.questions[idx]?.latex && <p className="rounded bg-bg p-2 font-mono text-xs">LaTeX: {scan.questions[idx].latex}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Subject"><select className="input w-full" value={tag.subject || exam.subjects[0]} onChange={(e) => setTag({ ...tag, subject: e.target.value })}>{exam.subjects.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Chapter"><input className="input w-full" value={tag.chapter} onChange={(e) => setTag({ ...tag, chapter: e.target.value })} /></Field>
            <Field label="Concept"><input className="input w-full" value={tag.concept} onChange={(e) => setTag({ ...tag, concept: e.target.value })} /></Field>
          </div>
          <button onClick={reclassify} disabled={pending || !text.trim()} className="text-xs underline">Identify subject, chapter and concept again from my text</button>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={pending || !text.trim()} onClick={() => start(async () => { const r = await act.solveAction(q()); if (r.error) setMsg(r); else setSolution(r.data as never); })} className="btn-primary py-2 text-sm">Solve step by step</button>
            <button disabled={pending || !text.trim()} onClick={() => start(async () => { const r = await act.similarQuestionsAction(q()); if (r.error) setMsg(r); else setSimilar((r.data as { questions: QView[] }).questions); })} className="btn-outline py-2 text-sm">5 similar questions</button>
            <button disabled={pending || !text.trim()} onClick={() => start(async () => setMsg(await act.saveScanAction(q())))} className="btn-outline py-2 text-sm">Save to my questions</button>
            <button disabled={pending || !text.trim()} onClick={() => start(async () => setMsg(await act.scanCardAction(q(), solution?.explanation?.answer ?? '')))} className="btn-outline py-2 text-sm">Make a flashcard</button>
            <button disabled={pending || !text.trim()} onClick={() => start(async () => setMsg(await act.scanPostAction(q())))} className="btn-outline py-2 text-sm">Post to community</button>
            <button disabled={pending || !text.trim()} onClick={() => start(async () => setMsg(await act.scanDoubtAction(q())))} className="btn-outline py-2 text-sm">Send to a teacher</button>
          </div>
        </section>
      )}
      {solution && <QuestionCard q={solution} n={1} />}
      {similar.map((s, n) => <QuestionCard key={s.id} q={s} n={n + 1} />)}
    </div>
  );
}

/** Client-side auto-crop of empty borders is unreliable; we downscale to ≤1800 px and raise contrast (deskew is left to OCR). */
async function enhance(f: File): Promise<File> {
  if (!f.type.startsWith('image/')) return f;
  try {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const x = c.getContext('2d')!;
    x.filter = 'contrast(1.25) brightness(1.05)';
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'scan.jpg', { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  }
}
