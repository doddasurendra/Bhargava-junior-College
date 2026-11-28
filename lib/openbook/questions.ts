import 'server-only';
import { z } from 'zod';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { practiceAttempts } from '../records/collections';
import { obAttempts, obFingerprints, obQuestions, obRejections, type Explanation } from './collections';
import { audit, canTeach, chaptersFor, examOrThrow, need, OpenBookError, settings, staffActor, store, useQuota, type Actor } from './core';
import { aiConfigured, callJson, S } from './llm';
import { recordMastery } from './mastery';
import { conceptKey, DIFFICULTY_LABEL, isObjective, QTYPES, type Difficulty, type QType } from './taxonomy';
import { fingerprint, lexicalSimilarity, normalize } from './text';
import { embed, nearest, storeVector, vectorsConfigured } from './vectors';

/**
 * Concept Question Generator Agent (§5), uniqueness engine (§6) and Answer & Explanation Engine (§7).
 *
 * Uniqueness: every question is normalised and fingerprinted (SHA-256). A candidate is rejected when
 *  1. its fingerprint already exists for this student+concept, the shared bank or any uploaded paper (exact), or
 *  2. it is too similar to one of them: lexical similarity (word cosine / character trigrams) ≥ threshold, and,
 *     when VOYAGE_API_KEY is set, pgvector cosine similarity ≥ threshold (semantic).
 * Rejected candidates are logged and regenerated (up to 3 rounds). Each stored question records which checks
 * it passed, so the app never claims a question is unique beyond the checks that actually ran.
 */
export type Question = { id: string; createdAt: string } & z.infer<typeof obQuestions.schema>;
const asQ = (r: { id: string; createdAt: string; data: z.infer<typeof obQuestions.schema> }): Question => ({ id: r.id, createdAt: r.createdAt, ...r.data });

export interface Target { examId: string; subject: string; chapter: string; concept: string }

// ---------------------------------------------------------------- storing a question (all origins)

export interface NewQuestion {
  origin: 'extracted' | 'generated' | 'teacher' | 'scan' | 'community';
  ownerId: string | null; paperId?: string | null; qno?: string | null;
  target: Target; type: QType; difficulty: Difficulty; stem: string; options: string[]; answer: string[];
  marks?: number; negative?: number; year?: number | null; explanation?: Explanation | null;
  status: 'private' | 'pending' | 'approved' | 'rejected'; ai: boolean; model?: string | null; createdBy: Actor; imageKey?: string | null;
  similarity?: { checkedAgainst: number; maxScore: number; method: string; nearestId: string | null } | null;
}

export const scopeOf = (q: { paperId?: string | null; ownerId: string | null }) => (q.paperId ? `p:${q.paperId}` : q.ownerId ? `s:${q.ownerId}` : 'bank');

export async function saveQuestion(n: NewQuestion, vector?: number[] | null) {
  const ck = conceptKey(n.target.subject, n.target.chapter, n.target.concept);
  const r = await obQuestions.put(store(), {
    origin: n.origin, ownerId: n.ownerId, paperId: n.paperId ?? null, qno: n.qno ?? null, examId: n.target.examId, subject: n.target.subject, chapter: n.target.chapter, concept: n.target.concept, conceptKey: ck,
    type: n.type, difficulty: n.difficulty, stem: n.stem, options: n.options, answer: n.answer, marks: n.marks ?? 4, negative: n.negative ?? 0, year: n.year ?? null, explanation: n.explanation ?? null,
    normalized: normalize(n.stem + ' ' + n.options.join(' ')).slice(0, 8000), fingerprint: fingerprint(n.stem + ' ' + n.options.join(' ')),
    status: n.status, ai: n.ai, model: n.model ?? null, createdBy: n.createdBy, similarity: n.similarity ?? null, imageKey: n.imageKey ?? null,
  });
  const scope = scopeOf({ paperId: n.paperId, ownerId: n.ownerId });
  await obFingerprints.put(store(), { fingerprint: r.data.fingerprint, questionId: r.id, scope });
  if (vector) await storeVector(r.id, ck, scope, vector).catch(() => undefined);
  return asQ(r);
}

