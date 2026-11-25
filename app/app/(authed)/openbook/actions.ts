'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as A from '@/lib/openbook/assistant';
import * as Ch from '@/lib/openbook/challenge';
import * as Co from '@/lib/openbook/community';
import { OpenBookError, readFile } from '@/lib/openbook/core';
import * as F from '@/lib/openbook/flashcards';
import * as L from '@/lib/openbook/library';
import * as M from '@/lib/openbook/mocks';
import * as P from '@/lib/openbook/papers';
import * as Pa from '@/lib/openbook/path';
import * as Q from '@/lib/openbook/questions';
import * as Sc from '@/lib/openbook/scanner';
import { obStudent } from '@/lib/openbook/session';
import type { Difficulty, QType } from '@/lib/openbook/taxonomy';

export interface R<T = unknown> { ok?: boolean; error?: string; message?: string; data?: T }

async function run<T>(fn: () => Promise<T>, msg?: string, paths: string[] = []): Promise<R<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, data, message: msg };
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof OpenBookError || (e instanceof Error && e.constructor.name === 'SchoolError')) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[openbook] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
/** A file sent with the form, or one uploaded directly to storage (only under this user's own staging prefix). */
const file = async (fd: FormData, k: string, who?: string) => {
  const staged = fd.get(`__key`);
  if (typeof staged === 'string' && staged) {
    if (!who || !staged.startsWith(`openbook/staging//`)) throw new OpenBookError('Upload not found. Please choose the file again.');
    const bytes = await readFile(staged);
    if (!bytes) throw new OpenBookError('Upload not found. Please choose the file again.');
    const name = String(fd.get(`__name`) ?? 'file');
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return { name, bytes, mime: ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'pdf' ? 'application/pdf' : '' };
  }
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type } : null;
};

// ---------------------------------------------------------------- reader
export async function readerProgress(bookId: string, page: number, seconds: number) {
  const me = await obStudent();
  return run(() => L.saveProgress(me.studentId, bookId, page, seconds));
}
export async function readerBookmark(bookId: string, page: number, label: string | null) {
  const me = await obStudent();
  return run(() => L.addBookmark(me.studentId, bookId, page, label), 'Bookmarked.', ['/app/openbook/bookmarks']);
}
export async function readerNote(bookId: string, page: number, text: string, color: 'yellow' | 'green' | 'blue' | 'pink' | null, note: string | null, revision = false) {
  const me = await obStudent();
  return run(() => L.addNote(me.studentId, { bookId, page, text: text.slice(0, 4000), color, note: note?.slice(0, 4000) ?? null, revision }), revision ? 'Added to your revision list.' : 'Saved.', ['/app/openbook/notes']);
}
export async function readerFavourite(bookId: string) {
  const me = await obStudent();
  return run(() => L.toggleFavourite(me.studentId, bookId), undefined, ['/app/openbook']);
}
export async function readerAsk(input: { task: A.Task; question: string; lang: A.Lang; bookId: string | null; pages?: number[]; selection?: string | null; sessionId?: string | null }) {
  const me = await obStudent();
  return run(() => A.ask({ ...input, studentId: me.studentId, kind: input.task.startsWith('tutor') ? 'tutor' : input.bookId ? 'reader' : 'assistant' }));
}
export async function readerQuestions(bookId: string, passage: string, examId: string) {
  const me = await obStudent();
  return run(async () => {
    const c = await Sc.classify(examId, passage);
    return Q.generate(me.actor, me.studentId, { examId, subject: c.subject, chapter: c.chapter, concept: c.concept, types: ['mcq_single'], difficulty: 'medium', count: 5, context: passage });
  });
}
export async function readerCards(passage: string, examId: string, bookTitle: string) {
  const me = await obStudent();
  return run(async () => {
    const c = await Sc.classify(examId, passage);
    return F.aiCards(me.studentId, { source: 'passage', subject: c.subject, chapter: c.chapter, text: passage, count: 8, deckName: `From ${bookTitle}`.slice(0, 120) });
  }, 'Flashcards added.');
}
export async function removeNoteAction(id: string) {
  const me = await obStudent();
  return run(() => L.removeNote(me.studentId, id), 'Removed.', ['/app/openbook/notes']);
}
export async function removeBookmarkAction(id: string) {
  const me = await obStudent();
  return run(() => L.removeBookmark(me.studentId, id), 'Removed.', ['/app/openbook/bookmarks']);
}

