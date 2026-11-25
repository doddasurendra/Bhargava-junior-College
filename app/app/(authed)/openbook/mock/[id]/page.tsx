import { notFound, redirect } from 'next/navigation';
import { MockRunner } from '@/components/openbook/MockRunner';
import { getAttempt, getMock, submit } from '@/lib/openbook/mocks';
import { getQuestions } from '@/lib/openbook/questions';
import { obStudent } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** [id] = the attempt id. Resumes where the student left off; submits automatically if time is already up. */
export default async function MockAttemptPage({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const a = await getAttempt(me.studentId, params.id).catch(() => null);
  if (!a) notFound();
  if (a.status === 'submitted') redirect(`/app/openbook/mock/report/${a.id}`);
  if (Date.now() > Date.parse(a.endsAt) + 15_000) { await submit(me.studentId, me.batchId, a.id, true); redirect(`/app/openbook/mock/report/${a.id}`); }
  const m = await getMock(a.mockId);
  if (!m) notFound();
  const qs = await getQuestions(m.questionIds);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-xl text-heading">{m.title}</h1>
      <MockRunner attemptId={a.id} endsAt={a.endsAt} marks={m.marks} negative={m.negative} initialAnswers={a.answers} initialReview={a.review} initialTime={a.time}
        questions={qs.map((q) => ({ id: q.id, type: q.type, stem: q.stem, options: q.options, subject: q.subject }))} />
    </div>
  );
}
