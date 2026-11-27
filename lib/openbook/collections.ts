import { z } from 'zod';
import { collection } from '../records/collection';
import { DIFFICULTIES, QTYPES } from './taxonomy';

/**
 * Open Book data, in the existing record store (Supabase `records` table: RLS on, service role only; JSON
 * file store locally). Each collection maps to a table in the spec (§12); see docs/open-book-architecture.md.
 * Index keys (k1, k2) are chosen for the lookups the screens make.
 */
const txt = (max: number) => z.string().trim().min(1).max(max);
const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const qtype = z.enum(QTYPES.map((q) => q.id) as [string, ...string[]]);
const difficulty = z.enum(DIFFICULTIES);
const actor = z.object({ kind: z.enum(['staff', 'student', 'system']), id: z.string().max(80), name: z.string().max(120).default('') });
const status = z.enum(['pending', 'approved', 'rejected']);

/** educational_categories / subjects / chapters / concepts added by admins (merged with lib/openbook/taxonomy.ts). */
export const obTaxonomy = collection({
  name: 'ob_taxonomy',
  schema: z.object({ subject: txt(80), cls: z.enum(['11', '12']), chapter: txt(140), concepts: z.array(txt(140)).max(60), examIds: z.array(z.string().max(40)).max(40).default([]), addedBy: z.string().max(80) }),
  k1: (d) => d.subject,
  k2: (d) => d.chapter,
});

/** official_sources: official pages per category/exam, with the link checker's result. */
export const obSources = collection({
  name: 'ob_sources',
  schema: z.object({
    category: txt(20), examId: z.string().max(40).nullable(), name: txt(160), url: z.string().url().max(500),
    resourceType: z.enum(['syllabus', 'textbook', 'previous_papers', 'answer_keys', 'info_bulletin', 'mock_test', 'portal', 'course']),
    licence: z.enum(['link_only', 'free_official', 'open_licence', 'public_domain']),
    status: z.enum(['unchecked', 'ok', 'moved', 'broken']).default('unchecked'),
    httpStatus: z.number().int().nullable().default(null), finalUrl: z.string().max(500).nullable().default(null),
    lastChecked: z.string().nullable().default(null), note: opt(300),
  }),
  k1: (d) => d.category,
  k2: (d) => d.examId,
});

/** books + book_resources: one row per book (metadata, licence, stored file when allowed). */
export const obBooks = collection({
  name: 'ob_books',
  schema: z.object({
    title: txt(300), authors: z.array(z.string().max(160)).max(12).default([]), publisher: opt(200), edition: opt(80), isbn: opt(20), year: opt(10),
    coverUrl: z.string().max(500).nullable().default(null), description: opt(4000),
    category: txt(20), examIds: z.array(z.string().max(40)).max(30).default([]), subjects: z.array(z.string().max(80)).max(10).default([]),
    cls: z.enum(['11', '12', 'both', 'na']).default('na'), chapters: z.array(z.string().max(140)).max(60).default([]),
    /** en, te, hi, ur, sa … (null = not recorded) and the academic year it applies to, e.g. 2026-27 */
    language: z.string().max(10).nullable().default(null), academicYear: z.string().max(12).nullable().default(null),
    docType: z.enum(['textbook', 'reference', 'notes', 'question_bank', 'lab_manual', 'syllabus', 'question_paper', 'other']).nullable().default(null),
    kind: z.enum(['official', 'reference', 'institution']),
    licence: z.enum(['public_domain', 'open_licence', 'free_official', 'institution_owned', 'copyrighted']),
    source: z.enum(['google_books', 'official', 'upload']),
    googleId: opt(40), previewUrl: z.string().max(800).nullable().default(null), purchaseUrl: z.string().max(800).nullable().default(null), officialUrl: z.string().max(800).nullable().default(null),
    fileKey: z.string().max(300).nullable().default(null), fileName: opt(200), fileSize: z.number().int().min(0).default(0), pages: z.number().int().min(0).default(0),
    downloadAllowed: z.boolean().default(false), textStatus: z.enum(['none', 'extracted', 'ocr_needed', 'failed']).default('none'),
    status, uploadedBy: actor, reviewNote: opt(300),
  }),
  k1: (d) => d.category,
  k2: (d) => d.status,
});