export async function getQuestion(id: string) {
  const r = await obQuestions.get(store(), id);
  return r ? asQ(r) : null;
}
export async function getQuestions(ids: string[]) {
  if (!ids.length) return [];
  const rows = await obQuestions.list(store(), { ids });
  const by = new Map(rows.map((r) => [r.id, asQ(r)]));
  return ids.map((i) => by.get(i)).filter((q): q is Question => !!q);
}

// ---------------------------------------------------------------- uniqueness engine

/** What a new question for this student and concept is compared with. */
export async function comparisonPool(studentId: string | null, ck: string) {
  const rows = await obQuestions.list(store(), { k2: ck });
  return rows.filter((r) => r.data.status !== 'rejected' && (r.data.ownerId === null || r.data.ownerId === studentId)).map(asQ);
}

export interface Verdict { ok: boolean; reason: 'exact' | 'semantic' | null; score: number; nearestId: string | null; method: string }

export async function checkCandidate(text: string, pool: { id: string; fingerprint: string; stem: string; options: string[] }[], accepted: string[], threshold: number, vector: number[] | null, vectorHits: { questionId: string; score: number }[]): Promise<Verdict> {
  const fp = fingerprint(text);
  const exact = pool.find((p) => p.fingerprint === fp);
  if (exact || accepted.some((a) => fingerprint(a) === fp)) return { ok: false, reason: 'exact', score: 1, nearestId: exact?.id ?? null, method: 'fingerprint' };
  let best = { score: 0, id: null as string | null };
  for (const p of pool) {
    const s = lexicalSimilarity(text, p.stem + ' ' + p.options.join(' '));
    if (s > best.score) best = { score: s, id: p.id };
  }
  for (const a of accepted) {
    const s = lexicalSimilarity(text, a);
    if (s > best.score) best = { score: s, id: null };
  }
  if (best.score >= threshold) return { ok: false, reason: 'semantic', score: best.score, nearestId: best.id, method: 'lexical' };
  if (vector) {
    const top = vectorHits[0];
    if (top && top.score >= threshold) return { ok: false, reason: 'semantic', score: top.score, nearestId: top.questionId, method: 'pgvector' };
    return { ok: true, reason: null, score: Math.max(best.score, top?.score ?? 0), nearestId: best.id, method: 'fingerprint+lexical+pgvector' };
  }
  return { ok: true, reason: null, score: best.score, nearestId: best.id, method: 'fingerprint+lexical' };
}

// ---------------------------------------------------------------- generation

const explanationSchema = S.obj({
  answer: S.str('the correct answer stated in words'), explanation: S.str(), steps: S.arr(S.str()), formulas: S.arr(S.str()), concepts: S.arr(S.str()),
  outcome: S.str('learning outcome'), mistakes: S.arr(S.str('common mistake')), related: S.arr(S.str('related concept')),
  whyOptions: S.arr(S.str('for MCQs: one line per option saying why it is right or wrong; empty otherwise')),
});
const genSchema = S.obj({
  questions: S.arr(S.obj({
    type: S.enum(QTYPES.map((q) => q.id)), stem: S.str(), options: S.arr(S.str()),
    answer: S.arr(S.str('MCQ: zero-based option index as text; numerical: the value; other: the model answer')), explanation: explanationSchema,
  })),
});
const expl = z.object({ answer: z.string(), explanation: z.string(), steps: z.array(z.string()), formulas: z.array(z.string()), concepts: z.array(z.string()), outcome: z.string(), mistakes: z.array(z.string()), related: z.array(z.string()), whyOptions: z.array(z.string()) });
const genValidate = z.object({ questions: z.array(z.object({ type: z.string(), stem: z.string(), options: z.array(z.string()), answer: z.array(z.string()), explanation: expl })) });

function validShape(q: { type: string; options: string[]; answer: string[] }): boolean {
  const n = q.options.length;
  const idx = q.answer.map(Number);
  switch (q.type) {
    case 'mcq_single': case 'assertion_reason': case 'reasoning': return n === 4 && q.answer.length === 1 && Number.isInteger(idx[0]) && idx[0] >= 0 && idx[0] < 4;
    case 'mcq_multi': return n === 4 && q.answer.length >= 1 && idx.every((i) => Number.isInteger(i) && i >= 0 && i < 4);
    case 'match': return (n === 4 && q.answer.length === 1 && Number(q.answer[0]) >= 0 && Number(q.answer[0]) < 4) || (n === 0 && q.answer.length >= 1);
    case 'true_false': return n === 2 && (q.answer[0] === '0' || q.answer[0] === '1');
    case 'numerical': return q.answer.length === 1 && Number.isFinite(Number(q.answer[0].replace(/[^\d.eE+-]/g, '')));
    default: return q.answer.length >= 1 && q.answer[0].trim().length > 0;
  }
}

