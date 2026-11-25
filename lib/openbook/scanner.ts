import 'server-only';
import { z } from 'zod';
import { sniff } from '../kb/extract';
import { askDoubt } from '../school/academics';
import { obSessions } from './collections';
import { chaptersFor, examOrThrow, need, OpenBookError, putFile, store, useQuota, type Actor } from './core';
import { AiNotConfigured, aiConfigured, callJson, S } from './llm';
import { tagByKeywords } from './papers';
import { saveQuestion } from './questions';
import { DIFFICULTIES, QTYPES, type Difficulty, type QType } from './taxonomy';

/**
 * Handwritten / printed question scanner (§23). The original photo is stored privately and never changed.
 * OCR (text + math) uses Claude vision and needs ANTHROPIC_API_KEY; the recognised text is always shown in
 * an editable box with a confidence score so the student can fix mistakes before anything else happens.
 * Without the key the student can still type the question and use the non-AI actions (save, flashcard,
 * community, send to a teacher as a doubt).
 */
const ocrSchema = S.obj({
  confidence: S.num(),
  questions: S.arr(S.obj({ text: S.str('the question exactly as written, options on their own lines'), latex: S.str('the math in LaTeX, or empty'), subject: S.str(), chapter: S.str(), concept: S.str(), type: S.enum(QTYPES.map((q) => q.id)), difficulty: S.enum([...DIFFICULTIES]) })),
});
const ocrValidate = z.object({ confidence: z.number(), questions: z.array(z.object({ text: z.string(), latex: z.string(), subject: z.string(), chapter: z.string(), concept: z.string(), type: z.string(), difficulty: z.string() })) });

export interface ScanResult { imageKey: string; confidence: number | null; questions: { text: string; latex: string; subject: string; chapter: string; concept: string; type: QType; difficulty: Difficulty }[]; ocr: 'ai' | 'not_configured' }

export async function scan(studentId: string, examId: string, file: { name: string; bytes: Uint8Array }): Promise<ScanResult> {
  const s = sniff(file.name, file.bytes);
  if ('error' in s) throw new OpenBookError(s.error);
  need(s.kind === 'image' || s.kind === 'pdf', 'Take a photo or upload an image (JPG/PNG) or a PDF page.');
  need(file.bytes.length <= 10 * 1024 * 1024, 'Images can be up to 10 MB.');
  const imageKey = await putFile('scan', file.bytes, s.mime);
  if (!aiConfigured()) return { imageKey, confidence: null, questions: [], ocr: 'not_configured' };
  await useQuota(studentId, 'ai');
  const exam = examOrThrow(examId);
  const chs = (await Promise.all(exam.subjects.map((sub) => chaptersFor(examId, sub)))).flat();
  const r = await callJson({
    system: `You read photos of handwritten or printed exam questions (English; text may also be in Telugu or Hindi). The photo may be tilted, shadowed or cropped: read it as well as possible. Transcribe each separate question exactly; do not solve or change it; write [illegible] for parts you can't read. Put math as readable Unicode text in "text" and as LaTeX in "latex". Describe any diagram in square brackets. Classify each question into one of these subjects/chapters/concepts for ${exam.name}:\n${chs.map((c) => `${c.subject} | ${c.name}: ${c.concepts.join('; ')}`).join('\n').slice(0, 24000)}\n"confidence" (0–1) is how sure you are of the transcription.`,
    parts: [s.kind === 'pdf' ? { kind: 'pdf', data: file.bytes } : { kind: 'image', mime: s.mime as 'image/png', data: file.bytes }, { kind: 'text', text: 'Transcribe and classify every question in this image.' }],
    jsonSchema: ocrSchema, validate: ocrValidate, effort: 'medium', maxTokens: 12000,
  });
  return {
    imageKey, confidence: Math.max(0, Math.min(1, r.data.confidence)), ocr: 'ai',
    questions: r.data.questions.map((q) => {
      const known = chs.find((c) => c.subject === q.subject && c.name === q.chapter);
      const tag = known ? { chapter: known.name, concept: q.concept } : tagByKeywords(q.text, chs.filter((c) => c.subject === q.subject).length ? chs.filter((c) => c.subject === q.subject) : chs);
      return { text: q.text, latex: q.latex, subject: exam.subjects.includes(q.subject) ? q.subject : known?.subject ?? exam.subjects[0], chapter: tag.chapter, concept: tag.concept || q.concept, type: (QTYPES.some((t) => t.id === q.type) ? q.type : 'short') as QType, difficulty: ((DIFFICULTIES as readonly string[]).includes(q.difficulty) ? q.difficulty : 'medium') as Difficulty };
    }),
  };
}