/** Extracted text per page (search, study assistant, citations). */
export const obBookPages = collection({
  name: 'ob_book_pages',
  schema: z.object({ bookId: z.string().max(80), page: z.number().int().min(1), text: z.string().max(40_000) }),
  k1: (d) => d.bookId,
  k2: (d) => String(d.page).padStart(5, '0'),
});

/** book_bookmarks (k2 = bookId). Private to the student. */
export const obBookmarks = collection({
  name: 'ob_bookmarks',
  schema: z.object({ studentId: z.string().max(80), bookId: z.string().max(80), page: z.number().int().min(0), label: opt(120) }),
  k1: (d) => d.studentId,
  k2: (d) => d.bookId,
});

/** book_notes: highlights (4 colours) and notes, optionally tied to a passage. Private to the student. */
export const obNotes = collection({
  name: 'ob_notes',
  schema: z.object({ studentId: z.string().max(80), bookId: z.string().max(80), page: z.number().int().min(0), text: z.string().max(4000).default(''), color: z.enum(['yellow', 'green', 'blue', 'pink']).nullable().default(null), note: opt(4000), revision: z.boolean().default(false) }),
  k1: (d) => d.studentId,
  k2: (d) => d.bookId,
});

/** reading_history: last page, pages read, time spent, favourite. */
export const obReading = collection({
  name: 'ob_reading',
  schema: z.object({ studentId: z.string().max(80), bookId: z.string().max(80), lastPage: z.number().int().min(1).default(1), pagesRead: z.array(z.number().int()).max(5000).default([]), seconds: z.number().int().min(0).default(0), favourite: z.boolean().default(false), lastOpened: z.string() }),
  k1: (d) => d.studentId,
  k2: (d) => d.bookId,
});

/** previous_year_papers (the original file is kept unchanged in storage). */
export const obPapers = collection({
  name: 'ob_papers',
  schema: z.object({
    title: txt(200), examId: txt(40), category: txt(20), board: opt(120), subject: txt(80), topics: z.array(z.string().max(140)).max(40).default([]),
    year: z.number().int().min(1950).max(2100), session: opt(60), paperType: z.enum(['official', 'model', 'mock', 'board', 'handwritten', 'other']).default('official'), difficulty: difficulty.nullable().default(null),
    cls: z.enum(['11', '12', 'both', 'na']).default('na'),
    language: z.string().max(10).nullable().default(null), academicYear: z.string().max(12).nullable().default(null),
    fileKey: z.string().max(300), fileName: z.string().max(200), mime: z.string().max(120), size: z.number().int().min(0),
    solutionKey: z.string().max(300).nullable().default(null), answerKey: opt(20_000), licence: z.enum(['official_public', 'institution_owned', 'student_upload', 'unknown']).default('unknown'),
    status, uploadedBy: actor, reviewNote: opt(300),
    extraction: z.object({ status: z.enum(['pending', 'done', 'ocr_needed', 'no_questions', 'failed']), method: z.string().max(40).nullable(), count: z.number().int().min(0), error: z.string().max(300).nullable(), confidence: z.number().min(0).max(1).nullable() }),
  }),
  k1: (d) => d.examId,
  k2: (d) => d.status,
});

const explanation = z.object({
  answer: z.string().max(4000), explanation: z.string().max(12_000), steps: z.array(z.string().max(2000)).max(30).default([]), formulas: z.array(z.string().max(400)).max(20).default([]),
  concepts: z.array(z.string().max(200)).max(20).default([]), outcome: z.string().max(600).default(''), mistakes: z.array(z.string().max(400)).max(10).default([]), related: z.array(z.string().max(200)).max(10).default([]),
  whyOptions: z.array(z.string().max(800)).max(10).default([]),
});
export type Explanation = z.infer<typeof explanation>;

