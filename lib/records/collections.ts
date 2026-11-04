import { z } from 'zod';
import { collection } from './collection';

/** Every collection in the record store, with its schema and index keys. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-06-01');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use a month like 2027-01');
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

// ---------------------------------------------------------------- management / marketing

/** Ad spend per source and month — cost per lead and source ROI on the dashboard (§8). */
export const marketingSpend = collection({
  name: 'marketing_spend',
  schema: z.object({ source: text(40), month, amount: z.coerce.number().int().min(0).max(100_000_000), note: optText(200), enteredBy: z.string() }),
  k1: (d) => d.month,
  k2: (d) => d.source,
});

/** Staff AI assistant: every question asked, by whom and when, and which students it returned (§8.2 ai_query_audit). */
export const aiQueryAudit = collection({
  name: 'ai_query_audit',
  schema: z.object({
    actorId: z.string().min(1).max(80),
    role: z.string().max(40),
    query: z.string().trim().min(1).max(500),
    intent: z.string().max(40),
    resultCount: z.coerce.number().int().min(0),
    studentIds: z.array(z.string().max(80)).max(200),
    at: z.string(),
  }),
  k1: (d) => d.actorId,
  k2: (d) => d.at,
});

// ---------------------------------------------------------------- academics (§9, §9A rows 3, 10–12, 15)

const id = z.string().min(1).max(80);
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const url = z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  if (!/^(https:\/\/|\/)[^\s<>"']+$/.test(t)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use an https:// link' });
    return z.NEVER;
  }
  return t;
});
export const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Sanskrit / Telugu', 'Mental Ability'] as const;

/** A batch / section. Capacity is capped by the CMS batch cap (max 40, §6.10). */
export const batches = collection({
  name: 'batches',
  schema: z.object({ name: text(40), program: text(40), year: z.coerce.number().int().min(1).max(2), section: text(4), capacity: z.coerce.number().int().min(1).max(40), classTeacherId: z.string().nullable(), studentIds: z.array(id).max(40), active: z.boolean() }),
  k1: (d) => d.program,
  k2: (d) => d.classTeacherId,
});

/** One timetable period. k1 = batch, k2 = faculty (so a teacher's own timetable is one lookup). */
export const timetable = collection({
  name: 'timetable',
  schema: z.object({ batchId: id, day: z.coerce.number().int().min(1).max(6), start: time, end: time, subject: text(40), facultyId: id, room: optText(20) }).refine((d) => d.start < d.end, 'The period must end after it starts'),
  k1: (d) => d.batchId,
  k2: (d) => d.facultyId,
});

export const ATTENDANCE = ['present', 'absent', 'late', 'leave'] as const;
/** One register per batch per day (per period if several are taken). */
export const attendance = collection({
  name: 'attendance',
  schema: z.object({ batchId: id, date: isoDate, period: z.string().max(20).default('day'), marks: z.record(z.enum(ATTENDANCE)), markedBy: id, notifiedAbsent: z.array(id).default([]) }),
  k1: (d) => d.batchId,
  k2: (d) => d.date,
});

export const MATERIAL_KINDS = ['notes', 'dpp', 'assignment', 'recording', 'live'] as const;
export const materials = collection({
  name: 'materials',
  schema: z.object({ batchId: id, subject: text(40), title: text(140), kind: z.enum(MATERIAL_KINDS), url, dueDate: isoDate.nullable().optional().transform((v) => v ?? null), uploadedBy: id }),
  k1: (d) => d.batchId,
  k2: (d) => d.kind,
});

/** A JEE/NEET-pattern test (online with questions, or offline with marks entry). */
const question = z.object({ id: id, subject: text(40), chapter: text(80), text: text(2000), options: z.array(text(500)).length(4), answer: z.coerce.number().int().min(0).max(3), marks: z.coerce.number().min(0).max(10), negative: z.coerce.number().min(0).max(5) });
export const tests = collection({
  name: 'tests',
  schema: z.object({
    batchId: id,
    title: text(140),
    date: isoDate,
    mode: z.enum(['online', 'offline']),
    durationMin: z.coerce.number().int().min(5).max(240),
    maxMarks: z.coerce.number().min(1).max(1000),
    subjects: z.array(text(40)).min(1).max(6),
    questions: z.array(question).max(200).default([]),
    published: z.boolean(),
    createdBy: id,
  }),
  k1: (d) => d.batchId,
  k2: (d) => d.date,
});
export type Question = z.infer<typeof question>;

