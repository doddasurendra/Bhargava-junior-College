'use client';
import { QuizSet, type QView } from '@/components/openbook/client';
import { diagnosticAction } from '../actions';

export function Diagnostic({ examId, subject, questions }: { examId: string; subject: string; questions: QView[] }) {
  return <QuizSet questions={questions} submitLabel="Finish diagnostic" onSubmit={(a) => diagnosticAction(examId, subject, a) as never} />;
}
