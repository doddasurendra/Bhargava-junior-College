import 'server-only';
import { z } from 'zod';
import type { Staff } from '../crm/types';
import { extract, needsOcr, sniff } from '../kb/extract';
import { obPapers, obQuestions } from './collections';
import { audit, canManage, canTeach, chaptersFor, examOrThrow, need, OpenBookError, putFile, readFile, staffActor, store, type Actor } from './core';
import { aiConfigured, callJson, S } from './llm';
import { getQuestions, saveQuestion, scopeOf, type Question } from './questions';
import { conceptKey, DIFFICULTIES, QTYPES, type Chapter, type Difficulty, type QType } from './taxonomy';
import { lexicalSimilarity, parseOptions, splitQuestions, tokens } from './text';

/**
 * Previous-Year Question Paper repository (§4) and Pattern Analyzer (§18).
 * The original upload is stored unchanged (private storage) and never modified. Questions are extracted from
 * the text layer (PDF / Word) without AI; scans, photos and handwritten papers need OCR (Claude vision, needs
 * ANTHROPIC_API_KEY) — until then they are marked "OCR needed", never filled with made-up text.
 * Subject/chapter/concept tagging: Claude when configured, otherwise keyword matching against the syllabus.
 */
const ACCEPT_KINDS = new Set(['pdf', 'word', 'image']);

export interface PaperMeta { title: string; examId: string; board: string | null; subject: string; topics: string[]; year: number; session: string | null; paperType: 'official' | 'model' | 'mock' | 'board' | 'handwritten' | 'other'; difficulty: Difficulty | null; cls: '11' | '12' | 'both' | 'na'; licence: 'official_public' | 'institution_owned' | 'student_upload' | 'unknown'; answerKey: string | null }

export async function uploadPaper(by: Actor, approver: boolean, file: { name: string; bytes: Uint8Array }, meta: PaperMeta, solution?: { name: string; bytes: Uint8Array } | null) {
  const exam = examOrThrow(meta.examId);
  need(exam.subjects.includes(meta.subject) || meta.subject === 'All subjects', `${meta.subject} is not part of ${exam.name}.`);
  if (/\.doc$/i.test(file.name)) throw new OpenBookError('Old Word .doc files can’t be read safely. Open it in Word and Save As .docx (or PDF), then upload.');
  const s = sniff(file.name, file.bytes);
  if ('error' in s) throw new OpenBookError(s.error);
  if (!ACCEPT_KINDS.has(s.kind)) throw new OpenBookError('Upload a PDF, Word (.docx) or an image (JPG/PNG).');
  if (file.bytes.length > 25 * 1024 * 1024) throw new OpenBookError('Papers can be up to 25 MB.');
  const fileKey = await putFile('paper', file.bytes, s.mime);
  let solutionKey: string | null = null;
  if (solution && solution.bytes.length) {
    const ss = sniff(solution.name, solution.bytes);
    if ('error' in ss) throw new OpenBookError(`Solution file: ${ss.error}`);
    solutionKey = await putFile('solution', solution.bytes, ss.mime);
  }
  const p = await obPapers.put(store(), {
    ...meta, category: exam.category, fileKey, fileName: file.name.slice(0, 200), mime: s.mime, size: file.bytes.length, solutionKey,
    status: approver ? 'approved' : 'pending', uploadedBy: by, extraction: { status: 'pending', method: null, count: 0, error: null, confidence: null },
  });
  await audit(by, 'paper.upload', p.id, `${meta.title} (${meta.year})`);
  await extractPaper(p.id);
  return p.id;
}

type Extracted = { qno: string; stem: string; options: string[]; type: QType; chapter: string; concept: string; difficulty: Difficulty; marks: number | null; answer: string[] };

const ocrSchema = S.obj({
  confidence: S.num(),
  questions: S.arr(S.obj({ qno: S.str(), stem: S.str(), options: S.arr(S.str()), type: S.enum(QTYPES.map((q) => q.id)), chapter: S.str(), concept: S.str(), difficulty: S.enum([...DIFFICULTIES]), marks: S.num(), answer: S.arr(S.str('only if the paper or key shows it; else empty')) })),
});
const ocrValidate = z.object({ confidence: z.number(), questions: z.array(z.object({ qno: z.string(), stem: z.string(), options: z.array(z.string()), type: z.string(), chapter: z.string(), concept: z.string(), difficulty: z.string(), marks: z.number(), answer: z.array(z.string()) })) });

function chapterList(chs: Chapter[]) {
  return chs.map((c) => `${c.name}: ${c.concepts.join('; ')}`).join('\n');
}

