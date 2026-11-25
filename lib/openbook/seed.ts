import 'server-only';
import { QUESTIONS } from '../practice/bank';
import { obQuestions } from './collections';
import { chapters, store } from './core';
import { tagByKeywords } from './papers';
import { saveQuestion } from './questions';
import { PRACTICE_CHAPTER_ALIAS, type Difficulty } from './taxonomy';

/**
 * Brings the existing Practice question bank (lib/practice/bank.ts: 310 formula-generated questions whose
 * answers and worked solutions are correct by construction) into the Open Book bank, tagged to NCERT
 * chapters and concepts, so diagnostics, daily challenges and pool mocks have real questions from day one.
 * Idempotent: questions already imported (same fingerprint in the bank) are skipped.
 */
export async function importPracticeBank() {
  const chs = await chapters();
  const have = new Set((await obQuestions.list(store(), { k1: 'bank' })).map((r) => r.data.fingerprint));
  const { fingerprint } = await import('./text');
  let added = 0;
  const todo = QUESTIONS.filter((q) => !have.has(fingerprint(q.stem + ' ' + q.options.join(' '))));
  // parallel batches: ~620 writes would be too slow one by one on a serverless function
  for (let i = 0; i < todo.length; i += 25) await Promise.all(todo.slice(i, i + 25).map(async (q) => {
    const fp = fingerprint(q.stem + ' ' + q.options.join(' '));
    const chapter = PRACTICE_CHAPTER_ALIAS[q.chapter] ?? q.chapter;
    const subjectChs = chs.filter((c) => c.subject === q.subject && c.name === chapter);
    const concept = subjectChs.length ? tagByKeywords(q.stem, subjectChs).concept : q.chapter;
    const examId = q.subject === 'Biology' ? 'neet-ug' : q.curriculum.includes('JEE Main') ? 'jee-main' : q.curriculum.includes('NEET') ? 'neet-ug' : 'inter1-mpc';
    const difficulty: Difficulty = q.difficulty;
    await saveQuestion({
      origin: 'teacher', ownerId: null, target: { examId, subject: q.subject, chapter, concept }, type: 'mcq_single', difficulty, stem: q.stem, options: q.options, answer: [String(q.answer)],
      marks: 4, negative: 1, status: 'approved', ai: false, createdBy: { kind: 'system', id: 'practice-bank', name: 'Practice bank (formula-generated)' },
      explanation: { answer: q.options[q.answer], explanation: q.solution, steps: [q.solution], formulas: [], concepts: [concept], outcome: `Apply ${concept} in ${chapter}.`, mistakes: q.misconceptions.filter((m): m is string => !!m), related: [], whyOptions: q.options.map((o, i) => (i === q.answer ? `${o}: correct. ${q.solution}` : `${o}: ${q.misconceptions[i] ?? 'incorrect'}`)) },
    });
    have.add(fp);
    added++;
  }));
  return added;
}
