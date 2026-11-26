import Link from 'next/link';
import { aiConfigured } from '@/lib/openbook/llm';
import { pickerOptions } from '@/lib/openbook/options';
import { formulaSheet } from '@/lib/openbook/revision';
import { obStudent } from '@/lib/openbook/session';
import { EXAM_BY_ID } from '@/lib/openbook/taxonomy';
import { AiRevision, PrintButton } from './Client';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function RevisionPage({ searchParams }: { searchParams: { subject?: string; chapter?: string } }) {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'revision');
  const o = await pickerOptions();
  const exam = EXAM_BY_ID.get(me.defaultExam)!;
  const subject = searchParams.subject && exam.subjects.includes(searchParams.subject) ? searchParams.subject : exam.subjects[0];
  const chs = o.chapters.filter((c) => c.subject === subject && exam.classes.includes(c.cls as '11'));
  const chapter = chs.find((c) => c.name === searchParams.chapter)?.name ?? chs[0]?.name ?? '';
  const s = chapter ? await formulaSheet(me.studentId, subject, chapter) : null;
  return (
    <div className="space-y-4">
      <div className="print:hidden"><H1 sub={pg.sub}>{pg.title}</H1></div>
      <form className="card grid gap-2 p-3 sm:grid-cols-3 print:hidden">
        <select name="subject" defaultValue={subject} className="input" aria-label="Subject">{exam.subjects.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="chapter" defaultValue={chapter} className="input" aria-label="Chapter">{chs.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <button className="btn-primary py-2">Show</button>
      </form>
      {s && (
        <article className="card space-y-4 p-5 print:border-0 print:p-0 print:shadow-none">
          <header className="border-b border-line pb-2"><p className="text-[11px] uppercase tracking-wider text-muted">Bhargava Junior College · Open Book</p><h2 className="font-display text-xl text-heading">{s.subject} · {s.chapter}</h2><p className="text-[11px] text-muted">For {me.name} · {new Date().toISOString().slice(0, 10)} · based on {s.basis}</p></header>
          <section><h3 className="mb-1 text-sm font-semibold text-heading">Key concepts</h3><p className="text-sm">{s.concepts.join(' · ') || '—'}</p></section>
          <section><h3 className="mb-1 text-sm font-semibold text-heading">Formulas</h3>{s.formulas.length ? <ul className="grid gap-1 sm:grid-cols-2">{s.formulas.map((f) => <li key={f.text} className="rounded bg-bg px-2 py-1 font-mono text-sm print:bg-transparent">{f.text} <span className="font-sans text-[10px] text-muted">· {f.concept}</span></li>)}</ul> : <p className="text-sm text-muted">No formulas recorded for this chapter yet. They come from worked solutions of questions you practise and from your formula cards.</p>}</section>
          {s.definitions.length > 0 && <section><h3 className="mb-1 text-sm font-semibold text-heading">My definitions and formula cards</h3><dl className="space-y-1 text-sm">{s.definitions.map((d, i) => <div key={i}><dt className="font-semibold">{d.term}</dt><dd className="text-muted">{d.meaning}</dd></div>)}</dl></section>}
          {s.weak.length > 0 && <section><h3 className="mb-1 text-sm font-semibold text-heading">Revise first (your weak concepts)</h3><ul className="list-disc pl-5 text-sm">{s.weak.map((w) => <li key={w.concept}>{w.concept}: {w.score}% over {w.attempts} questions</li>)}</ul></section>}
          {s.revisionList.length > 0 && <section><h3 className="mb-1 text-sm font-semibold text-heading">From my revision list (all books)</h3><ul className="space-y-1 text-sm">{s.revisionList.map((n, i) => <li key={i}>{n.text && `“${n.text.slice(0, 200)}”`} {n.note && <span className="text-muted">✎ {n.note}</span>} <Link className="text-[11px] underline print:hidden" href={`/app/openbook/book/${n.bookId}?page=${n.page}`}>p. {n.page}</Link></li>)}</ul></section>}
          <AiRevision subject={s.subject} chapter={s.chapter} enabled={aiConfigured()} />
        </article>
      )}
      <div className="print:hidden"><PrintButton /></div>
    </div>
  );
}