function system(exam: ReturnType<typeof examOrThrow>) {
  return `You are Open Book AI, the Concept Question Generator for Bhargava Junior College (Hyderabad, Telangana).
You write original practice questions for students preparing for ${exam.name}.
Exam pattern you must follow exactly: ${exam.pattern.note} Marks: +${exam.pattern.marks}${exam.pattern.negative ? ` / −${exam.pattern.negative}` : ''}.
Rules:
- Every question must test ONLY the concept given, within the given chapter and subject. Do not drift to other concepts.
- Follow the selected examination's real question style and difficulty; do not mix in another exam's format.
- Never copy questions from published papers. Change numbers, the reasoning approach or the application scenario.
- Correctness matters more than anything: work every answer out fully before writing it. Numerical answers must be exact to the stated precision.
- MCQ single correct, assertion–reason and logical reasoning: exactly 4 options, answer = one zero-based index. Assertion–reason options must be the standard four (both true and R explains A / both true, R does not explain A / A true, R false / A false, R true).
- MCQ multiple correct: 4 options, answer = every correct zero-based index.
- Match the following: put both lists in the stem and give 4 coded options (answer = index), the usual JEE/NEET style.
- True/false: options ["True","False"], answer "0" or "1". Numerical: no options, answer = the value only (units in the stem).
- Fill in the blank, one word, short, long, application, case, diagram, coding, analytical: no options; answer = the model answer. For diagram-based questions describe the diagram in words.
- Use plain text with Unicode symbols (², √, π, →, ⇌, Δ) rather than LaTeX.
- Explanations: full step-by-step working with calculations, the formulas used, key concepts, learning outcome, common mistakes, related concepts, and for MCQs why each option is right or wrong.`;
}

export interface GenerateInput extends Target { types: QType[]; difficulty: Difficulty; count: number; /** optional source passage (reader "generate questions on this passage", scanner "similar questions") */ context?: string | null }