/** Keyword tagger: the chapter/concept whose words appear most in the question. */
export function tagByKeywords(text: string, chs: Chapter[]): { chapter: string; concept: string; score: number } {
  const t = new Set(tokens(text));
  let best = { chapter: chs[0]?.name ?? 'General', concept: chs[0]?.concepts[0] ?? 'General', score: 0 };
  for (const c of chs) {
    const chScore = tokens(c.name).filter((w) => t.has(w)).length;
    for (const k of c.concepts) {
      const s = tokens(k).filter((w) => w.length > 2 && t.has(w)).length * 2 + chScore;
      if (s > best.score) best = { chapter: c.name, concept: k, score: s };
    }
  }
  return best;
}

/** Runs (or re-runs) question extraction for a paper. */
export async function extractPaper(paperId: string) {
  const p = await obPapers.get(store(), paperId);
  need(p, 'Paper not found.');
  const d = p!.data;
  const bytes = await readFile(d.fileKey);
  need(bytes, 'The original file could not be read from storage.');
  const s = sniff(d.fileName, bytes!);
  if ('error' in s) throw new OpenBookError(s.error);
  const subjects = d.subject === 'All subjects' ? examOrThrow(d.examId).subjects : [d.subject];
  const chs = (await Promise.all(subjects.map((sub) => chaptersFor(d.examId, sub)))).flat();
  let found: Extracted[] = [];
  let method = 'text-layer';
  let confidence: number | null = null;
  let status: 'done' | 'ocr_needed' | 'no_questions' | 'failed' = 'done';
  let error: string | null = null;
  try {
    let pages: string[] = s.kind === 'image' ? [] : (await extract(s.kind, bytes!)).pages;
    const scanned = needsOcr(s.kind, pages) || d.paperType === 'handwritten';
    if (scanned || aiConfigured()) {
      if (!aiConfigured()) {
        status = 'ocr_needed';
        error = 'This is a scan or photo. Reading it needs OCR (Claude vision), which needs ANTHROPIC_API_KEY on the server.';
      } else {
        method = scanned ? (d.paperType === 'handwritten' ? 'ai-ocr-handwriting' : 'ai-ocr') : 'ai-structuring';
        const part = s.kind === 'image' ? { kind: 'image' as const, mime: s.mime as 'image/png', data: bytes! } : scanned ? { kind: 'pdf' as const, data: bytes! } : { kind: 'text' as const, text: pages.join('\n\n=== PAGE ===\n\n').slice(0, 180_000) };
        const r = await callJson({
          system: `You read examination question papers (printed, scanned or handwritten) for ${examOrThrow(d.examId).name}. Transcribe every question exactly as written (do not solve, improve or invent anything; mark unreadable parts as [illegible]). Keep math as plain text with Unicode symbols. Split options (a)–(d) into "options". Tag each question with the best chapter and concept from this list:\n${chapterList(chs).slice(0, 20000)}\nGive "confidence" 0–1 for how clearly the paper could be read.`,
          parts: [part, { kind: 'text', text: d.answerKey ? `Answer key supplied by the uploader:\n${d.answerKey.slice(0, 5000)}` : 'No answer key supplied: leave answer empty unless the paper itself marks it.' }],
          jsonSchema: ocrSchema, validate: ocrValidate, effort: 'medium', maxTokens: 64000,
        });
        confidence = Math.max(0, Math.min(1, r.data.confidence));
        found = r.data.questions.map((q) => ({ qno: q.qno, stem: q.stem, options: q.options.slice(0, 8), type: (QTYPES.some((t) => t.id === q.type) ? q.type : 'mcq_single') as QType, chapter: chs.some((c) => c.name === q.chapter) ? q.chapter : tagByKeywords(q.stem, chs).chapter, concept: q.concept || tagByKeywords(q.stem, chs).concept, difficulty: (DIFFICULTIES as readonly string[]).includes(q.difficulty) ? (q.difficulty as Difficulty) : 'medium', marks: q.marks || null, answer: q.answer }));
      }
    } else {
      pages = pages.length ? pages : [];
      found = splitQuestions(pages.join('\n')).map((q) => {
        const { stem, options } = parseOptions(q.text);
        const tag = tagByKeywords(q.text, chs);
        return { qno: q.qno, stem, options, type: options.length === 4 ? 'mcq_single' : /\d/.test(stem) && /(find|calculate|value)/i.test(stem) ? 'numerical' : 'short', chapter: tag.chapter, concept: tag.concept, difficulty: d.difficulty ?? 'medium', marks: null, answer: [] } as Extracted;
      });
      method = 'text-layer + keyword tagging';
    }
    if (status === 'done' && !found.length) status = 'no_questions';
  } catch (e) {
    status = 'failed';
    error = (e as Error).message.slice(0, 280);
  }
  // answer key "1-B, 2-C" or "1. 3" lines fill in answers the extraction didn't find
  const key = parseAnswerKey(d.answerKey ?? '');
  for (const old of await obQuestions.list(store(), { k1: `p:${paperId}` })) await obQuestions.remove(store(), old.id);
  const exam = examOrThrow(d.examId);
  let saved = 0;
  for (const q of found) {
    const ans = q.answer.length ? q.answer : key.get(q.qno) ? [key.get(q.qno)!] : [];
    const subject = d.subject === 'All subjects' ? chs.find((c) => c.name === q.chapter)?.subject ?? exam.subjects[0] : d.subject;
    try {
      await saveQuestion({ origin: 'extracted', ownerId: null, paperId, qno: q.qno, target: { examId: d.examId, subject, chapter: q.chapter, concept: q.concept }, type: q.type, difficulty: q.difficulty, stem: q.stem, options: q.options, answer: ans, marks: q.marks ?? exam.pattern.marks, negative: exam.pattern.negative, year: d.year, status: d.status === 'approved' ? 'approved' : 'pending', ai: method.startsWith('ai'), createdBy: { kind: 'system', id: 'extractor', name: method } });
      saved++;
    } catch { /* a malformed question is skipped, the rest are kept */ }
  }
  await obPapers.put(store(), { ...d, extraction: { status, method, count: saved, error, confidence } }, paperId);
  return { status, count: saved, error };
}