// ---------------------------------------------------------------- papers
export async function uploadPaperAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  return run(async () => {
    const f = await file(fd, 'file', me.studentId);
    if (!f) throw new OpenBookError('Choose the question paper file.');
    return P.uploadPaper(me.actor, false, f, {
      title: s(fd, 'title') ?? f.name, examId: s(fd, 'examId') ?? 'jee-main', board: s(fd, 'board'), subject: s(fd, 'subject') ?? 'Physics', topics: (s(fd, 'topics') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      year: Number(s(fd, 'year') ?? 0), session: s(fd, 'session'), paperType: (s(fd, 'paperType') ?? 'official') as P.PaperMeta['paperType'], difficulty: (s(fd, 'difficulty') as Difficulty) ?? null, cls: (s(fd, 'cls') ?? 'na') as P.PaperMeta['cls'], licence: 'student_upload', answerKey: s(fd, 'answerKey'),
    }, await file(fd, 'solution', me.studentId));
  }, 'Uploaded. A teacher checks every student upload before it is shared; extraction has run (see your uploads).', ['/app/openbook/papers']);
}

// ---------------------------------------------------------------- generator & attempts
export async function generateAction(input: { examId: string; subject: string; chapter: string; concept: string; types: QType[]; difficulty: Difficulty; count: number }) {
  const me = await obStudent();
  return run(() => Q.generate(me.actor, me.studentId, input));
}
export async function attemptAction(questionId: string, given: string[], seconds: number) {
  const me = await obStudent();
  return run(async () => {
    const q = await Q.getQuestion(questionId);
    if (!q || (q.ownerId && q.ownerId !== me.studentId) || (!q.ownerId && q.status !== 'approved')) throw new OpenBookError('Question not found.');
    return Q.attempt(me.studentId, me.batchId, q, given, seconds, 'practice');
  });
}
export async function explainAction(questionId: string, level: 'standard' | 'simpler' | 'advanced', lang: 'en' | 'te' | 'hi') {
  const me = await obStudent();
  return run(async () => {
    const q = await Q.getQuestion(questionId);
    if (!q || (q.ownerId && q.ownerId !== me.studentId)) throw new OpenBookError('Question not found.');
    return Q.explainQuestion(me.studentId, q, level, lang);
  });
}

// ---------------------------------------------------------------- mocks
export async function createMockAction(input: M.MockInput) {
  const me = await obStudent();
  return run(() => M.createMock(me.actor, me.studentId, null, input));
}
export async function startMockAction(mockId: string) {
  const me = await obStudent();
  return run(() => M.startAttempt(me.studentId, me.batchId, mockId));
}
export async function saveMockAction(attemptId: string, patch: { answers?: Record<string, string[]>; review?: string[]; time?: Record<string, number> }) {
  const me = await obStudent();
  return run(() => M.saveAnswers(me.studentId, attemptId, patch));
}
export async function submitMockAction(attemptId: string, auto: boolean) {
  const me = await obStudent();
  return run(() => M.submit(me.studentId, me.batchId, attemptId, auto), undefined, ['/app/openbook/mock']);
}