/** Generates `count` unique questions for the student (or a teacher bank when studentId is null). */
export async function generate(by: Actor, studentId: string | null, input: GenerateInput) {
  const exam = examOrThrow(input.examId);
  need(exam.subjects.includes(input.subject), `${input.subject} is not part of ${exam.name}.`);
  need(input.concept.trim().length >= 2, 'Enter or choose a concept.');
  need(input.count >= 1 && input.count <= 50, 'Choose between 1 and 50 questions.');
  const bad = input.types.filter((t) => !exam.pattern.types.includes(t));
  need(input.types.length > 0, 'Choose at least one question type.');
  if (bad.length) throw new OpenBookError(`${bad.map((t) => QTYPES.find((q) => q.id === t)?.label).join(', ')} ${bad.length > 1 ? 'are' : 'is'} not used in ${exam.name}. Its pattern uses: ${exam.pattern.types.map((t) => QTYPES.find((q) => q.id === t)?.label).join(', ')}.`);
  const chs = await chaptersFor(input.examId, input.subject);
  need(chs.length === 0 || chs.some((c) => c.name === input.chapter), 'Choose a chapter from the list.');
  if (!aiConfigured()) throw new (await import('./llm')).AiNotConfigured();
  if (studentId) await useQuota(studentId, 'questions', input.count);
  const s = await settings();
  const ck = conceptKey(input.subject, input.chapter, input.concept);
  const pool = await comparisonPool(studentId, ck);
  const scopes = [studentId ? `s:${studentId}` : 'bank', 'bank', 'papers'];
  const accepted: { q: z.infer<typeof genValidate>['questions'][number]; verdict: Verdict; vector: number[] | null }[] = [];
  const rejectedStems: string[] = [];
  let rounds = 0, rejected = 0, model = '';
  while (accepted.length < input.count && rounds < 4) {
    rounds++;
    const want = Math.min(25, input.count - accepted.length + (rounds > 1 ? 2 : 0));
    const avoid = [...pool.slice(-30).map((p) => p.stem), ...accepted.map((a) => a.q.stem), ...rejectedStems].map((t) => '- ' + t.replace(/\s+/g, ' ').slice(0, 220)).join('\n');
    const res = await callJson({
      system: system(exam),
      parts: [{ kind: 'text', text: `Subject: ${input.subject}\nChapter: ${input.chapter}\nConcept: ${input.concept}\nDifficulty: ${DIFFICULTY_LABEL[input.difficulty]}\nQuestion types (spread the questions across these): ${input.types.map((t) => QTYPES.find((q) => q.id === t)!.label).join(', ')}\nNumber of questions: ${want}\n${input.context ? `\nBase the questions on this source passage (stay within the concept):\n"""${input.context.slice(0, 6000)}"""\n` : ''}${avoid ? `\nThe student has already seen these questions on this concept. Do NOT repeat them or reword them; use different situations, numbers and reasoning:\n${avoid}` : ''}` }],
      // reserve output in proportion to the questions asked (providers bill / pre-authorise against max_tokens)
      jsonSchema: genSchema, validate: genValidate, effort: 'medium', maxTokens: Math.min(32000, 3000 + want * 1500), provider: 'openai',
    });
    model = res.model;
    const cands = res.data.questions.filter((q) => input.types.includes(q.type as QType) && validShape(q));
    const vecs = vectorsConfigured() ? await embed(cands.map((c) => c.stem + ' ' + c.options.join(' '))) : null;
    for (let i = 0; i < cands.length && accepted.length < input.count; i++) {
      const c = cands[i];
      const text = c.stem + ' ' + c.options.join(' ');
      const v = vecs?.[i] ?? null;
      const hits = v ? await nearest(v, ck, scopes) : [];
      // also compare with vectors accepted in this run
      for (const a of accepted) if (v && a.vector) { const sc = cosine(v, a.vector); hits.push({ questionId: '(this batch)', score: sc }); }
      hits.sort((a, b) => b.score - a.score);
      const verdict = await checkCandidate(text, pool, accepted.map((a) => a.q.stem + ' ' + a.q.options.join(' ')), s.duplicateThreshold, v, hits);
      if (!verdict.ok) {
        rejected++;
        rejectedStems.push(c.stem);
        await obRejections.put(store(), { ownerId: studentId, conceptKey: ck, stem: c.stem.slice(0, 8000), reason: verdict.reason ?? 'semantic', score: verdict.score, nearestId: verdict.nearestId, method: verdict.method });
        continue;
      }
      accepted.push({ q: c, verdict, vector: v });
    }
    rejected += res.data.questions.length - cands.length;
  }
  const saved: Question[] = [];
  for (const a of accepted) {
    saved.push(await saveQuestion({
      origin: studentId ? 'generated' : 'teacher', ownerId: studentId, target: input, type: a.q.type as QType, difficulty: input.difficulty, stem: a.q.stem, options: a.q.options, answer: a.q.answer,
      marks: exam.pattern.marks, negative: exam.pattern.negative, explanation: a.q.explanation, status: studentId ? 'private' : 'pending', ai: true, model, createdBy: by,
      similarity: { checkedAgainst: pool.length, maxScore: Math.round(a.verdict.score * 1000) / 1000, method: a.verdict.method, nearestId: a.verdict.nearestId },
    }, a.vector));
  }
  await audit(by, 'questions.generate', ck, `${saved.length}/${input.count} saved, ${rejected} rejected, ${rounds} round(s), checked against ${pool.length}`);
  return { questions: saved, rejected, rounds, checkedAgainst: pool.length, method: vectorsConfigured() ? 'fingerprint + lexical + pgvector' : 'fingerprint + lexical (semantic embeddings not configured)', shortfall: input.count - saved.length };
}
const cosine = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return x && y ? d / Math.sqrt(x * y) : 0; };

