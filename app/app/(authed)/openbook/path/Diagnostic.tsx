'use client';
import { QuizSet, type QView } from '@/components/openbook/client';
import { diagnosticAction } from '../actions';

export function Diagnostic({ examId, subject, questions, lang = 'en' }: { examId: string; subject: string; questions: QView[]; lang?: 'en' | 'te' | 'hi' }) {
  return <QuizSet questions={questions} submitLabel="Finish diagnostic" lang={lang} onSubmit={(a) => diagnosticAction(examId, subject, a) as never} />;
}
