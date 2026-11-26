'use client';
import { QuizSet, type QView } from '@/components/openbook/client';
import { challengeAction } from '../actions';

export function ChallengeSet({ subject, questions, lang = 'en' }: { subject: string; questions: QView[]; lang?: 'en' | 'te' | 'hi' }) {
  return <QuizSet questions={questions} submitLabel={`Submit ${subject} challenge`} lang={lang} onSubmit={(a) => challengeAction(subject, a) as never} />;
}
