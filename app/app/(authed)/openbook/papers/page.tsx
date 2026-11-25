import Link from 'next/link';
import { BigFileInput } from '@/components/openbook/BigFileInput';
import { Field, ObForm } from '@/components/openbook/client';
import { pickerOptions } from '@/lib/openbook/options';
import { listPapers } from '@/lib/openbook/papers';
import { obStudent } from '@/lib/openbook/session';
import { uploadPaperAction } from '../actions';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STATUS: Record<string, string> = { done: 'questions extracted', ocr_needed: 'needs OCR', no_questions: 'no questions found', failed: 'extraction failed', pending: 'processing' };

export default async function PapersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const me = await obStudent();
  const [papers, mine, opts] = await Promise.all([
    listPapers({ examId: searchParams.exam, subject: searchParams.subject, year: searchParams.year ? Number(searchParams.year) : undefined, q: searchParams.q }),
    listPapers({ status: 'all', uploader: me.studentId }).then((x) => x.filter((p) => p.uploadedBy.id === me.studentId)),
    pickerOptions(),
  ]);
  const exams = opts.exams.filter((e) => e.ready);
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a);
  return (
    <div className="space-y-4">
      <H1 sub="Official papers, model papers and student uploads. Originals are kept unchanged.">Previous Year Papers</H1>
      <form className="card grid gap-2 p-3 sm:grid-cols-2">
        <input name="q" defaultValue={searchParams.q} className="input sm:col-span-2" placeholder="Search title, topic, board, session" aria-label="Search papers" />
        <select name="exam" defaultValue={searchParams.exam ?? ''} className="input" aria-label="Examination"><option value="">All examinations</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select name="subject" defaultValue={searchParams.subject ?? ''} className="input" aria-label="Subject"><option value="">All subjects</option>{[...new Set(exams.flatMap((e) => e.subjects))].map((s) => <option key={s}>{s}</option>)}</select>
        <select name="year" defaultValue={searchParams.year ?? ''} className="input" aria-label="Year"><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <button className="btn-primary py-2">Search</button>
      </form>
      <ul className="space-y-2">
        {papers.length === 0 && <li className="card p-4 text-sm text-muted">No approved papers match yet.</li>}
        {papers.map((p) => (
          <li key={p.id}><Link href={`/app/openbook/papers/${p.id}`} className="card block p-3 text-sm"><p className="font-semibold text-heading">{p.title}</p><p className="text-xs text-muted">{opts.exams.find((e) => e.id === p.examId)?.name} · {p.subject} · {p.year}{p.session ? ` · ${p.session}` : ''} · {p.paperType} · {p.extraction.count} questions{p.answerKey || p.solutionKey ? ' · answer key' : ''}</p></Link></li>
        ))}
      </ul>
      {mine.length > 0 && <section className="card p-3 text-sm"><p className="mb-1 font-semibold text-heading">My uploads</p><ul className="space-y-1">{mine.map((p) => <li key={p.id}><Link className="underline" href={`/app/openbook/papers/${p.id}`}>{p.title}</Link> <span className="text-xs text-muted">· {p.status === 'pending' ? 'waiting for a teacher' : p.status} · {STATUS[p.extraction.status]}{p.extraction.count ? ` (${p.extraction.count})` : ''}</span></li>)}</ul></section>}
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-heading">Upload a previous-year paper</h2>
        <p className="mb-3 text-xs text-muted">PDF, Word (.docx), JPG or PNG, including scans and handwritten papers. A teacher checks it before it is shared. Upload only papers you are allowed to share (official papers are public; don’t upload copyrighted books).</p>
        <ObForm action={uploadPaperAction} submit="Upload and extract questions">
          <BigFileInput name="file" accept=".pdf,.docx,.doc,image/jpeg,image/png" label="Question paper" required maxMb={25} />
          <Field label="Title"><input name="title" required className="input w-full" placeholder="JEE Main 2024 January Shift 1 Physics" /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Examination"><select name="examId" className="input w-full" defaultValue={me.defaultExam}>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <Field label="Subject"><select name="subject" className="input w-full">{['All subjects', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Year"><input name="year" type="number" min={1990} max={2100} required className="input w-full" defaultValue={new Date().getFullYear() - 1} /></Field>
            <Field label="Session / shift"><input name="session" className="input w-full" placeholder="January, Shift 1" /></Field>
            <Field label="Board / conducting body"><input name="board" className="input w-full" placeholder="NTA, TSBIE…" /></Field>
            <Field label="Paper type"><select name="paperType" className="input w-full"><option value="official">Official</option><option value="board">Board exam</option><option value="model">Model paper</option><option value="mock">Mock test</option><option value="handwritten">Handwritten</option><option value="other">Other</option></select></Field>
            <Field label="Year (Inter)"><select name="cls" className="input w-full"><option value="na">Not applicable</option><option value="11">1st year</option><option value="12">2nd year</option><option value="both">Both years</option></select></Field>
            <Field label="Difficulty"><select name="difficulty" className="input w-full"><option value="">Not sure</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field>
          </div>
          <Field label="Topics (comma separated, optional)"><input name="topics" className="input w-full" /></Field>
          <Field label="Answer key (optional, e.g. 1-B, 2-C, 3-4.5)"><textarea name="answerKey" rows={2} className="input w-full" /></Field>
          <BigFileInput name="solution" accept=".pdf,image/jpeg,image/png" label="Solutions file (optional)" maxMb={25} />
        </ObForm>
      </section>
    </div>
  );
}