/** Keyword classification for typed (or corrected) text when the student changes it. */
export async function classify(examId: string, text: string) {
  const exam = examOrThrow(examId);
  const chs = (await Promise.all(exam.subjects.map((sub) => chaptersFor(examId, sub)))).flat();
  const tag = tagByKeywords(text, chs);
  return { subject: chs.find((c) => c.name === tag.chapter)?.subject ?? exam.subjects[0], chapter: tag.chapter, concept: tag.concept };
}

const solveSchema = S.obj({ type: S.enum(QTYPES.map((q) => q.id)), options: S.arr(S.str()), answer: S.arr(S.str()), explanation: S.obj({ answer: S.str(), explanation: S.str(), steps: S.arr(S.str()), formulas: S.arr(S.str()), concepts: S.arr(S.str()), outcome: S.str(), mistakes: S.arr(S.str()), related: S.arr(S.str()), whyOptions: S.arr(S.str()) }) });
const solveValidate = z.object({ type: z.string(), options: z.array(z.string()), answer: z.array(z.string()), explanation: z.object({ answer: z.string(), explanation: z.string(), steps: z.array(z.string()), formulas: z.array(z.string()), concepts: z.array(z.string()), outcome: z.string(), mistakes: z.array(z.string()), related: z.array(z.string()), whyOptions: z.array(z.string()) }) });

/** Step-by-step solution (Answer & Explanation Engine) for a scanned or typed question; saved privately. */
export async function solve(by: Actor, studentId: string, input: { examId: string; subject: string; chapter: string; concept: string; text: string; difficulty: Difficulty; imageKey: string | null }) {
  if (!aiConfigured()) throw new AiNotConfigured();
  await useQuota(studentId, 'ai');
  const exam = examOrThrow(input.examId);
  const r = await callJson({
    system: `You are Open Book AI's Answer & Explanation Engine for ${exam.name}. Solve the student's question completely and correctly: full working with every calculation, formulas used, key concepts, learning outcome, common mistakes and related concepts. If it is an MCQ, list the options and explain why each is right or wrong (answer = zero-based index). Plain text with Unicode symbols. If part of the question is [illegible], say what you assumed.`,
    parts: [{ kind: 'text', text: `Subject: ${input.subject}\nChapter: ${input.chapter}\nConcept: ${input.concept}\nQuestion:\n${input.text}` }],
    jsonSchema: solveSchema, validate: solveValidate, effort: 'high', maxTokens: 16000,
  });
  const q = await saveQuestion({ origin: 'scan', ownerId: studentId, target: input, type: (QTYPES.some((t) => t.id === r.data.type) ? r.data.type : 'short') as QType, difficulty: input.difficulty, stem: input.text, options: r.data.options.slice(0, 8), answer: r.data.answer.slice(0, 8), explanation: r.data.explanation, status: 'private', ai: true, createdBy: by, imageKey: input.imageKey });
  await obSessions.put(store(), { studentId, kind: 'scanner', title: input.text.slice(0, 200), lang: 'en', mode: 'solve', turns: [{ role: 'user', text: input.text.slice(0, 12000), sources: [], at: new Date().toISOString() }, { role: 'assistant', text: r.data.explanation.explanation.slice(0, 12000), sources: [], at: new Date().toISOString() }] });
  return q;
}

/** Saves the (corrected) question to the student's own bank without AI. */
export async function saveToMyBank(by: Actor, studentId: string, input: { examId: string; subject: string; chapter: string; concept: string; text: string; difficulty: Difficulty; imageKey: string | null }) {
  return saveQuestion({ origin: 'scan', ownerId: studentId, target: input, type: 'short', difficulty: input.difficulty, stem: input.text, options: [], answer: [], status: 'private', ai: false, createdBy: by, imageKey: input.imageKey });
}

/** Sends the question to the student's teachers through the existing Doubts module. */
export async function sendAsDoubt(studentId: string, subject: string, text: string) {
  await askDoubt(studentId, { subject: ['Mathematics', 'Physics', 'Chemistry', 'Biology'].includes(subject) ? subject : 'Physics', text: `[From Open Book scanner]\n${text}`.slice(0, 2000), imageUrl: null });
}
