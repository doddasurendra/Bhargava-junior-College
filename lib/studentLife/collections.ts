import { z } from 'zod';
import { collection } from '../records/collection';
import { isoDate, optText, text } from '../records/collections';

/**
 * Student life: sports, speaker sessions, wellbeing and open-book learning. Stored in the shared `records`
 * table (RLS on, no policies: only the server's service role can read it). Who may see what is enforced in
 * lib/studentLife/*.ts. Wellbeing rows are special-category data (DPDP Act 2023): every staff read is logged.
 */
const id = z.string().min(1).max(80);
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

// ---------------------------------------------------------------- sports
export const SPORTS = ['Cricket', 'Volleyball', 'Badminton', 'Kabaddi', 'Chess', 'Table tennis', 'Athletics', 'Yoga'] as const;
export const HOUSES = [
  { key: 'godavari', name: 'Godavari', color: '#1D2A5E' },
  { key: 'krishna', name: 'Krishna', color: '#7D1F2C' },
  { key: 'tungabhadra', name: 'Tungabhadra', color: '#C9A24A' },
  { key: 'manjeera', name: 'Manjeera', color: '#2F7A4F' },
] as const;
export const HOUSE_KEYS = HOUSES.map((h) => h.key) as [string, ...string[]];

/** One row per house: its members. */
export const houses = collection({
  name: 'sports_houses',
  schema: z.object({ key: z.enum(HOUSE_KEYS), name: text(40), color: text(10), captainId: z.string().nullable(), studentIds: z.array(id).max(400) }),
  k1: (d) => d.key,
  k2: () => null,
});

export const FIXTURE_KINDS = ['daily_games', 'inter_house', 'sports_day', 'inter_college'] as const;
export const fixtures = collection({
  name: 'sports_fixtures',
  schema: z.object({
    title: text(140),
    sport: text(40),
    kind: z.enum(FIXTURE_KINDS),
    date: isoDate,
    time: time.nullable().default(null),
    venue: optText(80),
    home: text(60),
    away: text(60),
    status: z.enum(['scheduled', 'played', 'cancelled']),
    homeScore: z.string().max(40).nullable().default(null),
    awayScore: z.string().max(40).nullable().default(null),
    winner: z.enum(['home', 'away', 'draw']).nullable().default(null),
    teamIds: z.array(id).max(60).default([]),
    createdBy: id,
  }),
  k1: (d) => d.kind,
  k2: (d) => d.date,
});

/** Daily games period attendance. */
export const sportsAttendance = collection({
  name: 'sports_attendance',
  schema: z.object({ date: isoDate, sport: text(40), present: z.array(id).max(400), markedBy: id }),
  k1: (d) => d.date,
  k2: (d) => d.sport,
});

export const sportsSignups = collection({
  name: 'sports_signups',
  schema: z.object({ studentId: id, sport: text(40) }),
  k1: (d) => d.studentId,
  k2: (d) => d.sport,
});

