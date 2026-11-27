import { notFound, redirect } from 'next/navigation';
import { ExamRunner } from '@/components/openbook/ExamRunner';
import { closedSubmit } from '@/lib/openbook/closedExam';
import { getAttempt, getMock } from '@/lib/openbook/mocks';
import { getQuestions } from '@/lib/openbook/questions';
import { obStudent } from '@/lib/openbook/session';

export const metadata = { title: 'Examination', robots: { index: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The closed-book exam screen. It sits outside the app's layout on purpose: no menu, no links to study
 * material, notes or the AI assistant while the exam is running. [id] = attempt id.
 */
export default async function ExamPage({ params }: { params: { id: string } }) {
  const me = await obStudent();
  const a = await getAttempt(me.studentId, params.id).catch(() => null);
  if (!a) notFound();
  const m = await getMock(a.mockId);
  if (!m?.closed) notFound();
  if (a.status === 'submitted') redirect(`/app/exam/report/${a.id}`);
  if (Date.now() > Date.parse(a.endsAt) + 15_000) {
    await closedSubmit(me.studentId, me.batchId, a.id, a.deviceId ?? '', true).catch(() => undefined);
    redirect(`/app/exam/report/${a.id}`);
  }
  const qs = await getQuestions(m.questionIds);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ordered = (a.order.length ? a.order : m.questionIds).map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  return (
    <main className="min-h-screen bg-bg py-4">
      <ExamRunner attemptId={a.id} title={m.title} endsAt={a.endsAt} marks={m.marks} negative={m.negative} answers={a.answers} review={a.review} time={a.time}
        fullscreen={m.closed.fullscreen} maxFocusLoss={m.closed.maxFocusLoss} focusLosses={a.focusLosses} optionOrder={a.optionOrder}
        questions={ordered.map((q) => ({ id: q.id, type: q.type, stem: q.stem, options: q.options, subject: q.subject }))} />
    </main>
  );
}