/** A student's result in a test (submitted online, or entered by faculty). */
export const testResults = collection({
  name: 'test_results',
  schema: z.object({
    testId: id,
    studentId: id,
    score: z.number().min(-1000).max(1000),
    max: z.number().min(1).max(1000),
    bySubject: z.record(z.number()),
    byChapter: z.record(z.object({ right: z.number(), wrong: z.number(), skipped: z.number() })).default({}),
    answers: z.record(z.number().int().min(-1).max(3)).default({}),
    secondsPerQuestion: z.record(z.number().min(0)).default({}),
    startedAt: z.string().nullable().default(null),
    submittedAt: z.string(),
    enteredBy: z.string().nullable().default(null),
  }),
  k1: (d) => d.testId,
  k2: (d) => d.studentId,
});

export const doubts = collection({
  name: 'doubts',
  schema: z.object({ studentId: id, batchId: id, subject: text(40), text: text(2000), imageUrl: url, status: z.enum(['open', 'answered']), answer: optText(4000), answeredBy: z.string().nullable(), answeredAt: z.string().nullable() }),
  k1: (d) => d.studentId,
  k2: (d) => d.subject,
});

/** Notices and circulars. audience: all | students | parents | staff | batch:<id> */
export const notices = collection({
  name: 'notices',
  schema: z.object({ title: text(140), body: text(4000), audience: z.string().regex(/^(all|students|parents|staff|batch:.+)$/), date: isoDate, publishedBy: id, attachmentUrl: url }),
  k1: (d) => d.audience,
  k2: (d) => d.date,
});

// ---------------------------------------------------------------- mentoring & wellbeing (§6.5, §9A row 12)

/** 1 mentor per 20 students. */
export const mentorships = collection({ name: 'mentorships', schema: z.object({ mentorId: id, studentId: id }), k1: (d) => d.mentorId, k2: (d) => d.studentId });