/** The student's own generated questions (history, §6.10), newest first. */
export async function myQuestions(studentId: string, f: { conceptKey?: string; subject?: string } = {}) {
  const rows = await obQuestions.list(store(), f.conceptKey ? { k1: `s:${studentId}`, k2: f.conceptKey } : { k1: `s:${studentId}` });
  return rows.map(asQ).filter((q) => !f.subject || q.subject === f.subject).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------- attempts & marking

export function markObjective(q: Pick<Question, 'type' | 'options' | 'answer' | 'marks' | 'negative'>, given: string[]): { correct: boolean | null; score: number } {
  const g = given.map((x) => x.trim()).filter(Boolean);
  if (!g.length) return { correct: null, score: 0 };
  const neg = -Math.abs(q.negative);
  switch (q.type) {
    case 'mcq_multi': {
      const right = new Set(q.answer), pick = new Set(g);
      if ([...pick].some((p) => !right.has(p))) return { correct: false, score: neg };
      if (pick.size === right.size) return { correct: true, score: q.marks };
      return { correct: false, score: Math.round((q.marks * pick.size) / Math.max(1, right.size) * 100) / 100 }; // partial marking
    }
    case 'numerical': {
      const a = Number(q.answer[0].replace(/[^\d.eE+-]/g, '')), b = Number(g[0].replace(/[^\d.eE+-]/g, ''));
      const ok = Number.isFinite(b) && Math.abs(a - b) <= Math.max(0.01, Math.abs(a) * 0.01);
      return { correct: ok, score: ok ? q.marks : neg };
    }
    case 'fill_blank': case 'one_word': {
      const ok = q.answer.some((a) => normalize(a) === normalize(g[0]));
      return { correct: ok, score: ok ? q.marks : 0 };
    }
    default: {
      const ok = g.length === 1 && g[0] === q.answer[0];
      return { correct: ok, score: ok ? q.marks : neg };
    }
  }
}

const evalSchema = S.obj({ score: S.num(), outOf: S.num(), criteria: S.arr(S.obj({ criterion: S.str(), marks: S.num(), awarded: S.num(), comment: S.str() })), feedback: S.str() });
const evalValidate = z.object({ score: z.number(), outOf: z.number(), criteria: z.array(z.object({ criterion: z.string(), marks: z.number(), awarded: z.number(), comment: z.string() })), feedback: z.string() });

/** AI-assisted marking of a subjective answer with a transparent rubric (§8). */
export async function evaluateSubjective(who: string, q: Question, answer: string) {
  if (!answer.trim()) return { correct: false, score: 0, feedback: 'No answer written.' };
  if (!aiConfigured()) return { correct: null, score: 0, feedback: 'AI marking is not configured yet. Compare your answer with the model answer below and mark it yourself.' };
  await useQuota(who, 'ai');
  const r = await callJson({
    system: 'You are a fair examiner for Bhargava Junior College. Mark the student answer against the model answer using a rubric of 2–5 criteria whose marks add up to the question total. Award partial credit. Be specific and encouraging in the feedback. Never reveal anything beyond the question, the model answer and your marking.',
    parts: [{ kind: 'text', text: `Question (${q.marks} marks): ${q.stem}\n\nModel answer: ${q.answer.join('\n')}\n${q.explanation ? `\nMarking notes: ${q.explanation.explanation.slice(0, 3000)}` : ''}\n\nStudent answer:\n${answer.slice(0, 6000)}` }],
    jsonSchema: evalSchema, validate: evalValidate, effort: 'low', maxTokens: 4000,
  });
  const score = Math.max(0, Math.min(q.marks, r.data.score));
  const rubric = r.data.criteria.map((c) => `• ${c.criterion}: ${c.awarded}/${c.marks}. ${c.comment}`).join('\n');
  return { correct: score >= q.marks * 0.6, score, feedback: `AI-assisted marking (check with your teacher if you disagree)\n${rubric}\n\n${r.data.feedback}` };
}

/** Records one attempt, updates mastery and (for 4-option single-correct MCQs) the existing practice XP. */
export async function attempt(studentId: string, batchId: string | null, q: Question, given: string[], seconds: number, source: 'practice' | 'mock' | 'challenge' | 'diagnostic' | 'path') {
  const objective = isObjective(q.type as QType);
  const m = objective ? { ...markObjective(q, given), feedback: null as string | null } : await evaluateSubjective(studentId, q, given[0] ?? '');
  const date = todayIST();
  await obAttempts.put(store(), { studentId, questionId: q.id, given, correct: m.correct, score: m.score, max: q.marks, seconds: Math.max(0, Math.round(seconds)), date, conceptKey: q.conceptKey, subject: q.subject, chapter: q.chapter, source, feedback: m.feedback });
  if (m.correct !== null) await recordMastery(studentId, q, [m.correct ? 1 : Math.max(0, m.score / Math.max(1, q.marks))]);
  if ((q.type === 'mcq_single' || q.type === 'assertion_reason') && q.options.length === 4 && given[0] !== undefined && ['Mathematics', 'Physics', 'Chemistry', 'Biology'].includes(q.subject)) {
    const diff = q.difficulty === 'beginner' || q.difficulty === 'easy' ? 'easy' : q.difficulty === 'medium' ? 'medium' : 'hard';
    const xp = m.correct ? (diff === 'easy' ? 5 : diff === 'medium' ? 10 : 15) : 0;
    await practiceAttempts.put(store(), { studentId, batchId, questionId: `ob:${q.id}`.slice(0, 40), chosen: Number(given[0]), correct: !!m.correct, subject: q.subject, chapter: q.chapter.slice(0, 80), difficulty: diff, misconception: null, xp, date, setId: `openbook:${source}` }).catch(() => undefined);
  }
  return m;
}

export async function attemptsOf(studentId: string) {
  return (await obAttempts.list(store(), { k1: studentId })).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }));
}