// ---------------------------------------------------------------- flashcards
export async function rateCardAction(cardId: string, rating: F.Rating) {
  const me = await obStudent();
  return run(() => F.rate(me.studentId, cardId, rating));
}
export async function wrongAnswerCardsAction() {
  const me = await obStudent();
  return run(() => F.cardsFromWrongAnswers(me.studentId), undefined, ['/app/openbook/flashcards']);
}
export async function aiCardsAction(input: { source: 'concept' | 'chapter'; subject: string; chapter: string; concept?: string; count: number }) {
  const me = await obStudent();
  return run(() => F.aiCards(me.studentId, input), undefined, ['/app/openbook/flashcards']);
}
export async function manualCardAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  return run(async () => {
    const name = s(fd, 'deck') ?? 'My cards';
    const decks = await F.decksOf(me.studentId, null);
    const deckId = decks.find((d) => d.mine && d.name === name)?.id ?? (await F.createDeck(me.studentId, 'student', name, s(fd, 'subject'), null));
    return F.addCard(me.studentId, deckId, { kind: (s(fd, 'kind') ?? 'qa') as 'qa', front: s(fd, 'front') ?? '', back: s(fd, 'back') ?? '', source: 'manual' });
  }, 'Card added.', ['/app/openbook/flashcards']);
}
export async function shareDeckAction(deckId: string) {
  const me = await obStudent();
  return run(async () => { if (!me.batchId) throw new OpenBookError('You are not in a batch yet.'); return F.shareDeck(me.studentId, deckId, me.batchId); }, 'Sent to your teacher for approval.', ['/app/openbook/flashcards']);
}
export async function copyDeckAction(deckId: string) {
  const me = await obStudent();
  return run(() => F.copySharedDeck(me.studentId, deckId), 'Copied to your decks.', ['/app/openbook/flashcards']);
}

// ---------------------------------------------------------------- learning path
export async function buildPathAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  return run(async () => {
    const minutes = Number(s(fd, 'minutes') ?? 60);
    await Ch.saveProfile(me.studentId, { dailyMinutes: minutes });
    return Pa.buildPath(me.studentId, { examId: s(fd, 'examId') ?? me.defaultExam, examDate: s(fd, 'examDate') ?? '', minutesPerDay: minutes });
  }, 'Your learning path is ready.', ['/app/openbook/path']);
}
export async function diagnosticAction(examId: string, subject: string, answers: Record<string, string>) {
  const me = await obStudent();
  return run(async () => {
    const r = await Pa.submitDiagnostic(me.studentId, examId, subject, answers);
    const p = await Pa.pathOf(me.studentId);
    if (p) await Pa.buildPath(me.studentId, { examId: p.examId, examDate: p.examDate, minutesPerDay: p.minutesPerDay });
    return r;
  }, undefined, ['/app/openbook/path']);
}

// ---------------------------------------------------------------- challenge & profile
export async function challengeAction(subject: string, answers: Record<string, string>) {
  const me = await obStudent();
  return run(() => Ch.submitChallenge(me.studentId, subject, answers), undefined, ['/app/openbook/challenge']);
}
export async function profileAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  return run(() => Ch.saveProfile(me.studentId, { nickname: s(fd, 'nickname') ?? undefined, optOut: fd.get('optOut') === 'on', lang: (s(fd, 'lang') ?? 'en') as 'en' }), 'Saved.', ['/app/openbook']);
}

