'use client';
import { QuizSet, type QView } from '@/components/openbook/client';
import { challengeAction } from '../actions';

export function ChallengeSet({ subject, questions }: { subject: string; questions: QView[] }) {
  return <QuizSet questions={questions} submitLabel={`Submit ${subject} challenge`} onSubmit={(a) => challengeAction(subject, a) as never} />;
}
