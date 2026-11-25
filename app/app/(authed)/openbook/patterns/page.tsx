import { patternAnalysis } from '@/lib/openbook/papers';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { PatternMock } from './PatternMock';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';

export default async function PatternsPage({ searchParams }: { searchParams: { exam?: string; subject?: string } }) {
  const me = await obStudent();
  const o = await pickerOptions();
  const examId = searchParams.exam ?? me.defaultExam;
  const exam = o.exams.find((e) => e.id === examId)!;
  const subject = searchParams.subject && exam.subjects.includes(searchParams.subject) ? searchParams.subject : exam.subjects[0];
  const a = await patternAnalysis(examId, subject);
  const max = Math.max(1, ...a.chapters.flatMap((c) => c.perYear));
  return (
    <div className="space-y-4">
      <H1 sub={a.basis.note}>Pattern Analyzer</H1>
      <form className="card grid gap-2 p-3 sm:grid-cols-3">
        <select name="exam" defaultValue={examId} className="input" aria-label="Examination">{o.exams.filter((e) => e.ready).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select name="subject" defaultValue={subject} className="input" aria-label="Subject">{exam.subjects.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn-primary py-2">Analyse</button>
      </form>
      <p className="rounded-lg bg-bg px-3 py-2 text-sm"><b>Data basis:</b> {a.basis.papers} papers, {a.basis.questions} questions, {a.basis.years}.</p>
      {a.basis.questions === 0 ? <p className="card p-4 text-sm text-muted">No approved past papers with extracted questions for {exam.name} {subject} yet. Upload papers in Previous Year Papers; teachers approve them.</p> : (
        <>
          <section className="card overflow-x-auto p-4"><h2 className="mb-2 text-sm font-semibold text-heading">Chapter weightage by year (questions)</h2>
            <table className="w-full text-xs"><thead><tr><th className="text-left">Chapter</th>{a.years.map((y) => <th key={y} className="px-1">{y}</th>)}<th className="px-1">Total</th><th className="px-1">Trend</th></tr></thead>
              <tbody>{a.chapters.map((c) => <tr key={c.chapter}><td className="py-0.5 pr-2">{c.chapter}</td>{c.perYear.map((n, i) => <td key={i} className="px-1 text-center" style={{ background: n ? `rgba(122,31,43,${0.15 + (n / max) * 0.7})` : undefined, color: n / max > 0.5 ? '#fff' : undefined }}>{n || ''}</td>)}<td className="px-1 text-center font-semibold">{c.count} ({c.weight}%)</td><td className="px-1 text-center">{c.trend === 'rising' ? '↑' : c.trend === 'falling' ? '↓' : '→'}</td></tr>)}</tbody></table>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">High-yield chapters</h2><ul className="space-y-1">{a.highYield.map((h) => <li key={h.chapter} className="flex items-center gap-2"><span className="h-2 rounded bg-maroon" style={{ width: `${Math.max(4, h.weight)}%` }} />{h.chapter} <span className="text-xs text-muted">{h.weight}% {h.trend}</span></li>)}</ul></section>
            <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Not asked in these papers</h2>{a.neverAsked.length ? <p className="text-muted">{a.neverAsked.join(' · ')}</p> : <p className="text-muted">Every chapter appeared.</p>}<p className="mt-1 text-[11px] text-muted">Not asked yet is not the same as “will be asked”: study the full syllabus.</p></section>
            <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Question types</h2><ul>{a.types.map((t) => <li key={t.k}>{t.k}: {t.n} ({t.pct}%)</li>)}</ul></section>
            <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Difficulty</h2><ul>{a.difficulty.map((t) => <li key={t.k}>{t.k.replace('_', ' ')}: {t.n} ({t.pct}%)</li>)}</ul></section>
          </div>
          <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Most repeated concepts</h2><ul className="space-y-0.5">{a.concepts.slice(0, 12).map((c) => <li key={c.k}>{c.k} <span className="text-xs text-muted">{c.n}×</span></li>)}</ul></section>
          {a.repeated.length > 0 && <section className="card p-4 text-sm"><h2 className="mb-2 font-semibold text-heading">Frequently repeated questions (similar across years)</h2><ul className="space-y-1">{a.repeated.slice(0, 10).map((r) => <li key={r.a + r.b}>“{r.stem}…” <span className="text-xs text-muted">{r.years} · {Math.round(r.score * 100)}% similar</span></li>)}</ul></section>}
          <PatternMock examId={examId} subject={subject} />
        </>
      )}
    </div>
  );
}