/** Twice a year. BMI is optional and private (student, parent, coach only). */
export const fitnessChecks = collection({
  name: 'fitness_checks',
  schema: z.object({ studentId: id, date: isoDate, run600mSec: z.coerce.number().int().min(60).max(900).nullable(), sitReachCm: z.coerce.number().min(-30).max(60).nullable(), bmi: z.coerce.number().min(10).max(50).nullable(), recordedBy: id }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

export const MEDALS = ['gold', 'silver', 'bronze', 'certificate', 'participation'] as const;
export const achievements = collection({
  name: 'sports_achievements',
  schema: z.object({ studentId: id, title: text(140), medal: z.enum(MEDALS), event: text(140), date: isoDate, recordedBy: id }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

// ---------------------------------------------------------------- speaker sessions
export const speakers = collection({
  name: 'speakers',
  schema: z.object({ name: text(80), background: text(200), topic: text(200), contact: optText(80), fee: z.coerce.number().int().min(0).max(10_000_000).nullable(), sample: z.boolean().default(false) }),
  k1: () => null,
  k2: () => null,
});

export const SESSION_TYPES = [
  { value: 'motivational', label: 'Motivational talk' },
  { value: 'toppers', label: 'Toppers’ interaction' },
  { value: 'alumni', label: 'Alumni session' },
  { value: 'career', label: 'Career guidance' },
  { value: 'parent_seminar', label: 'Parent seminar' },
  { value: 'exam_strategy', label: 'Exam-strategy workshop' },
  { value: 'study_skills', label: 'Study-skills workshop' },
] as const;
export const SESSION_TYPE_KEYS = SESSION_TYPES.map((t) => t.value) as [string, ...string[]];

/** audience: all_students | parents | batch:<id> */
export const sessions = collection({
  name: 'speaker_sessions',
  schema: z.object({
    title: text(140),
    type: z.enum(SESSION_TYPE_KEYS),
    speakerId: z.string().nullable(),
    date: isoDate,
    time,
    venue: optText(120),
    onlineUrl: z.string().max(300).nullable().default(null),
    audience: z.string().regex(/^(all_students|parents|batch:.+)$/),
    capacity: z.coerce.number().int().min(1).max(5000),
    summary: optText(1000),
    recordingPath: z.string().max(300).nullable().default(null),
    alumniId: z.string().nullable().default(null),
    sample: z.boolean().default(false),
    createdBy: id,
  }),
  k1: (d) => d.audience,
  k2: (d) => d.date,
});

/** who: a student id, or a parent's phone. */
export const sessionRegs = collection({
  name: 'session_registrations',
  schema: z.object({ sessionId: id, who: z.string().max(80), kind: z.enum(['student', 'parent']), studentId: z.string().nullable(), attended: z.boolean().default(false) }),
  k1: (d) => d.sessionId,
  k2: (d) => d.who,
});

export const sessionFeedback = collection({
  name: 'session_feedback',
  schema: z.object({ sessionId: id, who: z.string().max(80), rating: z.coerce.number().int().min(1).max(5), comment: optText(500) }),
  k1: (d) => d.sessionId,
  k2: (d) => d.who,
});

// ---------------------------------------------------------------- wellbeing (private)
/** Weekly self check-in by the student. Private: student, counsellor, and (as a flag only) the mentor. */
export const checkins = collection({
  name: 'wellbeing_checkins',
  schema: z.object({ studentId: id, weekStart: isoDate, mood: z.coerce.number().int().min(1).max(5), sleepHours: z.coerce.number().min(0).max(14), stress: z.coerce.number().int().min(1).max(5), note: optText(1000), distress: z.boolean().default(false) }),
  k1: (d) => d.studentId,
  k2: (d) => d.weekStart,
});

/** First-use consent (DPDP Act 2023) and the student's choice to share a summary with parents. */
export const wellbeingConsent = collection({
  name: 'wellbeing_consent',
  schema: z.object({ studentId: id, at: z.string(), shareWithParent: z.boolean() }),
  k1: (d) => d.studentId,
  k2: () => null,
});

export const counsellorBookings = collection({
  name: 'counsellor_bookings',
  schema: z.object({ studentId: id, date: isoDate, time, mode: z.enum(['in_person', 'call']), status: z.enum(['requested', 'confirmed', 'done', 'cancelled']), topic: optText(300) }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

/** No student id is stored: the counsellor never sees who asked. */
export const anonQuestions = collection({
  name: 'anon_questions',
  schema: z.object({ text: text(1000), answer: optText(2000), answeredAt: z.string().nullable(), distress: z.boolean().default(false), ticket: z.string().max(40) }),
  k1: (d) => d.ticket,
  k2: (d) => (d.answer ? 'answered' : 'open'),
});

/** Counsellor-only notes. */
export const counsellorNotes = collection({
  name: 'counsellor_notes',
  schema: z.object({ studentId: id, note: text(2000), by: id, date: isoDate }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

/** What the mentor sees: a flag, never the reason or the notes. */
export const wellbeingFlags = collection({
  name: 'wellbeing_flags',
  schema: z.object({ studentId: id, status: z.enum(['needs_conversation', 'resolved']), raisedBy: z.string().max(80), date: isoDate }),
  k1: (d) => d.studentId,
  k2: (d) => d.status,
});

/** Safety protocol: possible serious distress detected in a note, question, doubt or chat. */
export const safetyAlerts = collection({
  name: 'safety_alerts',
  schema: z.object({ source: z.enum(['checkin', 'anon_question', 'doubt', 'chat']), refId: z.string().max(80), studentId: z.string().nullable(), excerpt: text(300), at: z.string(), status: z.enum(['open', 'acknowledged', 'closed']), notified: z.array(z.string()).default([]), handledBy: z.string().nullable().default(null) }),
  k1: (d) => d.status,
  k2: (d) => d.at,
});

/** Who viewed wellbeing data, and when (audit). */
export const wellbeingAccess = collection({
  name: 'wellbeing_access_log',
  schema: z.object({ actorId: id, role: z.string().max(40), what: z.string().max(80), studentId: z.string().nullable(), at: z.string() }),
  k1: (d) => d.actorId,
  k2: (d) => d.at,
});

/** Admin-editable helpline list (verify numbers before launch). */
export const helplines = collection({
  name: 'helplines',
  schema: z.object({ name: text(80), number: text(30), hours: optText(80), note: optText(200) }),
  k1: () => null,
  k2: () => null,
});

// ---------------------------------------------------------------- open-book
export const OB_KINDS = ['application', 'analysis', 'case_data', 'own_words', 'real_life'] as const;
export const OB_ANSWER_TYPES = ['mcq_explain', 'short', 'long', 'photo'] as const;
const rubric = z.array(z.object({ criterion: text(60), max: z.coerce.number().int().min(1).max(20) })).min(1).max(6);
export const DEFAULT_RUBRIC = [
  { criterion: 'Concept understanding', max: 4 },
  { criterion: 'Method', max: 3 },
  { criterion: 'Correct use of resources', max: 1 },
  { criterion: 'Explanation', max: 2 },
];

export const obQuestions = collection({
  name: 'openbook_questions',
  schema: z.object({ subject: text(40), chapter: text(80), kind: z.enum(OB_KINDS), answerType: z.enum(OB_ANSWER_TYPES), text: text(2000), options: z.array(text(300)).max(4).default([]), modelAnswer: text(3000), rubric, openBookSuitable: z.boolean().default(true), createdBy: id }),
  k1: (d) => d.subject,
  k2: (d) => d.kind,
});

export const resources = z.object({ ownNotes: z.boolean(), ncert: z.boolean(), formulaSheet: z.boolean(), calculator: z.boolean(), internet: z.boolean() });
export const obAssignments = collection({
  name: 'openbook_assignments',
  schema: z.object({ batchId: id, title: text(140), subject: text(40), questionIds: z.array(id).min(1).max(30), perStudent: z.coerce.number().int().min(1).max(30), resources, durationMin: z.coerce.number().int().min(10).max(300), opensAt: z.string(), closesAt: z.string(), createdBy: id }),
  k1: (d) => d.batchId,
  k2: (d) => d.closesAt.slice(0, 10),
});

export const obAttempts = collection({
  name: 'openbook_attempts',
  schema: z.object({
    assignmentId: id,
    studentId: id,
    questionIds: z.array(id),
    pledgedAt: z.string(),
    answers: z.record(z.string().max(5000)).default({}),
    submittedAt: z.string().nullable().default(null),
    suggestion: z.record(z.record(z.number())).nullable().default(null),
    marks: z.record(z.record(z.number())).nullable().default(null),
    feedback: z.string().max(2000).nullable().default(null),
    total: z.number().nullable().default(null),
    max: z.number().nullable().default(null),
    markedBy: z.string().nullable().default(null),
    similarity: z.array(z.object({ questionId: z.string(), otherStudentId: z.string(), score: z.number() })).default([]),
  }),
  k1: (d) => d.assignmentId,
  k2: (d) => d.studentId,
});

export const bigQuestions = collection({
  name: 'big_questions',
  schema: z.object({ subject: text(40), weekStart: isoDate, text: text(1000), createdBy: id }),
  k1: (d) => d.subject,
  k2: (d) => d.weekStart,
});

export const bigAnswers = collection({
  name: 'big_answers',
  schema: z.object({ questionId: id, studentId: id, text: text(4000), featured: z.boolean().default(false) }),
  k1: (d) => d.questionId,
  k2: (d) => d.studentId,
});
