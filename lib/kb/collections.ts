import { z } from 'zod';
import { collection } from '../records/collection';
import { LEVELS, SENSITIVITY } from './access';

/**
 * Knowledge Hub collections in the shared record store (production: the `records` table, RLS on and no
 * policies, service role only; local: the JSON file store). Live records (attendance, marks, fees, leads)
 * are NEVER stored here; centres read them from their own modules.
 */
const id = z.string().min(1).max(120);
const ml = (max: number) => z.object({ en: z.string().trim().min(1).max(max), te: z.string().trim().max(max).optional().nullable(), hi: z.string().trim().max(max).optional().nullable() });
const optMl = (max: number) => z.object({ en: z.string().trim().max(max), te: z.string().trim().max(max).optional().nullable(), hi: z.string().trim().max(max).optional().nullable() });

export const STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const;
export type KbStatus = (typeof STATUSES)[number];
export const CHANNELS = ['website', 'app', 'bot', 'staff'] as const;
export const TYPES = ['article', 'faq', 'policy', 'guide', 'circular', 'form'] as const;

const guarded = {
  centre: z.string().min(1).max(40),
  topic: z.string().max(60).nullable().default(null),
  access: z.enum(LEVELS),
  sensitivity: z.enum(SENSITIVITY),
  ownerId: z.string().max(120).nullable().default(null),
  reviewBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  status: z.enum(STATUSES),
  sample: z.boolean().default(false),
  department: z.string().max(20).nullable().default(null),
  campus: z.string().max(40).nullable().default(null),
};

export const articleSchema = z.object({
  ...guarded,
  title: ml(200),
  body: optMl(20000),
  type: z.enum(TYPES).default('article'),
  channels: z.array(z.enum(CHANNELS)).max(4).default(['staff']),
  tags: z.array(z.string().max(40)).max(20).default([]),
  categoryId: z.string().max(120).nullable().default(null),
  fileIds: z.array(id).max(30).default([]),
  version: z.number().int().min(1),
  /** the version readers see while a newer edit is in draft/review (null = never published) */
  liveVersion: z.number().int().min(1).nullable().default(null),
  createdBy: z.string().max(120),
  updatedBy: z.string().max(120),
  publishedAt: z.string().nullable().default(null),
  submittedBy: z.string().max(120).nullable().default(null),
  approvedBy: z.string().max(120).nullable().default(null),
  rejectReason: z.string().max(500).nullable().default(null),
  /** AI-generated (summary/FAQ): must be approved by staff before publishing (§18 rule) */
  aiGenerated: z.boolean().default(false),
  basedOn: z.array(z.string().max(200)).max(20).default([]),
});
export type Article = z.infer<typeof articleSchema>;
export const kbArticles = collection({ name: 'kb_articles', schema: articleSchema, k1: (d) => d.centre, k2: (d) => d.status });

export const kbVersions = collection({
  name: 'kb_versions',
  schema: z.object({ articleId: id, version: z.number().int().min(1), snapshot: z.record(z.unknown()), by: z.string().max(120), at: z.string(), note: z.string().max(300).nullable() }),
  k1: (d) => d.articleId,
  k2: (d) => String(d.version).padStart(6, '0'),
});

export const kbComments = collection({
  name: 'kb_comments',
  schema: z.object({ targetId: id, by: z.string().max(120), byName: z.string().max(120), text: z.string().trim().min(1).max(2000), at: z.string(), kind: z.enum(['comment', 'reject', 'approve']).default('comment') }),
  k1: (d) => d.targetId,
  k2: (d) => d.at,
});

export const kbCategories = collection({
  name: 'kb_categories',
  schema: z.object({ name: ml(100), parentId: z.string().max(120).nullable(), centre: z.string().max(40), icon: z.string().max(8).default('📁'), ownerId: z.string().max(120).nullable(), reviewerRoles: z.array(z.string().max(40)).max(10).default([]) }),
  k1: (d) => d.centre,
  k2: (d) => d.parentId,
});