/** "1-B", "1. (c)", "1 → 3", "Q1: 2" → zero-based option index, or the value for numericals. */
export function parseAnswerKey(text: string) {
  const m = new Map<string, string>();
  for (const x of text.matchAll(/(?:^|[\s,;])Q?(\d{1,3})\s*[-.:)→=]\s*\(?([A-Da-d]|-?\d+(?:\.\d+)?)\)?/g)) {
    const v = x[2];
    m.set(x[1], /^[A-Da-d]$/.test(v) ? String('abcd'.indexOf(v.toLowerCase())) : v);
  }
  return m;
}

export async function reviewPaper(u: Staff, id: string, approve: boolean, note: string | null) {
  need(canTeach(u));
  const p = await obPapers.get(store(), id);
  need(p, 'Paper not found.');
  await obPapers.put(store(), { ...p!.data, status: approve ? 'approved' : 'rejected', reviewNote: note }, id);
  for (const q of await obQuestions.list(store(), { k1: `p:${id}` })) await obQuestions.put(store(), { ...q.data, status: approve ? 'approved' : 'rejected' }, q.id);
  await audit(staffActor(u), approve ? 'paper.approve' : 'paper.reject', id, note);
}

export async function editExtractedQuestion(u: Staff, id: string, patch: { stem?: string; options?: string[]; answer?: string[]; chapter?: string; concept?: string; type?: QType }) {
  need(canTeach(u));
  const q = await obQuestions.get(store(), id);
  need(q && q.data.paperId, 'Question not found.');
  const next = { ...q!.data, ...patch };
  next.conceptKey = conceptKey(next.subject, next.chapter, next.concept);
  await obQuestions.put(store(), next, id);
}

export async function listPapers(f: { examId?: string; subject?: string; year?: number; q?: string; status?: 'approved' | 'pending' | 'all'; uploader?: string }) {
  const rows = await obPapers.list(store(), f.examId ? { k1: f.examId } : undefined);
  const w = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data }))
    .filter((p) => (f.status ?? 'approved') === 'all' || p.status === (f.status ?? 'approved') || (f.uploader && p.uploadedBy.id === f.uploader))
    .filter((p) => !f.subject || p.subject === f.subject)
    .filter((p) => !f.year || p.year === f.year)
    .filter((p) => !w.length || w.every((x) => [p.title, p.subject, p.board ?? '', p.session ?? '', p.topics.join(' '), String(p.year)].join(' ').toLowerCase().includes(x)))
    .sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
}

export async function getPaper(id: string) {
  const p = await obPapers.get(store(), id);
  return p ? { id: p.id, createdAt: p.createdAt, ...p.data } : null;
}
export async function paperQuestions(id: string) {
  return (await obQuestions.list(store(), { k1: `p:${id}` })).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data })).sort((a, b) => Number(a.qno ?? 0) - Number(b.qno ?? 0));
}

// ---------------------------------------------------------------- pattern analyzer (§4.8–4.10, §18)