// ---------------------------------------------------------------- community
export async function postThreadAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  return run(async () => {
    const r = await Co.createThread(me.actor, { title: s(fd, 'title') ?? '', body: s(fd, 'body') ?? '', subject: s(fd, 'subject') ?? 'Physics', chapter: s(fd, 'chapter'), concept: s(fd, 'concept'), image: await file(fd, 'image', me.studentId), duplicateOf: s(fd, 'duplicateOf') });
    return r.id;
  }, 'Posted.', ['/app/openbook/community']);
}
export async function similarAction(text: string, subject: string | null) {
  await obStudent();
  return run(() => Co.similarThreads(text, subject));
}
export async function answerAction(_: R, fd: FormData): Promise<R> {
  const me = await obStudent();
  const id = s(fd, 'threadId') ?? '';
  return run(() => Co.answer(me.actor, id, s(fd, 'body') ?? ''), 'Answer posted.', [`/app/openbook/community/${id}`]);
}
export async function voteAction(postId: string, threadId: string) {
  const me = await obStudent();
  return run(() => Co.vote(me.studentId, postId), undefined, [`/app/openbook/community/${threadId}`]);
}
export async function acceptAction(threadId: string, answerId: string) {
  const me = await obStudent();
  return run(() => Co.accept(me.studentId, threadId, answerId), 'Accepted.', [`/app/openbook/community/${threadId}`]);
}
export async function reportAction(postId: string, threadId: string, reason: string) {
  const me = await obStudent();
  return run(() => Co.report(me.studentId, postId, reason), 'Thanks. A moderator will check it.', [`/app/openbook/community/${threadId}`]);
}
export async function aiSuggestAction(threadId: string) {
  const me = await obStudent();
  return run(() => Co.aiSuggest(me.actor, threadId), 'AI suggestion added (labelled AI).', [`/app/openbook/community/${threadId}`]);
}

// ---------------------------------------------------------------- scanner
export async function scanAction(fd: FormData) {
  const me = await obStudent();
  return run(async () => {
    const f = await file(fd, 'image');
    if (!f) throw new OpenBookError('Take or choose a photo first.');
    return Sc.scan(me.studentId, s(fd, 'examId') ?? me.defaultExam, f);
  });
}
export async function classifyAction(examId: string, text: string) {
  await obStudent();
  return run(() => Sc.classify(examId, text));
}
type ScanQ = { examId: string; subject: string; chapter: string; concept: string; text: string; difficulty: Difficulty; imageKey: string | null };
export async function solveAction(q: ScanQ) {
  const me = await obStudent();
  return run(() => Sc.solve(me.actor, me.studentId, q));
}
export async function similarQuestionsAction(q: ScanQ) {
  const me = await obStudent();
  return run(() => Q.generate(me.actor, me.studentId, { examId: q.examId, subject: q.subject, chapter: q.chapter, concept: q.concept, types: ['mcq_single'], difficulty: q.difficulty, count: 5, context: q.text }));
}
export async function saveScanAction(q: ScanQ) {
  const me = await obStudent();
  return run(() => Sc.saveToMyBank(me.actor, me.studentId, q), 'Saved to your questions.');
}
export async function scanCardAction(q: ScanQ, answer: string) {
  const me = await obStudent();
  return run(async () => {
    const decks = await F.decksOf(me.studentId, null);
    const deckId = decks.find((d) => d.mine && d.name === 'Scanned questions')?.id ?? (await F.createDeck(me.studentId, 'student', 'Scanned questions', q.subject, q.chapter));
    return F.addCard(me.studentId, deckId, { kind: 'qa', front: q.text.slice(0, 2000), back: answer || 'Answer: (add it after you solve it)', source: 'manual' });
  }, 'Added to flashcards.');
}
export async function scanPostAction(q: ScanQ) {
  const me = await obStudent();
  return run(async () => (await Co.createThread(me.actor, { title: q.text.split('\n')[0].slice(0, 120) || 'Question', body: q.text, subject: q.subject, chapter: q.chapter, concept: q.concept })).id, 'Posted to the community.');
}
export async function scanDoubtAction(q: ScanQ) {
  const me = await obStudent();
  return run(() => Sc.sendAsDoubt(me.studentId, q.subject, q.text), 'Sent to your teachers as a doubt.');
}

// ---------------------------------------------------------------- conversations
export async function deleteSessionAction(id: string) {
  const me = await obStudent();
  return run(() => A.deleteSession(me.studentId, id), 'Deleted.', ['/app/openbook/assistant', '/app/openbook/tutor']);
}
