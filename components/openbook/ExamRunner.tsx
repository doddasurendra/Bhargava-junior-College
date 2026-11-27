'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { examEventAction, saveExamAction, startExamAction, submitExamAction } from '@/app/app/exam-actions';
import { MockRunner } from './MockRunner';

/** A stable id for this browser (closed-book exams can be tied to the device they started on). */
export function deviceId() {
  try {
    let d = localStorage.getItem('bjc_exam_device');
    if (!d) { d = crypto.randomUUID(); localStorage.setItem('bjc_exam_device', d); }
    return d;
  } catch { return 'no-storage-device'; }
}

function StartBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn-primary px-4 py-2 text-sm">{pending ? 'Opening…' : label}</button>;
}

export function StartExam({ mockId, label }: { mockId: string; label: string }) {
  const [s, action] = useFormState(startExamAction, {});
  const [dev, setDev] = useState('');
  useEffect(() => setDev(deviceId()), []);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="mockId" value={mockId} />
      <input type="hidden" name="deviceId" value={dev} />
      <StartBtn label={label} />
      {s.error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{s.error}</p>}
    </form>
  );
}

interface Q { id: string; type: string; stem: string; options: string[]; subject: string }

/**
 * Exam screen: optional full-screen gate, focus / tab / full-screen-exit monitoring (each one is logged on the
 * server; past the limit the server submits the exam), device-bound saving. Not a guarantee against cheating.
 */
export function ExamRunner(p: { attemptId: string; title: string; endsAt: string; questions: Q[]; optionOrder: Record<string, number[]>; answers: Record<string, string[]>; review: string[]; time: Record<string, number>; marks: number; negative: number; fullscreen: boolean; maxFocusLoss: number; focusLosses: number }) {
  const [dev, setDev] = useState('');
  const [inFs, setInFs] = useState(false);
  const [started, setStarted] = useState(!p.fullscreen);
  const [losses, setLosses] = useState(p.focusLosses);
  const [warn, setWarn] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const last = useRef(0);
  useEffect(() => setDev(deviceId()), []);

  useEffect(() => {
    if (!dev || !started) return;
    const report = async (kind: 'blur' | 'hidden' | 'fullscreen_exit') => {
      const now = Date.now();
      if (now - last.current < 1500) return; // one switch fires blur + visibilitychange together
      last.current = now;
      const r = await examEventAction(p.attemptId, dev, kind);
      const d = r.data as { submitted: boolean; focusLosses: number; limit: number } | undefined;
      if (!d) return;
      setLosses(d.focusLosses);
      if (d.submitted) { setGone(true); window.location.replace(`/app/exam/report/${p.attemptId}`); return; }
      setWarn(d.limit > 0 ? `You left the exam window (${d.focusLosses} of ${d.limit}). At ${d.limit}, the exam is submitted automatically.` : `You left the exam window (${d.focusLosses} time${d.focusLosses === 1 ? '' : 's'}). This is recorded for your teacher.`);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') void report('hidden'); };
    const onBlur = () => void report('blur');
    const onFs = () => { const fs = !!document.fullscreenElement; setInFs(fs); if (!fs && p.fullscreen) void report('fullscreen_exit'); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); document.removeEventListener('fullscreenchange', onFs); };
  }, [dev, started, p.attemptId, p.fullscreen]);

  const enterFs = async () => {
    try { await document.documentElement.requestFullscreen(); setInFs(true); setStarted(true); } catch { setWarn('This browser did not allow full screen. Tap again, or use another browser.'); }
  };

  if (gone) return <p className="card p-4 text-sm">The exam was submitted.</p>;
  if (!started || (p.fullscreen && !inFs)) {
    return (
      <section className="card mx-auto max-w-lg space-y-3 p-5 text-sm">
        <h1 className="font-display text-xl text-heading">{p.title}</h1>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>The exam runs in full screen. Study material and the rest of the app are not available until you submit.</li>
          <li>Switching tabs or apps, minimising, or leaving full screen is recorded{p.maxFocusLoss > 0 ? `; after ${p.maxFocusLoss} times the exam is submitted automatically` : ''}.{losses ? ` So far: ${losses}.` : ''}</li>
          <li>The timer keeps running on the server; at 0:00 the exam is submitted.</li>
          <li>These browser checks make the exam fair for everyone; they can’t see other devices or people in the room.</li>
        </ul>
        {warn && <p role="alert" className="rounded-lg bg-gold-100 px-3 py-2 text-navy">{warn}</p>}
        <button onClick={enterFs} disabled={!dev} className="btn-primary w-full py-3">{started ? 'Return to full screen' : 'Enter full screen and start'}</button>
      </section>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <h1 className="font-display text-lg text-heading">{p.title}</h1>
      {warn && <p role="alert" className="rounded-lg bg-gold-100 px-3 py-2 text-sm text-navy">{warn}</p>}
      <MockRunner attemptId={p.attemptId} endsAt={p.endsAt} questions={p.questions} initialAnswers={p.answers} initialReview={p.review} initialTime={p.time} marks={p.marks} negative={p.negative}
        hooks={{ save: (patch) => saveExamAction(p.attemptId, dev, patch), submit: async (auto) => { const r = await submitExamAction(p.attemptId, dev, auto); return { error: r.error }; }, reportHref: `/app/exam/report/${p.attemptId}`, optionOrder: p.optionOrder, top: '8px' }} />
      <p className="text-center text-[11px] text-muted">Closed-book examination · study material is locked until you submit.</p>
    </div>
  );
}