export const mentorNotes = collection({
  name: 'mentor_notes',
  schema: z.object({ studentId: id, mentorId: id, date: isoDate, kind: z.enum(['one_to_one', 'note', 'parent_call']), note: text(2000), shareWithParent: z.boolean() }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

/** Monthly check-in. 1 = very stressed … 5 = doing well. Low scores trigger a private parent call, never a public list. */
export const wellbeing = collection({
  name: 'wellbeing',
  schema: z.object({ studentId: id, month, stress: z.coerce.number().int().min(1).max(5), sleep: z.coerce.number().int().min(1).max(5), note: optText(1000), recordedBy: id, followUp: z.enum(['none', 'parent_call', 'counsellor']).default('none') }),
  k1: (d) => d.studentId,
  k2: (d) => d.month,
});

export const discipline = collection({
  name: 'discipline',
  schema: z.object({ studentId: id, date: isoDate, note: text(1000), action: optText(300), recordedBy: id }),
  k1: (d) => d.studentId,
  k2: (d) => d.date,
});

// ---------------------------------------------------------------- PTM & parent ↔ teacher messages (§6.11)

export const ptmSlots = collection({
  name: 'ptm_slots',
  schema: z.object({ staffId: id, date: isoDate, time, minutes: z.coerce.number().int().min(5).max(60), bookedBy: z.string().nullable(), studentId: z.string().nullable() }),
  k1: (d) => d.staffId,
  k2: (d) => d.date,
});

/** One message. Thread = student × staff member. */
export const messages = collection({
  name: 'messages',
  schema: z.object({ studentId: id, staffId: id, from: z.enum(['parent', 'staff']), fromPhone: z.string().nullable(), text: text(2000), readAt: z.string().nullable() }),
  k1: (d) => d.studentId,
  k2: (d) => d.staffId,
});

// ---------------------------------------------------------------- hostel (§3.4, §9A row 13)

export const hostelRooms = collection({
  name: 'hostel_rooms',
  schema: z.object({ block: z.enum(['boys', 'girls']), room: text(10), ac: z.boolean(), capacity: z.coerce.number().int().min(1).max(6), studentIds: z.array(id).max(6) }),
  k1: (d) => d.block,
  k2: (d) => d.room,
});

/** Student → parent → warden. */
export const outpasses = collection({
  name: 'outpasses',
  schema: z.object({ studentId: id, from: z.string(), to: z.string(), reason: text(300), status: z.enum(['requested', 'parent_approved', 'approved', 'rejected', 'returned']), parentPhone: z.string().nullable(), parentAt: z.string().nullable(), wardenId: z.string().nullable(), wardenAt: z.string().nullable(), note: optText(300) }),
  k1: (d) => d.studentId,
  k2: (d) => d.status,
});

export const sickRoom = collection({
  name: 'sick_room',
  schema: z.object({ studentId: id, at: z.string(), complaint: text(300), action: text(300), doctorCalled: z.boolean(), parentInformed: z.boolean(), recordedBy: id }),
  k1: (d) => d.studentId,
  k2: (d) => d.at.slice(0, 10),
});

export const nightAttendance = collection({
  name: 'night_attendance',
  schema: z.object({ block: z.enum(['boys', 'girls']), date: isoDate, present: z.array(id), absent: z.array(id), markedBy: id }),
  k1: (d) => d.block,
  k2: (d) => d.date,
});

export const hostelComplaints = collection({
  name: 'hostel_complaints',
  schema: z.object({ studentId: z.string().nullable(), category: z.enum(['food', 'room', 'cleanliness', 'safety', 'other']), text: text(1000), status: z.enum(['open', 'resolved']), resolution: optText(500), by: id }),
  k1: (d) => d.status,
  k2: (d) => d.category,
});

/** Visitors (front desk and hostel) and student gate passes. */
export const visitorLog = collection({
  name: 'visitor_log',
  schema: z.object({ date: isoDate, name: text(80), phone: optText(20), purpose: text(200), studentId: z.string().nullable(), place: z.enum(['front_desk', 'hostel']), inAt: z.string(), outAt: z.string().nullable(), recordedBy: id, kind: z.enum(['visitor', 'gate_pass', 'parcel']) }),
  k1: (d) => d.date,
  k2: (d) => d.place,
});

// ---------------------------------------------------------------- transport (§9A row 14)

export const buses = collection({
  name: 'buses',
  schema: z.object({ route: text(60), busNo: text(20), driverName: text(80), driverPhone: optText(20), studentIds: z.array(id).max(80), location: z.object({ lat: z.number(), lng: z.number(), at: z.string() }).nullable() }),
  k1: (d) => d.route,
  k2: (d) => d.busNo,
});

export const busAttendance = collection({
  name: 'bus_attendance',
  schema: z.object({ busId: id, date: isoDate, trip: z.enum(['pickup', 'drop']), present: z.array(id), markedBy: id }),
  k1: (d) => d.busId,
  k2: (d) => d.date,
});

// ---------------------------------------------------------------- accounts (§9A row 9)

/** Instalment plan for a student (amounts in ₹). */
export const feeSchedules = collection({
  name: 'fee_schedules',
  schema: z.object({ studentId: id, leadId: id, items: z.array(z.object({ due: isoDate, amount: z.coerce.number().int().min(1).max(10_000_000), label: text(60) })).min(1).max(24), createdBy: id }),
  k1: (d) => d.studentId,
  k2: (d) => d.leadId,
});

/** Concession or refund requests with the approval chain of §9A.3. */
export const feeRequests = collection({
  name: 'fee_requests',
  schema: z.object({ kind: z.enum(['concession', 'refund']), leadId: id, amount: z.coerce.number().int().min(1).max(10_000_000), percentOfTuition: z.number().min(0).max(100).nullable(), reason: text(500), status: z.enum(['pending', 'approved', 'rejected']), level: z.enum(['slab', 'above']), requestedBy: id, decidedBy: z.string().nullable(), decidedAt: z.string().nullable(), note: optText(300) }),
  k1: (d) => d.status,
  k2: (d) => d.leadId,
});

// ---------------------------------------------------------------- admin office (§9A row 10)

export const certificates = collection({
  name: 'certificates',
  schema: z.object({ studentId: id, kind: z.enum(['tc', 'bonafide', 'study', 'conduct']), number: text(30), issuedAt: z.string(), issuedBy: id, purpose: optText(200), conduct: optText(40) }),
  k1: (d) => d.studentId,
  k2: (d) => d.kind,
});

// ---------------------------------------------------------------- staff

export const leaveRequests = collection({
  name: 'leave_requests',
  schema: z.object({ staffId: id, from: isoDate, to: isoDate, reason: text(300), status: z.enum(['pending', 'approved', 'rejected']), decidedBy: z.string().nullable() }).refine((d) => d.from <= d.to, 'The leave must end on or after it starts'),
  k1: (d) => d.staffId,
  k2: (d) => d.status,
});

/** Counselling session record (§7.1 step 7). */
export const counselling = collection({
  name: 'counselling',
  schema: z.object({ leadId: id, counsellorId: id, programDiscussed: text(40), feesExplained: z.boolean(), scholarshipExplained: z.boolean(), concerns: optText(1000), decision: z.enum(['confirmed', 'pending', 'lost']), notes: optText(2000) }),
  k1: (d) => d.leadId,
  k2: (d) => d.counsellorId,
});

// ---------------------------------------------------------------- app side (§9A rows 17–20)

/** DPDP Act 2023 consent at first login (parents, students, applicants). */
export const consents = collection({
  name: 'consents',
  schema: z.object({ phone: z.string(), version: z.string(), purposes: z.array(z.string()), at: z.string(), ip: z.string().nullable() }),
  k1: (d) => d.phone,
  k2: (d) => d.version,
});

/** College ID + password for students (optional; OTP stays available). */
export const studentCredentials = collection({
  name: 'student_credentials',
  schema: z.object({ collegeId: z.string(), studentId: id, passwordHash: z.string(), failed: z.number().int().min(0), lockedUntil: z.string().nullable() }),
  k1: (d) => d.collegeId,
  k2: (d) => d.studentId,
});

export const alumni = collection({
  name: 'alumni',
  schema: z.object({ studentId: z.string().nullable(), name: text(80), phone: z.string(), passedOut: z.coerce.number().int().min(2000).max(2100), nowAt: optText(120), course: optText(120), mentorWilling: z.boolean(), story: optText(2000), approved: z.boolean() }),
  k1: (d) => d.phone,
  k2: (d) => String(d.passedOut),
});

/** Applicant documents uploaded from the app before admission (verified by the Admission Office). */
export const applicantDocs = collection({
  name: 'applicant_docs',
  schema: z.object({ leadId: id, key: text(40), filename: text(200), contentType: text(100), size: z.number().int().min(1).max(5_000_000), storagePath: text(300), uploadedAt: z.string() }),
  k1: (d) => d.leadId,
  k2: (d) => d.key,
});

/** The online application form (§4.2 row 15, §9A row 19). */
export const applications = collection({
  name: 'applications',
  schema: z.object({
    leadId: id,
    studentName: text(80),
    dob: isoDate,
    gender: z.enum(['female', 'male', 'other']),
    program: text(40),
    stay: z.enum(['day', 'hostel']),
    school: text(120),
    board: text(40),
    sscMarks: optText(20),
    parentName: text(80),
    parentPhone: z.string(),
    address: text(400),
    submittedAt: z.string().nullable(),
  }),
  k1: (d) => d.leadId,
  k2: (d) => (d.submittedAt ? 'submitted' : 'draft'),
});

export { isoDate, month, text, optText };
