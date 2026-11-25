import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuestionCard } from '@/components/openbook/client';
import { getPaper, paperQuestions } from '@/lib/openbook/papers';
import { obStudent } from '@/lib/openbook/session';
import { EXAM_BY_ID } from '@/lib/openbook/taxonomy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PaperPage({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const p = await getPaper(params.id);
  if (!p || (p.status !== 'approved' && p.uploadedBy.id !== me.studentId)) notFound();
  const qs = await paperQuestions(p.id);
  const isImage = p.mime.startsWith('image/');
  return (
    <div className="space-y-4">
      <section className="card space-y-1 p-4 text-sm">
        <h1 className="font-display text-xl text-heading">{p.title}</h1>
        <p className="text-muted">{EXAM_BY_ID.get(p.examId)?.name} · {p.subject} · {p.year}{p.session ? ` · ${p.session}` : ''}{p.board ? ` · ${p.board}` : ''} · {p.paperType}</p>
        {p.status !== 'approved' && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Waiting for a teacher to check it. Only you can see it now.</p>}
        <p className="text-xs text-muted">Extraction: {p.extraction.status.replace('_', ' ')}{p.extraction.method ? ` (${p.extraction.method})` : ''}{p.extraction.confidence !== null ? ` · confidence ${Math.round(p.extraction.confidence * 100)}%` : ''}{p.extraction.error ? ` · ${p.extraction.error}` : ''}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-outline px-3 py-1 text-xs" href={`/api/openbook/file?k=paper&id=${p.id}`} target="_blank" rel="noopener noreferrer">Preview original</a>
          <a className="btn-outline px-3 py-1 text-xs" href={`/api/openbook/file?k=paper&id=${p.id}&download=1`}>Download</a>
          {p.solutionKey && <a className="btn-outline px-3 py-1 text-xs" href={`/api/openbook/file?k=solution&id=${p.id}`} target="_blank" rel="noopener noreferrer">Solutions</a>}
          <Link className="btn-outline px-3 py-1 text-xs" href={`/app/openbook/patterns?exam=${p.examId}&subject=${encodeURIComponent(p.subject)}`}>Pattern analysis</Link>
        </div>
      </section>
      {isImage ? <img src={`/api/openbook/file?k=paper&id=${p.id}`} alt="Original paper" className="w-full rounded-lg border border-line" /> : p.mime === 'application/pdf' ? <iframe title="Original paper" src={`/api/openbook/file?k=paper&id=${p.id}`} className="h-[60vh] w-full rounded-lg border border-line" /> : null}
      {p.answerKey && <details className="card p-3 text-sm"><summary className="cursor-pointer font-semibold">Answer key</summary><p className="mt-2 whitespace-pre-line font-mono text-xs">{p.answerKey}</p></details>}
      <h2 className="text-sm font-semibold text-heading">Extracted questions ({qs.length})</h2>
      {qs.length === 0 && <p className="card p-3 text-sm text-muted">{p.extraction.status === 'ocr_needed' ? 'This paper is a scan or photo. Its questions will be read automatically once OCR is switched on; the original is stored safely.' : 'No questions could be extracted from this file.'}</p>}
      {qs.map((q, i) => <QuestionCard key={q.id} n={i + 1} q={{ ...q, similarity: null }} />)}
    </div>
  );
}