/** question_bank + extracted_questions + generated_questions in one collection, told apart by `origin`. */
export const obQuestions = collection({
  name: 'ob_questions',
  schema: z.object({
    origin: z.enum(['extracted', 'generated', 'teacher', 'scan', 'community']),
    /** private owner (generated / scanned) or null for shared */
    ownerId: z.string().max(80).nullable(), paperId: z.string().max(80).nullable().default(null), qno: opt(20),
    examId: z.string().max(40), subject: z.string().max(80), chapter: z.string().max(140), concept: z.string().max(140), conceptKey: z.string().max(200),
    type: qtype, difficulty, stem: z.string().trim().min(3).max(8000), options: z.array(z.string().max(1500)).max(8).default([]),
    /** mcq: [index…]; numerical/text: [value] */
    answer: z.array(z.string().max(2000)).max(8).default([]), marks: z.number().min(0).max(100).default(4), negative: z.number().min(0).max(100).default(0),
    year: z.number().int().nullable().default(null), explanation: explanation.nullable().default(null),
    normalized: z.string().max(8000), fingerprint: z.string().length(64),
    status: z.enum(['private', 'pending', 'approved', 'rejected']),
    ai: z.boolean().default(false), model: opt(60), createdBy: actor,
    similarity: z.object({ checkedAgainst: z.number().int(), maxScore: z.number(), method: z.string().max(40), nearestId: z.string().nullable() }).nullable().default(null),
    imageKey: z.string().max(300).nullable().default(null),
  }),
  k1: (d) => (d.paperId ? `p:${d.paperId}` : d.ownerId ? `s:${d.ownerId}` : 'bank'),
  k2: (d) => d.conceptKey,
});

/** question_fingerprints: exact-duplicate index (k1 = fingerprint). */
export const obFingerprints = collection({
  name: 'ob_fingerprints',
  schema: z.object({ fingerprint: z.string().length(64), questionId: z.string().max(80), scope: z.string().max(200) }),
  k1: (d) => d.fingerprint,
  k2: (d) => d.scope,
});

/** Questions the uniqueness engine rejected (kept for "review duplicate detection"). */
export const obRejections = collection({
  name: 'ob_rejections',
  schema: z.object({ ownerId: z.string().max(80).nullable(), conceptKey: z.string().max(200), stem: z.string().max(8000), reason: z.enum(['exact', 'semantic', 'invalid']), score: z.number(), nearestId: z.string().nullable(), method: z.string().max(40) }),
  k1: (d) => d.conceptKey,
  k2: (d) => d.reason,
});

/** question_attempts (k2 = conceptKey). */
export const obAttempts = collection({
  name: 'ob_attempts',
  schema: z.object({
    studentId: z.string().max(80), questionId: z.string().max(80), given: z.array(z.string().max(2000)).max(8), correct: z.boolean().nullable(), score: z.number(), max: z.number(),
    seconds: z.number().int().min(0).default(0), date: isoDate, conceptKey: z.string().max(200), subject: z.string().max(80), chapter: z.string().max(140),
    source: z.enum(['practice', 'mock', 'challenge', 'diagnostic', 'path']),
    feedback: opt(4000),
  }),
  k1: (d) => d.studentId,
  k2: (d) => d.conceptKey,
});

/** mock_tests + mock_test_questions (question ids, in order). */
export const obMocks = collection({
  name: 'ob_mocks',
  schema: z.object({
    ownerId: z.string().max(80).nullable(), createdBy: actor, title: txt(200), examId: z.string().max(40), subjects: z.array(z.string().max(80)).max(10), chapters: z.array(z.string().max(140)).max(80),
    minutes: z.number().int().min(1).max(600), marks: z.number().min(0).max(100), negative: z.number().min(0).max(100), questionIds: z.array(z.string().max(80)).min(1).max(200),
    source: z.enum(['ai', 'pool', 'pattern']), batchId: z.string().max(80).nullable().default(null), basis: opt(400),
  }),
  k1: (d) => d.ownerId ?? (d.batchId ? `b:${d.batchId}` : 'shared'),
  k2: (d) => d.examId,
});

