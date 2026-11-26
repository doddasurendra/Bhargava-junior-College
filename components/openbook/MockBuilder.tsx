'use client';
import { ui, type ObLang } from '@/lib/openbook/i18n';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import * as act from '@/app/app/(authed)/openbook/actions';
import { Field, Note, type ChapterOpt, type ExamOpt } from './client';

/** AI Mock Test Generator form (§8): exam, subjects, chapters, concepts, size, difficulty, timing and marking. */
export function MockBuilder({ exams, chapters, initialExam, aiReady, lang = 'en' }: { exams: ExamOpt[]; chapters: ChapterOpt[]; initialExam: string; aiReady: boolean; lang?: ObLang }) {
  const router = useRouter();
  const [examId, setExamId] = useState(initialExam);
  const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const [subjects, setSubjects] = useState<string[]>([exam.subjects[0]]);
  const [chs, setChs] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [source, setSource] = useState<'pool' | 'ai' | 'pattern'>('pool');
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState('');
  const [minutes, setMinutes] = useState('');
  const [marks, setMarks] = useState('');
  const [negative, setNegative] = useState('');
  const [r, setR] = useState<act.R | null>(null);
  const [pending, start] = useTransition();
  const avail = useMemo(() => chapters.filter((c) => subjects.includes(c.subject) && exam.classes.includes(c.cls)), [chapters, subjects, exam]);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const go = () => start(async () => {
    const res = await act.createMockAction({ examId, subjects, chapters: chs, concepts, count, difficulty: (difficulty || null) as never, minutes: minutes ? Number(minutes) : null, marks: marks ? Number(marks) : null, negative: negative ? Number(negative) : null, source });
    setR(res);
    if (res.ok) { const s = await act.startMockAction(String(res.data)); if (s.ok) router.push(`/app/openbook/mock/${s.data}`); }
  });
  return (
    <section className="card space-y-3 p-4">
      <Field label="Examination"><select className="input w-full" value={examId} onChange={(e) => { setExamId(e.target.value); const ex = exams.find((x) => x.id === e.target.value)!; setSubjects([ex.subjects[0]]); setChs([]); setConcepts([]); }}>{exams.filter((e) => e.ready).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <p className="text-xs text-muted">{exam.note}</p>
      <div><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Subjects</span><div className="flex flex-wrap gap-1.5">{exam.subjects.map((s) => <button type="button" key={s} onClick={() => toggle(subjects, setSubjects, s)} className={subjects.includes(s) ? 'chip chip-active' : 'chip'}>{s}</button>)}</div></div>
      <details className="rounded-lg border border-line p-2" open={source === 'ai'}>
        <summary className="cursor-pointer text-sm">Chapters {chs.length ? `(${chs.length})` : '(all)'}{source === 'ai' ? ' and concepts (required for AI)' : ''}</summary>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
          {avail.map((c) => (
            <div key={`${c.subject}:${c.name}`}>
              <label className="flex items-center gap-2"><input type="checkbox" checked={chs.includes(c.name)} onChange={() => toggle(chs, setChs, c.name)} /><b>{c.name}</b> <span className="text-xs text-muted">{c.subject}</span></label>
              {source === 'ai' && chs.includes(c.name) && <div className="ml-6 flex flex-wrap gap-1">{c.concepts.map((k) => { const v = `${c.subject}::${c.name}::${k}`; return <button type="button" key={k} onClick={() => toggle(concepts, setConcepts, v)} className={concepts.includes(v) ? 'chip chip-active text-[11px]' : 'chip text-[11px]'}>{k}</button>; })}</div>}
            </div>
          ))}
        </div>
      </details>
      <div><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Questions from</span>
        <div className="grid gap-1 text-sm">
          <label className="flex gap-2"><input type="radio" checked={source === 'pool'} onChange={() => setSource('pool')} /> The question bank and past papers (instant)</label>
          <label className="flex gap-2"><input type="radio" checked={source === 'pattern'} onChange={() => setSource('pattern')} /> Follow the past-paper pattern (chapter weightage)</label>
          <label className={`flex gap-2 ${aiReady ? '' : 'opacity-50'}`}><input type="radio" disabled={!aiReady} checked={source === 'ai'} onChange={() => setSource('ai')} /> Fresh AI questions on chosen concepts{aiReady ? '' : ' (AI not switched on yet)'}</label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Questions"><input className="input w-full" type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} /></Field>
        <Field label="Difficulty"><select className="input w-full" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="very_hard">Very hard</option></select></Field>
        <Field label="Duration (min)"><input className="input w-full" inputMode="numeric" placeholder="exam rate" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Marks per question"><input className="input w-full" inputMode="decimal" placeholder="exam default" value={marks} onChange={(e) => setMarks(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        <Field label="Negative marks"><input className="input w-full" inputMode="decimal" placeholder="exam default" value={negative} onChange={(e) => setNegative(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
      </div>
      <Note r={r?.error ? r : null} />
      <button onClick={go} disabled={pending || !subjects.length || (source === 'ai' && !concepts.length)} className="btn-primary w-full py-2.5 disabled:opacity-50">{pending ? ui(lang, 'building') : ui(lang, 'createStart')}</button>
    </section>
  );
}