const fileVersion = z.object({ version: z.number().int(), storageKey: z.string().max(300), sha256: z.string().max(64), size: z.number().int(), mime: z.string().max(120), name: z.string().max(260), at: z.string(), by: z.string().max(120), note: z.string().max(300).nullable().default(null) });
export const kbFiles = collection({
  name: 'kb_files',
  schema: z.object({
    ...guarded,
    title: ml(200),
    name: z.string().max(260),
    mime: z.string().max(120),
    kind: z.enum(['pdf', 'word', 'excel', 'csv', 'powerpoint', 'image', 'text']),
    size: z.number().int().min(0),
    sha256: z.string().max(64),
    storageKey: z.string().max(300),
    version: z.number().int().min(1),
    liveVersion: z.number().int().min(1).nullable().default(null),
    history: z.array(fileVersion).max(100).default([]),
    extract: z.object({ status: z.enum(['ok', 'empty', 'ocr_needed', 'failed']), method: z.string().max(40), pages: z.number().int().min(0), chars: z.number().int().min(0), langs: z.array(z.string().max(4)).default([]), error: z.string().max(300).nullable().default(null) }),
    scan: z.object({ ok: z.boolean(), notes: z.array(z.string().max(200)).max(20) }),
    channels: z.array(z.enum(CHANNELS)).max(4).default(['staff']),
    uploadedBy: z.string().max(120),
    publishedAt: z.string().nullable().default(null),
    approvedBy: z.string().max(120).nullable().default(null),
    rejectReason: z.string().max(500).nullable().default(null),
  }),
  k1: (d) => d.centre,
  k2: (d) => d.sha256,
});

/**
 * Extracted text of one file version, page by page (index 0 = page 1; sheets/slides count as pages). Kept out
 * of kb_files so lists stay light; one record per version (id `<fileId>:<version>`).
 */
export const kbFileText = collection({
  name: 'kb_file_text',
  schema: z.object({ fileId: id, version: z.number().int(), pages: z.array(z.string().max(40000)).max(3000), pageLabel: z.enum(['page', 'sheet', 'slide', 'part']).default('page') }),
  k1: (d) => d.fileId,
  k2: (d) => String(d.version).padStart(4, '0'),
});

export const kbAudit = collection({
  name: 'kb_audit',
  schema: z.object({
    actor: z.string().max(160),
    role: z.string().max(40),
    action: z.string().max(40),
    targetKind: z.enum(['article', 'file', 'centre', 'search', 'ai', 'export', 'import', 'settings', 'rule', 'grievance', 'system']),
    targetId: z.string().max(120).nullable(),
    title: z.string().max(240).nullable(),
    detail: z.string().max(500).nullable(),
    at: z.string(),
  }),
  k1: (d) => d.targetId,
  k2: (d) => d.at,
});

export const kbSearches = collection({
  name: 'kb_searches',
  schema: z.object({ q: z.string().max(300), viewer: z.string().max(40), lang: z.string().max(4), results: z.number().int(), ms: z.number().int(), clicked: z.string().max(120).nullable().default(null), at: z.string() }),
  k1: (d) => d.viewer,
  k2: (d) => d.at,
});

export const kbConversations = collection({
  name: 'kb_conversations',
  schema: z.object({
    owner: z.string().max(160),
    assistant: z.string().max(30),
    messages: z.array(z.object({ q: z.string().max(1000), a: z.string().max(8000), lang: z.string().max(4), found: z.boolean(), sources: z.array(z.object({ title: z.string().max(240), href: z.string().max(400), page: z.number().int().nullable(), section: z.string().max(200).nullable() })).max(10), ms: z.number().int(), at: z.string(), mode: z.string().max(20), feedback: z.enum(['up', 'down']).nullable().default(null), comment: z.string().max(500).nullable().default(null), handoff: z.boolean().default(false) })).max(200),
  }),
  k1: (d) => d.owner,
  k2: (d) => d.assistant,
});

export const kbGaps = collection({
  name: 'kb_gaps',
  schema: z.object({ q: z.string().max(500), norm: z.string().max(300), lang: z.string().max(4), assistant: z.string().max(30), count: z.number().int().min(1), firstAt: z.string(), lastAt: z.string(), status: z.enum(['open', 'resolved', 'ignored']), articleId: z.string().max(120).nullable().default(null) }),
  k1: (d) => d.norm,
  k2: (d) => d.status,
});