/** mock_test_attempts: answers, review marks and time per question are saved as the student goes (resume). */
export const obMockAttempts = collection({
  name: 'ob_mock_attempts',
  schema: z.object({
    mockId: z.string().max(80), studentId: z.string().max(80), startedAt: z.string(), endsAt: z.string(),
    answers: z.record(z.array(z.string().max(4000))).default({}), review: z.array(z.string().max(80)).default([]), time: z.record(z.number().int().min(0)).default({}),
    status: z.enum(['in_progress', 'submitted']), submittedAt: z.string().nullable().default(null), auto: z.boolean().default(false),
    score: z.number().nullable().default(null), max: z.number().nullable().default(null),
    results: z.array(z.object({ questionId: z.string(), correct: z.boolean().nullable(), score: z.number(), max: z.number(), feedback: z.string().max(4000).nullable() })).default([]),
  }),
  k1: (d) => d.studentId,
  k2: (d) => d.mockId,
});

/** student_performance: mastery per concept (0–100), with spaced-repetition scheduling. */
export const obMastery = collection({
  name: 'ob_mastery',
  schema: z.object({ studentId: z.string().max(80), conceptKey: z.string().max(200), subject: z.string().max(80), chapter: z.string().max(140), concept: z.string().max(140), attempts: z.number().int().min(0), correct: z.number().min(0), score: z.number().min(0).max(100), nextReview: isoDate.nullable(), interval: z.number().int().min(0).default(0) }),
  k1: (d) => d.studentId,
  k2: (d) => d.conceptKey,
});

/** ai_agent_sessions: generator, study assistant, voice tutor, scanner and reader conversations. The student can delete them. */
export const obSessions = collection({
  name: 'ob_sessions',
  schema: z.object({
    studentId: z.string().max(80), kind: z.enum(['generator', 'assistant', 'tutor', 'scanner', 'reader']), title: z.string().max(200), lang: z.enum(['en', 'te', 'hi']).default('en'), mode: opt(40),
    turns: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(12_000), sources: z.array(z.object({ label: z.string().max(300), bookId: z.string().nullable(), page: z.number().nullable() })).default([]), at: z.string() })).max(200),
  }),
  k1: (d) => d.studentId,
  k2: (d) => d.kind,
});

/** Per-student daily AI usage (cost control). */
export const obUsage = collection({
  name: 'ob_usage',
  schema: z.object({ who: z.string().max(80), date: isoDate, counts: z.record(z.number().int().min(0)) }),
  k1: (d) => d.who,
  k2: (d) => d.date,
});

/** teacher_assignments: concept exercises, book recommendations and shared tests for a batch. */
export const obAssignments = collection({
  name: 'ob_assignments',
  schema: z.object({
    teacherId: z.string().max(80), teacherName: z.string().max(120), batchId: z.string().max(80), kind: z.enum(['concept', 'book', 'mock']),
    examId: z.string().max(40).nullable(), subject: opt(80), chapter: opt(140), concept: opt(140), count: z.number().int().min(0).max(100).default(10), difficulty: difficulty.nullable().default(null),
    bookId: z.string().max(80).nullable().default(null), mockId: z.string().max(80).nullable().default(null), due: isoDate.nullable().default(null), note: opt(500),
  }),
  k1: (d) => d.batchId,
  k2: (d) => d.kind,
});

/** Flashcards with SM-2 scheduling. */
export const obCards = collection({
  name: 'ob_cards',
  schema: z.object({
    studentId: z.string().max(80), deckId: z.string().max(80), kind: z.enum(['qa', 'formula', 'definition', 'cloze', 'diagram']), front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(4000),
    imageKey: z.string().max(300).nullable().default(null), source: z.enum(['concept', 'chapter', 'passage', 'note', 'wrong_answer', 'manual', 'shared']), conceptKey: z.string().max(200).nullable().default(null),
    /** image occlusion: every labelled box on the diagram (0–1 coordinates) and which one this card asks */
    masks: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) })).max(40).default([]), target: z.number().int().min(0).max(39).nullable().default(null),
    ef: z.number().min(1.3).max(3).default(2.5), interval: z.number().int().min(0).default(0), reps: z.number().int().min(0).default(0), lapses: z.number().int().min(0).default(0), due: isoDate,
  }),
  k1: (d) => d.studentId,
  k2: (d) => d.deckId,
});

