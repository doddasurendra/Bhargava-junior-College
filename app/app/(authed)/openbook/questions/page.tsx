import { QuestionCard } from '@/components/openbook/client';
import { myQuestions } from '@/lib/openbook/questions';
import { obStudent } from '@/lib/openbook/session';
import { H1, Pager } from '../ui';

export const dynamic = 'force-dynamic';

export default async function MyQuestionsPage({ searchParams }: { searchParams: { subject?: string; page?: string } }) {
  const me = await obStudent();
  const all = await myQuestions(me.studentId, { subject: searchParams.subject });
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1), size = 20;
  const pages = Math.max(1, Math.ceil(all.length / size));
  const concepts = new Set(all.map((q) => q.conceptKey)).size;
  return (
    <div className="space-y-4">
      <H1 sub={`${all.length} questions across ${concepts} concepts: generated, scanned and saved. Every one passed the duplicate checks shown on it.`}>My Questions</H1>
      <form className="flex gap-2"><select name="subject" defaultValue={searchParams.subject ?? ''} className="input flex-1" aria-label="Subject"><option value="">All subjects</option>{[...new Set(all.map((q) => q.subject))].map((s) => <option key={s}>{s}</option>)}</select><button className="btn-outline px-3">Filter</button></form>
      {all.length === 0 && <p className="card p-4 text-sm text-muted">No questions yet. Generate some with the AI Question Generator or scan one.</p>}
      {all.slice((page - 1) * size, page * size).map((q, i) => <QuestionCard key={q.id} q={q} n={(page - 1) * size + i + 1} />)}
      <Pager page={page} pages={pages} href={(p) => `/app/openbook/questions?page=${p}${searchParams.subject ? `&subject=${encodeURIComponent(searchParams.subject)}` : ''}`} />
    </div>
  );
}