export const kbQueue = collection({
  name: 'kb_queue',
  schema: z.object({ kind: z.enum(['ingest', 'ocr', 'index', 'sync', 'embed']), targetId: z.string().max(120), status: z.enum(['pending', 'processing', 'done', 'failed']), attempts: z.number().int().min(0), error: z.string().max(500).nullable(), at: z.string(), doneAt: z.string().nullable(), ms: z.number().int().nullable().default(null) }),
  k1: (d) => d.status,
  k2: (d) => d.at,
});

export const kbGrievances = collection({
  name: 'kb_grievances',
  schema: z.object({ from: z.string().max(160), fromKind: z.enum(['student', 'parent', 'staff']), studentId: z.string().max(120).nullable(), category: z.string().max(40), text: z.string().trim().min(5).max(3000), status: z.enum(['open', 'in_progress', 'resolved']), reply: z.string().max(3000).nullable().default(null), handledBy: z.string().max(120).nullable().default(null), at: z.string(), updatedAt: z.string() }),
  k1: (d) => d.from,
  k2: (d) => d.status,
});

/** Settings: assistant prompts and suggested questions, subject heads, retention, sync stamp. */
export const kbSettings = collection({
  name: 'kb_settings',
  schema: z.record(z.unknown()),
});

export const NOTIFY_TRIGGERS = ['attendance_absent', 'exam_scheduled', 'assignment_due', 'fee_due', 'exam_registration', 'admission_update', 'announcement', 'parent_message', 'faculty_notice', 'approval_pending', 'document_review'] as const;
export const NOTIFY_CHANNELS = ['push', 'email', 'sms', 'whatsapp'] as const;
export const notifyRules = collection({
  name: 'notify_rules',
  schema: z.object({
    name: z.string().trim().min(2).max(120),
    trigger: z.enum(NOTIFY_TRIGGERS),
    audience: z.enum(['students', 'parents', 'faculty', 'staff', 'approvers', 'owners']),
    channels: z.array(z.enum(NOTIFY_CHANNELS)).min(1).max(4),
    template: ml(1000),
    schedule: z.enum(['immediate', 'daily_8am', 'daily_7pm', 'weekly_sun']),
    active: z.boolean(),
    createdBy: z.string().max(120),
  }),
  k1: (d) => d.trigger,
});
export const notifyLog = collection({
  name: 'notify_log',
  schema: z.object({ ruleId: z.string().max(120).nullable(), trigger: z.string().max(40), channel: z.enum(NOTIFY_CHANNELS), to: z.string().max(160), lang: z.string().max(4), text: z.string().max(2000), status: z.enum(['sent', 'logged', 'not_delivered', 'held_quiet_hours', 'opted_out', 'failed']), error: z.string().max(300).nullable(), at: z.string() }),
  k1: (d) => d.ruleId,
  k2: (d) => d.at,
});
export const notifyOptOuts = collection({
  name: 'notify_optouts',
  schema: z.object({ to: z.string().max(160), channel: z.enum(NOTIFY_CHANNELS), at: z.string() }),
  k1: (d) => d.to,
  k2: (d) => d.channel,
});

/** Lab equipment and department expense requests (§7). */
export const deptRequests = collection({
  name: 'dept_requests',
  schema: z.object({ department: z.string().max(20), kind: z.enum(['equipment', 'purchase', 'expense']), item: z.string().trim().min(2).max(200), qty: z.number().int().min(0).max(10000), condition: z.enum(['good', 'needs_repair', 'broken', 'new_request']).default('good'), amount: z.number().int().min(0).max(100_000_000).default(0), status: z.enum(['listed', 'requested', 'approved', 'rejected']), by: z.string().max(120), at: z.string(), note: z.string().max(500).nullable().default(null) }),
  k1: (d) => d.department,
  k2: (d) => d.status,
});

/** Licences / NOCs with expiry dates (§14). */
export const licences = collection({
  name: 'kb_licences',
  schema: z.object({ name: z.string().trim().min(2).max(160), campus: z.string().max(40), kind: z.enum(['building', 'fire', 'health', 'hostel', 'tsbie', 'other']), number: z.string().max(80).nullable(), validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), fileId: z.string().max(120).nullable(), sample: z.boolean().default(false) }),
  k1: (d) => d.kind,
  k2: (d) => d.validTo,
});