export const obDecks = collection({
  name: 'ob_decks',
  schema: z.object({ ownerId: z.string().max(80), ownerKind: z.enum(['student', 'staff']), name: txt(120), subject: opt(80), chapter: opt(140), batchId: z.string().max(80).nullable().default(null), shared: z.boolean().default(false), approved: z.boolean().default(false) }),
  k1: (d) => d.ownerId,
  k2: (d) => d.batchId,
});

/** Personalised learning path. */
export const obPaths = collection({
  name: 'ob_paths',
  schema: z.object({
    studentId: z.string().max(80), examId: z.string().max(40), examDate: isoDate, minutesPerDay: z.number().int().min(10).max(600),
    diagnostic: z.record(z.object({ correct: z.number(), total: z.number(), done: z.boolean() })).default({}),
    items: z.array(z.object({ conceptKey: z.string().max(200), subject: z.string().max(80), chapter: z.string().max(140), concept: z.string().max(140), status: z.enum(['locked', 'in_progress', 'done']), target: isoDate, reason: z.string().max(300), adjustedBy: z.string().max(120).nullable().default(null) })).max(600),
  }),
  k1: (d) => d.studentId,
});

/** Daily challenge (same set for the batch) and attempts. */
export const obChallenges = collection({
  name: 'ob_challenges',
  schema: z.object({ batchId: z.string().max(80), date: isoDate, sets: z.record(z.array(z.string().max(80))) }),
  k1: (d) => d.batchId,
  k2: (d) => d.date,
});
export const obChallengeAttempts = collection({
  name: 'ob_challenge_attempts',
  schema: z.object({ studentId: z.string().max(80), batchId: z.string().max(80), date: isoDate, subject: z.string().max(80), correct: z.number().int(), total: z.number().int(), xp: z.number().int() }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

/** Display name, leaderboard opt-out and community standing. */
export const obProfiles = collection({
  name: 'ob_profiles',
  schema: z.object({ studentId: z.string().max(80), nickname: z.string().trim().min(3).max(24), optOut: z.boolean().default(false), reputation: z.number().int().default(0), suspendedUntil: z.string().nullable().default(null), dailyMinutes: z.number().int().min(10).max(600).default(60), lang: z.enum(['en', 'te', 'hi']).default('en') }),
  k1: (d) => d.studentId,
});

/** Community threads and answers. */
export const obPosts = collection({
  name: 'ob_posts',
  schema: z.object({
    threadId: z.string().max(80).nullable(), author: actor, nickname: z.string().max(60), title: z.string().max(200).default(''), body: z.string().trim().min(2).max(8000), imageKey: z.string().max(300).nullable().default(null),
    subject: z.string().max(80), chapter: opt(140), concept: opt(140), votes: z.array(z.string().max(80)).default([]), acceptedId: z.string().max(80).nullable().default(null),
    verifiedBy: z.string().max(120).nullable().default(null), ai: z.boolean().default(false), reports: z.array(z.object({ by: z.string().max(80), reason: z.string().max(200), at: z.string() })).default([]),
    hidden: z.boolean().default(false), hiddenReason: opt(200), duplicateOf: z.string().max(80).nullable().default(null),
  }),
  k1: (d) => d.threadId ?? 'root',
  k2: (d) => d.subject,
});

/** Moderation and content audit log. */
export const obAudit = collection({
  name: 'ob_audit',
  schema: z.object({ actor, action: z.string().max(60), target: z.string().max(120), note: opt(500) }),
  k1: (d) => d.action,
  k2: (d) => d.target,
});

/** Admin settings: AI model, daily limits, pattern overrides. */
export const obSettings = collection({
  name: 'ob_settings',
  schema: z.object({
    model: z.string().max(60).default('claude-opus-5-5'), dailyQuestions: z.number().int().min(0).max(1000).default(60), dailyAiCalls: z.number().int().min(0).max(2000).default(80),
    dailyVoiceTurns: z.number().int().min(0).max(1000).default(40), duplicateThreshold: z.number().min(0.5).max(0.99).default(0.82), communityEnabled: z.boolean().default(true), aiEnabled: z.boolean().default(true),
    announceWinners: z.boolean().default(true), weeklyReward: z.string().max(200).nullable().default(null), weeklyBonusXp: z.number().int().min(0).max(100).default(0),
  }),
});