// ---------------------------------------------------------------- "explain this question" (simpler / advanced)

const explainValidate = z.object({ text: z.string() });
export async function explainQuestion(who: string, q: Question, level: 'standard' | 'simpler' | 'advanced', lang: 'en' | 'te' | 'hi' = 'en') {
  if (!aiConfigured()) throw new (await import('./llm')).AiNotConfigured();
  await useQuota(who, 'ai');
  const how = level === 'simpler' ? 'Explain it very simply, as to a student who found this hard: short sentences, one idea at a time, an everyday analogy.' : level === 'advanced' ? 'Give an advanced explanation: the underlying principle, a faster method, edge cases and how JEE Advanced/NEET could twist it.' : 'Explain the solution clearly step by step.';
  const r = await callJson({
    system: `You are Open Book AI, a patient tutor for Bhargava Junior College students. ${how} Write in ${lang === 'te' ? 'Telugu' : lang === 'hi' ? 'Hindi' : 'English'} (keep formulas and symbols as they are). Plain text, no markdown headings.`,
    parts: [{ kind: 'text', text: `Question: ${q.stem}\n${q.options.length ? q.options.map((o, i) => `(${'abcd'[i] ?? i + 1}) ${o}`).join('\n') : ''}\nCorrect answer: ${q.answer.map((a) => (q.options.length && /^\d$/.test(a) ? `(${'abcd'[Number(a)]}) ${q.options[Number(a)]}` : a)).join(', ')}\n${q.explanation ? `Reference solution: ${q.explanation.explanation}` : ''}` }],
    jsonSchema: S.obj({ text: S.str() }), validate: explainValidate, effort: 'low', maxTokens: 6000,
  });
  return r.data.text;
}

// ---------------------------------------------------------------- teacher bank: approve AI / extracted questions

export async function pendingBank() {
  return (await obQuestions.list(store(), { k1: 'bank' })).map(asQ).filter((q) => q.status === 'pending');
}
export async function reviewQuestion(u: Staff, id: string, approve: boolean) {
  need(canTeach(u));
  const q = await obQuestions.get(store(), id);
  need(q, 'Question not found.');
  await obQuestions.put(store(), { ...q!.data, status: approve ? 'approved' : 'rejected' }, id);
  await audit(staffActor(u), approve ? 'question.approve' : 'question.reject', id);
}

/** Teacher adds their own question to the shared bank (approved directly, they are staff). */
export async function addTeacherQuestion(u: Staff, n: Omit<NewQuestion, 'origin' | 'ownerId' | 'status' | 'ai' | 'createdBy'>) {
  need(canTeach(u));
  const pool = await comparisonPool(null, conceptKey(n.target.subject, n.target.chapter, n.target.concept));
  const v = await checkCandidate(n.stem + ' ' + n.options.join(' '), pool, [], (await settings()).duplicateThreshold, null, []);
  if (!v.ok) throw new OpenBookError(`This question is ${v.reason === 'exact' ? 'already in the bank' : `very similar to one in the bank (${Math.round(v.score * 100)}% match)`}.`);
  return saveQuestion({ ...n, origin: 'teacher', ownerId: null, status: 'approved', ai: false, createdBy: staffActor(u), similarity: { checkedAgainst: pool.length, maxScore: v.score, method: v.method, nearestId: v.nearestId } });
}