export async function patternAnalysis(examId: string, subject: string | null) {
  const papers = (await listPapers({ examId })).filter((p) => !subject || p.subject === subject || p.subject === 'All subjects');
  const qs = (await obQuestions.list(store())).filter((r) => r.data.paperId && papers.some((p) => p.id === r.data.paperId) && r.data.status === 'approved' && (!subject || r.data.subject === subject)).map((r) => ({ id: r.id, ...r.data }));
  const years = [...new Set(papers.map((p) => p.year))].sort();
  const chs = subject ? await chaptersFor(examId, subject) : [];
  const byChapter = new Map<string, Map<number, { q: number; marks: number }>>();
  for (const q of qs) {
    const y = q.year ?? 0;
    const m = byChapter.get(q.chapter) ?? new Map();
    const c = m.get(y) ?? { q: 0, marks: 0 };
    c.q++; c.marks += q.marks;
    m.set(y, c);
    byChapter.set(q.chapter, m);
  }
  const total = qs.length || 1;
  const chapters = [...byChapter.entries()].map(([chapter, m]) => {
    const perYear = years.map((y) => m.get(y)?.q ?? 0);
    const half = Math.floor(years.length / 2);
    const early = perYear.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
    const late = perYear.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, years.length - half);
    const count = perYear.reduce((a, b) => a + b, 0);
    return { chapter, perYear, count, marks: [...m.values()].reduce((a, b) => a + b.marks, 0), weight: Math.round((count / total) * 1000) / 10, trend: years.length < 2 ? 'steady' : late > early * 1.25 ? 'rising' : late < early * 0.8 ? 'falling' : 'steady' };
  }).sort((a, b) => b.count - a.count);
  const dist = (key: (q: (typeof qs)[number]) => string) => { const m = new Map<string, number>(); for (const q of qs) m.set(key(q), (m.get(key(q)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n, pct: Math.round((n / total) * 100) })); };
  const concepts = dist((q) => `${q.chapter} › ${q.concept}`);
  // repeated questions across different papers (same concept, lexically similar)
  const repeated: { a: string; b: string; years: string; score: number; stem: string }[] = [];
  const byConcept = new Map<string, typeof qs>();
  for (const q of qs) byConcept.set(q.conceptKey, [...(byConcept.get(q.conceptKey) ?? []), q]);
  for (const group of byConcept.values()) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      if (group[i].paperId === group[j].paperId) continue;
      const s = lexicalSimilarity(group[i].normalized, group[j].normalized);
      if (s >= 0.6) repeated.push({ a: group[i].id, b: group[j].id, years: `${group[i].year} & ${group[j].year}`, score: Math.round(s * 100) / 100, stem: group[i].stem.slice(0, 200) });
    }
  }
  const askedChapters = new Set(chapters.map((c) => c.chapter));
  return {
    basis: { papers: papers.length, questions: qs.length, years: years.length ? `${years[0]}–${years[years.length - 1]}` : '—', note: 'Based only on papers uploaded and approved in Open Book. This shows past weightage; it does not predict exact questions.' },
    years, chapters, concepts: concepts.slice(0, 30), types: dist((q) => QTYPES.find((t) => t.id === q.type)?.label ?? q.type), difficulty: dist((q) => q.difficulty),
    repeated: repeated.sort((a, b) => b.score - a.score).slice(0, 30),
    highYield: chapters.filter((c) => c.count >= 2).slice(0, 10).map((c) => ({ chapter: c.chapter, weight: c.weight, trend: c.trend })),
    neverAsked: chs.filter((c) => !askedChapters.has(c.name)).map((c) => c.name),
  };
}

/** Builds a question list that follows the analysed chapter distribution (for the mock generator). */
export async function patternQuestionIds(examId: string, subject: string | null, count: number, excludeOwner: string | null) {
  const a = await patternAnalysis(examId, subject);
  need(a.basis.questions > 0, 'No approved past papers with extracted questions for this exam yet.');
  const pool = (await obQuestions.list(store(), { k1: 'bank' })).concat(await obQuestions.list(store())).filter((r) => r.data.examId === examId && r.data.status === 'approved' && (!subject || r.data.subject === subject) && r.data.answer.length > 0 && r.data.ownerId !== excludeOwner);
  const seen = new Set<string>();
  const byChapter = new Map<string, string[]>();
  for (const r of pool) { if (seen.has(r.id)) continue; seen.add(r.id); byChapter.set(r.data.chapter, [...(byChapter.get(r.data.chapter) ?? []), r.id]); }
  const out: string[] = [];
  for (const c of a.chapters) {
    const want = Math.max(1, Math.round((c.weight / 100) * count));
    const ids = (byChapter.get(c.chapter) ?? []).sort(() => Math.random() - 0.5).slice(0, want);
    out.push(...ids);
  }
  return { ids: out.slice(0, count), basis: `${a.basis.papers} papers, ${a.basis.years}` };
}

export const canUploadPapers = (u: Staff) => canTeach(u) || canManage(u);
export type PaperQuestion = Question;
export { getQuestions, scopeOf };
