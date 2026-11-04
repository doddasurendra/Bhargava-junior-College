import { z } from 'zod';
import * as sample from '@/content/sample';
import { programs } from '@/content/programs';
import { college } from '@/content/college';
import type { Role } from '../crm/types';
import type { Field } from './fields';

/**
 * Every piece of college content the admin replaces before launch (brief §2 placeholders, §3 sample data,
 * acceptance criteria: "all sample data is replaceable from the admin CMS without code changes").
 * Each block: who may edit it, its schema, the editor form, and the sample default used until it's saved.
 * `sample: true` shows the "Sample data" badge; the editor's "This is real data" switch turns it off.
 */

const s = (max = 200) => z.string().trim().min(1, 'Required').max(max);
const os = (max = 300) => z.union([z.string(), z.null()]).optional().transform((v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null));
const url = z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  if (!/^(https:\/\/|\/)[^\s<>"']+$/.test(t)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use an https:// link or a site path starting with /' });
    return z.NEVER;
  }
  return t;
});
// Button links: a site path (/visit), an in-page anchor (#callback) or an https:// link.
const LINK_RE = /^(https:\/\/|\/|#)[^\s<>"']*$/;
const sitePath = z.string().trim().min(1, 'Required').max(300).regex(LINK_RE, 'Use /page, #section or an https:// link');
const optSitePath = z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  if (t.length > 300 || !LINK_RE.test(t)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use /page, #section or an https:// link' });
    return z.NEVER;
  }
  return t;
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const money = z.coerce.number().int().min(0).max(10_000_000);
const flag = z.boolean();
const PROGRAM_OPTS = programs.map((p) => ({ value: p.slug, label: p.short }));

const MANAGE: Role[] = ['super_admin'];
const CONTENT: Role[] = ['super_admin', 'data_executive'];

function block<S extends z.ZodTypeAny>(b: { key: string; title: string; description: string; editors: Role[]; schema: S; fields: Field[]; default: z.input<S> }) {
  return b;
}

export const BLOCKS = {
  results: block({
    key: 'results',
    title: 'Results & toppers',
    description: 'Topper cards on the home page and the Results page. Add a scorecard link to each card so parents can verify it (§6.7).',
    editors: [...CONTENT, 'academic_coordinator'],
    schema: z.object({
      sample: flag,
      items: z.array(z.object({ name: s(80), exam: s(60), type: z.enum(['jee', 'neet', 'board']), year: z.coerce.number().int().min(2000).max(2100), score: s(40), verifyUrl: url })).max(200),
      aggregates: z.array(z.object({ value: s(12), label: s(60) })).max(8),
    }),
    fields: [
      { key: 'items', label: 'Toppers', type: 'list', itemLabel: 'topper', of: [
        { key: 'name', label: 'Student', type: 'text' },
        { key: 'exam', label: 'Exam', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'jee', label: 'JEE' }, { value: 'neet', label: 'NEET' }, { value: 'board', label: 'Board' }] },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'score', label: 'Score / rank', type: 'text' },
        { key: 'verifyUrl', label: 'Scorecard verification link', type: 'url' },
      ] },
      { key: 'aggregates', label: 'Headline numbers', type: 'list', itemLabel: 'number', of: [
        { key: 'value', label: 'Value', type: 'text' },
        { key: 'label', label: 'Label', type: 'text' },
      ] },
    ],
    default: sample.results,
  }),

  fees: block({
    key: 'fees',
    title: 'Fee structure',
    description: 'The public fee table, the fee calculator, the chat assistant and the parent app all use these figures (per year, ₹).',
    editors: [...MANAGE, 'accounts'],
    schema: z.object({
      sample: flag,
      academicYear: s(20),
      twoYear: z.object({ tuition: money, material: money, admission: money }),
      longTerm: z.object({ tuition: money, material: money, admission: money }),
      hostelNonAc: money,
      hostelAc: money,
      transport: money,
      instalmentOptions: z.array(z.coerce.number().int().min(1).max(12)).min(1).max(6),
      paymentModes: z.array(s(60)).min(1).max(10),
    }),
    fields: [
      { key: 'academicYear', label: 'Academic year', type: 'text' },
      { key: 'twoYear', label: 'JEE / NEET 2-year', type: 'group', fields: [
        { key: 'tuition', label: 'Tuition', type: 'number' },
        { key: 'material', label: 'Study material & test series', type: 'number' },
        { key: 'admission', label: 'Admission fee (one time)', type: 'number' },
      ] },
      { key: 'longTerm', label: 'Long Term', type: 'group', fields: [
        { key: 'tuition', label: 'Tuition', type: 'number' },
        { key: 'material', label: 'Study material & test series', type: 'number' },
        { key: 'admission', label: 'Admission fee (one time)', type: 'number' },
      ] },
      { key: 'hostelNonAc', label: 'Hostel non-AC (incl. food)', type: 'number' },
      { key: 'hostelAc', label: 'Hostel AC (incl. food)', type: 'number' },
      { key: 'transport', label: 'Transport (day scholars)', type: 'number' },
      { key: 'instalmentOptions', label: 'Instalment options (one per line, e.g. 1, 3, 10)', type: 'strings' },
      { key: 'paymentModes', label: 'Payment methods shown to parents (one per line)', type: 'strings' },
    ],
    default: sample.fees,
  }),

  bsat: block({
    key: 'bsat',
    title: 'BSAT scholarship test',
    description: 'Test dates, sections and the scholarship slab table (§3.3). Slabs must be sorted from the highest score down.',
    editors: [...MANAGE, 'admission_manager', 'academic_coordinator'],
    schema: z.object({
      sample: flag,
      name: s(120),
      durationMin: z.coerce.number().int().min(10).max(300),
      sections: z.array(s(60)).min(1).max(8),
      eligibility: s(120),
      resultsWithin: s(40),
      sessions: z.array(z.object({ id: s(40), date, mode: z.enum(['campus', 'online']) })).max(20),
      slabs: z.array(z.object({ min: z.coerce.number().min(0).max(100), label: s(40), pct: z.coerce.number().min(0).max(100) })).min(1).max(10)
        .refine((a) => a.every((x, i) => i === 0 || a[i - 1].min > x.min), 'Sort the slabs from the highest minimum score down.'),
      gpaBonus: z.coerce.number().min(0).max(100),
      cap: z.coerce.number().min(0).max(100),
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'durationMin', label: 'Duration (minutes)', type: 'number' },
      { key: 'eligibility', label: 'Eligibility', type: 'text' },
      { key: 'resultsWithin', label: 'Results within', type: 'text' },
      { key: 'sections', label: 'Sections (one per line)', type: 'strings' },
      { key: 'sessions', label: 'Test sessions', type: 'list', itemLabel: 'session', of: [
        { key: 'id', label: 'Code (unique, e.g. 2026-11-16-campus)', type: 'text' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'campus', label: 'Campus' }, { value: 'online', label: 'Online' }] },
      ] },
      { key: 'slabs', label: 'Scholarship slabs (highest first)', type: 'list', itemLabel: 'slab', of: [
        { key: 'min', label: 'Minimum score %', type: 'number' },
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'pct', label: 'Tuition scholarship %', type: 'number' },
      ] },
      { key: 'gpaBonus', label: 'Extra % for 10 GPA in SSC', type: 'number' },
      { key: 'cap', label: 'Total cap %', type: 'number' },
    ],
    default: sample.bsat,
  }),

  hostel: block({
    key: 'hostel',
    title: 'Hostel details',
    description: 'The Hostel page and the parent app.',
    editors: [...MANAGE, 'hostel_warden'],
    schema: z.object({
      sample: flag,
      blocks: s(200),
      rooms: z.array(s(120)).max(10),
      safety: z.array(s(200)).max(10),
      health: z.array(s(120)).max(10),
      amenities: z.array(s(120)).max(10),
      food: s(400),
      schedule: z.array(z.object({ time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'), activity: s(80) })).max(20),
      wardens: z.array(z.object({ name: s(80), block: s(60), phone: os(20) })).max(10).default([]),
      cctvPolicy: os(600).default(null),
    }),
    fields: [
      { key: 'blocks', label: 'Blocks', type: 'text' },
      { key: 'rooms', label: 'Rooms (one per line)', type: 'strings' },
      { key: 'safety', label: 'Safety (one per line)', type: 'strings' },
      { key: 'health', label: 'Health (one per line)', type: 'strings' },
      { key: 'amenities', label: 'Amenities (one per line)', type: 'strings' },
      { key: 'food', label: 'Food', type: 'longtext' },
      { key: 'schedule', label: 'Daily schedule', type: 'list', itemLabel: 'slot', of: [
        { key: 'time', label: 'Time', type: 'time' },
        { key: 'activity', label: 'Activity', type: 'text' },
      ] },
      { key: 'wardens', label: 'Warden contacts (shown to parents in the app)', type: 'list', itemLabel: 'warden', of: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'block', label: 'Block / floor', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
      ] },
      { key: 'cctvPolicy', label: 'CCTV policy', type: 'longtext' },
    ],
    default: { ...sample.hostel, wardens: [], cctvPolicy: null },
  }),

  faculty: block({
    key: 'faculty',
    title: 'Faculty & leadership',
    description: 'Faculty cards on the website.',
    editors: [...CONTENT, 'principal'],
    schema: z.object({
      sample: flag,
      items: z.array(z.object({ name: s(80), subject: s(40), years: z.coerce.number().int().min(0).max(60), qualification: os(120).default(null), photoUrl: url.default(null) })).max(100),
      leadershipMessage: os(2000).default(null),
    }),
    fields: [
      { key: 'items', label: 'Faculty', type: 'list', itemLabel: 'faculty member', of: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'subject', label: 'Subject', type: 'text' },
        { key: 'years', label: 'Years of experience', type: 'number' },
        { key: 'qualification', label: 'Qualification', type: 'text' },
        { key: 'photoUrl', label: 'Photo link', type: 'url' },
      ] },
      { key: 'leadershipMessage', label: 'Message from the leadership (About page)', type: 'longtext' },
    ],
    default: { sample: true, items: sample.faculty.items.map((f) => ({ ...f, qualification: null, photoUrl: null })), leadershipMessage: null },
  }),

  faqs: block({
    key: 'faqs',
    title: 'FAQs',
    description: 'The FAQ section, and the knowledge base the chat assistant answers from.',
    editors: CONTENT,
    schema: z.object({ sample: flag, items: z.array(z.object({ q: s(200), a: s(1200) })).max(100) }),
    fields: [{ key: 'items', label: 'Questions', type: 'list', itemLabel: 'question', of: [
      { key: 'q', label: 'Question', type: 'text' },
      { key: 'a', label: 'Answer', type: 'longtext' },
    ] }],
    default: sample.faqs,
  }),

  visitSlots: block({
    key: 'visitSlots',
    title: 'Campus visit slots',
    description: 'Bookable slots for campus visits (Mon–Sat). Capacity is families per slot.',
    editors: [...MANAGE, 'admission_manager'],
    schema: z.object({
      sample: flag,
      slots: z.array(z.object({ slot: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'), label: s(20), capacity: z.coerce.number().int().min(1).max(50), saturday: flag })).min(1).max(12),
      maxDaysAhead: z.coerce.number().int().min(1).max(120),
    }),
    fields: [
      { key: 'slots', label: 'Slots', type: 'list', itemLabel: 'slot', of: [
        { key: 'slot', label: 'Start (HH:MM)', type: 'time' },
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'capacity', label: 'Families per slot', type: 'number' },
        { key: 'saturday', label: 'Also on Saturday', type: 'bool' },
      ] },
      { key: 'maxDaysAhead', label: 'Bookable up to N days ahead', type: 'number' },
    ],
    default: sample.visitSlots,
  }),

  documentChecklist: block({
    key: 'documentChecklist',
    title: 'Admission document checklist',
    description: 'What the Admission Office verifies before the College ID (§7.4). Not-required items are "if applicable".',
    editors: [...MANAGE, 'admission_office'],
    schema: z.object({
      sample: flag,
      default: z.array(z.object({ key: z.string().regex(/^[a-z0-9_]{2,40}$/, 'lowercase letters, digits, _'), label: s(120), required: flag })).min(1).max(30),
      byProgram: z.record(z.array(z.object({ key: z.string(), label: s(120), required: flag }))).default({}),
    }),
    fields: [{ key: 'default', label: 'Documents', type: 'list', itemLabel: 'document', of: [
      { key: 'key', label: 'Code (e.g. ssc_memo)', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'required', label: 'Required', type: 'bool' },
    ] }],
    default: { sample: sample.documentChecklist.sample, default: sample.documentChecklist.default, byProgram: {} },
  }),

  numbering: block({
    key: 'numbering',
    title: 'College ID & receipt numbering',
    description: 'Change before issuing the first ID or receipt of the year — numbers already issued keep their format.',
    editors: MANAGE,
    schema: z.object({
      sample: flag,
      collegeId: z.object({ template: s(60).refine((t) => t.includes('{SEQ}'), 'The template needs {SEQ}'), year: z.coerce.number().int().min(2020).max(2100), seqDigits: z.coerce.number().int().min(3).max(8), programCodes: z.record(z.string().trim().min(1).max(8)) }),
      receipt: z.object({ prefix: s(10), academicYear: s(10), seqDigits: z.coerce.number().int().min(3).max(8) }),
    }),
    fields: [
      { key: 'collegeId', label: 'College ID', type: 'group', fields: [
        { key: 'template', label: 'Template ({YEAR}, {PROGRAM}, {SEQ})', type: 'text' },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'seqDigits', label: 'Sequence digits', type: 'number' },
        { key: 'programCodes', label: 'Program codes', type: 'group', fields: PROGRAM_OPTS.map((p) => ({ key: p.value, label: p.label, type: 'text' as const })) },
      ] },
      { key: 'receipt', label: 'Receipt', type: 'group', fields: [
        { key: 'prefix', label: 'Prefix', type: 'text' },
        { key: 'academicYear', label: 'Academic year', type: 'text' },
        { key: 'seqDigits', label: 'Sequence digits', type: 'number' },
      ] },
    ],
    default: sample.numbering,
  }),

  messMenu: block({
    key: 'messMenu',
    title: 'Weekly mess menu',
    description: 'Shown in the parent and student app. Update every week.',
    editors: [...MANAGE, 'hostel_warden'],
    schema: z.object({ sample: flag, weekOf: date, days: z.array(z.object({ day: s(12), breakfast: s(120), lunch: s(120), snacks: s(120), dinner: s(120) })).length(7, 'All 7 days') }),
    fields: [
      { key: 'weekOf', label: 'Week starting', type: 'date' },
      { key: 'days', label: 'Days', type: 'list', itemLabel: 'day', of: [
        { key: 'day', label: 'Day', type: 'text' },
        { key: 'breakfast', label: 'Breakfast', type: 'text' },
        { key: 'lunch', label: 'Lunch', type: 'text' },
        { key: 'snacks', label: 'Snacks', type: 'text' },
        { key: 'dinner', label: 'Dinner', type: 'text' },
      ] },
    ],
    default: sample.messMenu,
  }),

  season: block({
    key: 'season',
    title: 'Admissions season & seat targets',
    description: '"Season to date" on the dashboard starts here. Seat targets drive "seats filled vs target" (§8). Batches are capped at 40 (§6.10).',
    editors: [...MANAGE, 'management'],
    schema: z.object({
      sample: flag,
      label: s(40),
      start: date,
      seatTargets: z.record(z.coerce.number().int().min(0).max(5000)),
      batchCap: z.coerce.number().int().min(1).max(40, 'The brief caps batches at 40'),
    }),
    fields: [
      { key: 'label', label: 'Intake label', type: 'text' },
      { key: 'start', label: 'Season starts', type: 'date' },
      { key: 'seatTargets', label: 'Seat target per program', type: 'group', fields: PROGRAM_OPTS.map((p) => ({ key: p.value, label: p.label, type: 'number' as const })) },
      { key: 'batchCap', label: 'Maximum students per batch', type: 'number' },
    ],
    default: { ...sample.admissionsSeason, seatTargets: { 'iit-jee': 120, neet: 120, 'long-term-jee': 40, 'long-term-neet': 40 }, batchCap: 40 },
  }),

  brochures: block({
    key: 'brochures',
    title: 'Brochures & downloads',
    description: 'Program brochure PDFs (sent on WhatsApp and lead-gated on the site), plus the prospectus and circulars on the Downloads page.',
    editors: CONTENT,
    schema: z.object({
      sample: flag,
      urls: z.record(url),
      downloads: z.array(z.object({ title: s(120), kind: z.enum(['brochure', 'prospectus', 'circular', 'form']), url, gated: flag })).max(50).default([]),
    }),
    fields: [
      { key: 'urls', label: 'Program brochure PDF links', type: 'group', fields: PROGRAM_OPTS.map((p) => ({ key: p.value, label: p.label, type: 'url' as const })) },
      { key: 'downloads', label: 'Downloads page', type: 'list', itemLabel: 'download', of: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'brochure', label: 'Brochure' }, { value: 'prospectus', label: 'Prospectus' }, { value: 'circular', label: 'Circular' }, { value: 'form', label: 'Form' }] },
        { key: 'url', label: 'File link', type: 'url' },
        { key: 'gated', label: 'Ask for name + mobile first', type: 'bool' },
      ] },
    ],
    default: { ...sample.brochures, downloads: [] },
  }),

  testimonials: block({
    key: 'testimonials',
    title: 'Parent testimonials',
    description: 'Only testimonials with a quote are shown. Use the parents’ own words, with their permission.',
    editors: CONTENT,
    schema: z.object({ sample: flag, items: z.array(z.object({ name: s(80), role: os(120), quote: os(600), videoUrl: url })).max(30) }),
    fields: [{ key: 'items', label: 'Testimonials', type: 'list', itemLabel: 'testimonial', of: [
      { key: 'name', label: 'Parent', type: 'text' },
      { key: 'role', label: 'Designation', type: 'text' },
      { key: 'quote', label: 'Quote', type: 'longtext' },
      { key: 'videoUrl', label: 'Video link', type: 'url' },
    ] }],
    // Real names from the brief (§2); the quotes must come from the college.
    default: { sample: true, items: [
      { name: 'Siva RK', role: 'Senior Scientist, DRDL', quote: null, videoUrl: null },
      { name: 'Raj M', role: 'VP, MNC', quote: null, videoUrl: null },
      { name: 'Madhukar Reddy', role: 'Senior Lecturer', quote: null, videoUrl: null },
    ] },
  }),

  gallery: block({
    key: 'gallery',
    title: 'Campus gallery & 360° tour',
    description: 'Photos on the Campus page. Use https:// links to images (e.g. the Supabase storage bucket).',
    editors: CONTENT,
    schema: z.object({ sample: flag, tourUrl: url, items: z.array(z.object({ title: s(80), area: z.enum(['classrooms', 'labs', 'library', 'hostel', 'sports', 'events', 'other']), imageUrl: url })).max(200) }),
    fields: [
      { key: 'tourUrl', label: '360° tour link', type: 'url' },
      { key: 'items', label: 'Photos', type: 'list', itemLabel: 'photo', of: [
        { key: 'title', label: 'Caption', type: 'text' },
        { key: 'area', label: 'Area', type: 'select', options: ['classrooms', 'labs', 'library', 'hostel', 'sports', 'events', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
        { key: 'imageUrl', label: 'Image link', type: 'url' },
      ] },
    ],
    default: { sample: true, tourUrl: null, items: [] },
  }),

  blog: block({
    key: 'blog',
    title: 'Blog & exam news',
    description: 'Posts on /blog. Check every exam date against the official notice before publishing.',
    editors: CONTENT,
    schema: z.object({
      sample: flag,
      posts: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]{3,80}$/, 'lowercase-words-with-dashes'), title: s(140), date, tag: z.enum(['jee', 'neet', 'ts-inter', 'study-tips', 'college']), summary: s(300), body: s(20000), published: flag })).max(500),
    }),
    fields: [{ key: 'posts', label: 'Posts', type: 'list', itemLabel: 'post', of: [
      { key: 'slug', label: 'URL slug', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'tag', label: 'Tag', type: 'select', options: [{ value: 'jee', label: 'JEE' }, { value: 'neet', label: 'NEET' }, { value: 'ts-inter', label: 'TS Inter' }, { value: 'study-tips', label: 'Study tips' }, { value: 'college', label: 'College news' }] },
      { key: 'summary', label: 'Summary', type: 'longtext' },
      { key: 'body', label: 'Body (blank line between paragraphs)', type: 'longtext' },
      { key: 'published', label: 'Published', type: 'bool' },
    ] }],
    default: { sample: true, posts: [
      { slug: 'planning-two-years-jee-neet-with-inter', title: 'Planning two years of JEE or NEET alongside TS Inter', date: '2026-10-20', tag: 'study-tips', summary: 'How an integrated program fits board preparation and entrance preparation into one timetable, and what parents can check each month.', body: 'An integrated program teaches the Intermediate syllabus and the entrance syllabus together, so a topic is learned once and then practised at both levels.\n\nEach week has daily practice papers (DPPs), a weekly test and doubt-clinic time. Parents can follow attendance and test trends in the parent app.\n\nAsk your mentor for a monthly plan that lists weak chapters and the revision schedule for them.', published: true },
      { slug: 'how-the-bsat-scholarship-works', title: 'How the BSAT scholarship works', date: '2026-10-25', tag: 'college', summary: 'The Bhargava Scholarship & Admission Test sets a tuition scholarship from your score. Here is how the slabs and the SSC GPA bonus combine.', body: 'BSAT is a 90-minute test for Class 10 students, held on campus and online.\n\nYour score maps to a tuition scholarship slab. A 10 GPA in SSC adds an extra percentage, and the total is capped. The current slabs are on the Scholarship page and in the fee calculator.\n\nResults are published within 48 hours.', published: true },
    ] },
  }),

  resources: block({
    key: 'resources',
    title: 'Free resources',
    description: 'NCERT solutions, previous papers, sample DPPs, formula sheets and the exam calendar. Downloads ask for a name and mobile first (they become CRM leads).',
    editors: [...CONTENT, 'academic_coordinator'],
    schema: z.object({ sample: flag, items: z.array(z.object({ title: s(140), kind: z.enum(['ncert', 'pyq', 'dpp', 'formula', 'calendar']), exam: z.enum(['jee', 'neet', 'board', 'all']), url, gated: flag })).max(500) }),
    fields: [{ key: 'items', label: 'Resources', type: 'list', itemLabel: 'resource', of: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'ncert', label: 'NCERT solutions' }, { value: 'pyq', label: 'Previous-year papers' }, { value: 'dpp', label: 'Sample DPP' }, { value: 'formula', label: 'Formula sheet' }, { value: 'calendar', label: 'Exam calendar' }] },
      { key: 'exam', label: 'For', type: 'select', options: [{ value: 'jee', label: 'JEE' }, { value: 'neet', label: 'NEET' }, { value: 'board', label: 'Board' }, { value: 'all', label: 'All' }] },
      { key: 'url', label: 'File link (leave empty until uploaded)', type: 'url' },
      { key: 'gated', label: 'Ask for name + mobile first', type: 'bool' },
    ] }],
    default: { sample: true, items: [
      { title: 'Physics formula sheet: mechanics', kind: 'formula', exam: 'jee', url: null, gated: true },
      { title: 'Biology: NCERT Class 11 key diagrams', kind: 'ncert', exam: 'neet', url: null, gated: true },
      { title: 'Sample DPP: quadratic equations', kind: 'dpp', exam: 'jee', url: null, gated: true },
      { title: 'Sample DPP: chemical bonding', kind: 'dpp', exam: 'all', url: null, gated: true },
    ] },
  }),

  careers: block({
    key: 'careers',
    title: 'Careers',
    description: 'Openings on /careers. Applications go to the email below.',
    editors: [...MANAGE, 'principal'],
    schema: z.object({ sample: flag, applyEmail: z.string().trim().email(), openings: z.array(z.object({ title: s(100), department: s(60), type: z.enum(['full-time', 'part-time', 'visiting']), description: s(2000), open: flag })).max(50) }),
    fields: [
      { key: 'applyEmail', label: 'Applications email', type: 'text' },
      { key: 'openings', label: 'Openings', type: 'list', itemLabel: 'opening', of: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'full-time', label: 'Full time' }, { value: 'part-time', label: 'Part time' }, { value: 'visiting', label: 'Visiting' }] },
        { key: 'description', label: 'Description', type: 'longtext' },
        { key: 'open', label: 'Accepting applications', type: 'bool' },
      ] },
    ],
    default: { sample: true, applyEmail: 'office@bhargavajuniorcollege.com', openings: [] },
  }),

  parentCorner: block({
    key: 'parentCorner',
    title: 'Parent corner',
    description: 'PTM information, policies and transport routes on /parents.',
    editors: [...MANAGE, 'principal', 'transport_incharge'],
    schema: z.object({
      sample: flag,
      ptm: s(1000),
      policies: z.array(z.object({ title: s(100), body: s(2000) })).max(20),
      routes: z.array(z.object({ name: s(60), stops: z.array(s(60)).max(40), pickup: os(20) })).max(30),
      appLinks: z.object({ android: url, ios: url }),
    }),
    fields: [
      { key: 'ptm', label: 'PTM information', type: 'longtext' },
      { key: 'policies', label: 'Policies', type: 'list', itemLabel: 'policy', of: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'body', label: 'Text', type: 'longtext' },
      ] },
      { key: 'routes', label: 'Transport routes', type: 'list', itemLabel: 'route', of: [
        { key: 'name', label: 'Route', type: 'text' },
        { key: 'stops', label: 'Stops (one per line)', type: 'strings' },
        { key: 'pickup', label: 'First pickup time', type: 'text' },
      ] },
      { key: 'appLinks', label: 'App store links', type: 'group', fields: [
        { key: 'android', label: 'Google Play', type: 'url' },
        { key: 'ios', label: 'App Store', type: 'url' },
      ] },
    ],
    default: {
      sample: true,
      ptm: 'Parent–teacher meetings are held after every unit test cycle. Book a slot with your child’s class teacher or mentor in the parent app.',
      policies: [
        { title: 'Attendance', body: 'Absence is reported to parents the same day. Leave must be requested in advance through the app or the class teacher.' },
        { title: 'Mobile phones', body: 'Students may not use mobile phones during classes and supervised study.' },
      ],
      routes: [],
      appLinks: { android: null, ios: null },
    },
  }),

  mockTest: block({
    key: 'mockTest',
    title: 'Free mock test',
    description: 'The public JEE/NEET-pattern sample test on /mock-test (instant score and analysis; it captures a lead). Keep it short: 10–20 questions.',
    editors: [...CONTENT, 'academic_coordinator'],
    schema: z.object({
      sample: flag,
      title: s(120),
      durationMin: z.coerce.number().int().min(5).max(60),
      questions: z.array(z.object({ id: s(20), subject: s(40), chapter: s(80), text: s(1000), options: z.array(s(300)).length(4), answer: z.coerce.number().int().min(0).max(3), marks: z.coerce.number().min(1).max(10), negative: z.coerce.number().min(0).max(5) })).min(3).max(30),
    }),
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'durationMin', label: 'Minutes', type: 'number' },
      { key: 'questions', label: 'Questions', type: 'list', itemLabel: 'question', of: [
        { key: 'id', label: 'Code (unique)', type: 'text' },
        { key: 'subject', label: 'Subject', type: 'text' },
        { key: 'chapter', label: 'Chapter', type: 'text' },
        { key: 'text', label: 'Question', type: 'longtext' },
        { key: 'options', label: 'Four options (one per line)', type: 'strings' },
        { key: 'answer', label: 'Correct option (0 = first … 3 = fourth)', type: 'number' },
        { key: 'marks', label: 'Marks', type: 'number' },
        { key: 'negative', label: 'Negative marks', type: 'number' },
      ] },
    ],
    default: {
      sample: true,
      title: 'JEE / NEET sample test (10 questions)',
      durationMin: 15,
      questions: [
        { id: 'p1', subject: 'Physics', chapter: 'Kinematics', text: 'A body starts from rest with uniform acceleration 2 m/s². Its displacement in the first 5 s is', options: ['10 m', '25 m', '50 m', '5 m'], answer: 1, marks: 4, negative: 1 },
        { id: 'p2', subject: 'Physics', chapter: 'Laws of motion', text: 'The SI unit of momentum is', options: ['kg m/s', 'N/s', 'kg m/s²', 'J s'], answer: 0, marks: 4, negative: 1 },
        { id: 'p3', subject: 'Physics', chapter: 'Work, energy and power', text: 'A 2 kg body moving at 3 m/s has kinetic energy', options: ['6 J', '3 J', '9 J', '18 J'], answer: 2, marks: 4, negative: 1 },
        { id: 'c1', subject: 'Chemistry', chapter: 'Atomic structure', text: 'The maximum number of electrons in a shell with n = 3 is', options: ['8', '18', '32', '9'], answer: 1, marks: 4, negative: 1 },
        { id: 'c2', subject: 'Chemistry', chapter: 'Chemical bonding', text: 'The shape of a methane (CH₄) molecule is', options: ['Square planar', 'Trigonal planar', 'Tetrahedral', 'Linear'], answer: 2, marks: 4, negative: 1 },
        { id: 'c3', subject: 'Chemistry', chapter: 'Mole concept', text: 'The number of moles in 36 g of water is', options: ['1', '2', '3', '0.5'], answer: 1, marks: 4, negative: 1 },
        { id: 'm1', subject: 'Mathematics', chapter: 'Quadratic equations', text: 'The roots of x² − 5x + 6 = 0 are', options: ['1 and 6', '2 and 3', '−2 and −3', '3 and 4'], answer: 1, marks: 4, negative: 1 },
        { id: 'm2', subject: 'Mathematics', chapter: 'Trigonometry', text: 'sin²θ + cos²θ equals', options: ['0', '2', '1', 'tan θ'], answer: 2, marks: 4, negative: 1 },
        { id: 'b1', subject: 'Biology', chapter: 'Cell', text: 'The powerhouse of the cell is the', options: ['Nucleus', 'Ribosome', 'Golgi body', 'Mitochondrion'], answer: 3, marks: 4, negative: 1 },
        { id: 'b2', subject: 'Biology', chapter: 'Human physiology', text: 'Red blood cells carry oxygen bound to', options: ['Haemoglobin', 'Insulin', 'Keratin', 'Myosin'], answer: 0, marks: 4, negative: 1 },
      ],
    },
  }),

  predictor: block({
    key: 'predictor',
    title: 'Rank & college predictor',
    description: 'Inputs for /predictor. These are estimates from past-year patterns: update every year from official NTA data. The page always says it is an estimate, never a promise.',
    editors: [...CONTENT, 'academic_coordinator'],
    schema: z.object({
      sample: flag,
      jeeCandidates: z.coerce.number().int().min(1000).max(5_000_000),
      neetBands: z.array(z.object({ minScore: z.coerce.number().min(0).max(720), rankFrom: z.coerce.number().int().min(1), rankTo: z.coerce.number().int().min(1) })).min(1).max(30),
      colleges: z.array(z.object({ exam: z.enum(['jee', 'neet']), maxRank: z.coerce.number().int().min(1), name: s(120) })).max(100),
    }),
    fields: [
      { key: 'jeeCandidates', label: 'JEE Main candidates (latest year)', type: 'number' },
      { key: 'neetBands', label: 'NEET score → rank bands (highest first)', type: 'list', itemLabel: 'band', of: [
        { key: 'minScore', label: 'Score from', type: 'number' },
        { key: 'rankFrom', label: 'Rank from', type: 'number' },
        { key: 'rankTo', label: 'Rank to', type: 'number' },
      ] },
      { key: 'colleges', label: 'College types by closing rank', type: 'list', itemLabel: 'college', of: [
        { key: 'exam', label: 'Exam', type: 'select', options: [{ value: 'jee', label: 'JEE' }, { value: 'neet', label: 'NEET' }] },
        { key: 'maxRank', label: 'Typical closing rank (general)', type: 'number' },
        { key: 'name', label: 'College or category', type: 'text' },
      ] },
    ],
    default: {
      sample: true,
      jeeCandidates: 1_200_000,
      neetBands: [
        { minScore: 680, rankFrom: 1, rankTo: 1500 },
        { minScore: 650, rankFrom: 1500, rankTo: 6000 },
        { minScore: 620, rankFrom: 6000, rankTo: 15000 },
        { minScore: 600, rankFrom: 15000, rankTo: 25000 },
        { minScore: 550, rankFrom: 25000, rankTo: 60000 },
        { minScore: 500, rankFrom: 60000, rankTo: 110000 },
        { minScore: 0, rankFrom: 110000, rankTo: 2000000 },
      ],
      colleges: [
        { exam: 'jee', maxRank: 10000, name: 'Top NITs (popular branches)' },
        { exam: 'jee', maxRank: 40000, name: 'NITs and IIITs (most branches)' },
        { exam: 'jee', maxRank: 100000, name: 'GFTIs and state universities' },
        { exam: 'neet', maxRank: 2000, name: 'AIIMS and top government medical colleges' },
        { exam: 'neet', maxRank: 25000, name: 'Government medical colleges (state quota, varies)' },
        { exam: 'neet', maxRank: 100000, name: 'Private and deemed medical colleges' },
      ],
    },
  }),

  heroSlides: block({
    key: 'heroSlides',
    title: 'Home page hero slides',
    description: 'The rotating headline at the top of the home page. The callback form beside it never moves. Keep 2–5 slides; the first one is what search engines read.',
    editors: CONTENT,
    schema: z.object({
      sample: flag,
      intervalSec: z.coerce.number().int().min(4).max(30),
      slides: z.array(z.object({
        eyebrow: s(80),
        title: s(80),
        highlight: os(80),
        body: s(320),
        primaryLabel: s(40),
        primaryHref: sitePath,
        secondaryLabel: os(40),
        secondaryHref: optSitePath,
      })).min(1).max(6),
    }),
    fields: [
      { key: 'intervalSec', label: 'Seconds per slide', type: 'number', min: 4, max: 30 },
      { key: 'slides', label: 'Slides', type: 'list', itemLabel: 'slide', of: [
        { key: 'eyebrow', label: 'Small label above the headline', type: 'text' },
        { key: 'title', label: 'Headline', type: 'text' },
        { key: 'highlight', label: 'Headline, second line (gold)', type: 'text' },
        { key: 'body', label: 'Supporting text', type: 'longtext' },
        { key: 'primaryLabel', label: 'Main button text', type: 'text' },
        { key: 'primaryHref', label: 'Main button link (e.g. /visit or #callback)', type: 'text' },
        { key: 'secondaryLabel', label: 'Second button text', type: 'text' },
        { key: 'secondaryHref', label: 'Second button link', type: 'text' },
      ] },
    ],
    // Marked sample until the college confirms the copy (the BSAT slide quotes the sample scholarship cap).
    default: {
      sample: true,
      intervalSec: 7,
      slides: [
        {
          eyebrow: `Admissions open · ${college.admissionsOpen} batch`,
          title: 'Two years. One goal.',
          highlight: 'Your IIT or medical seat.',
          body: `IIT-JEE and NEET UG integrated with the TS Intermediate Board, on one campus in Saroornagar, Hyderabad. Faculty with ${college.facultyAvgExperience} of average experience, batches of up to ${college.maxBatchSize}, and fees you can see before you call.`,
          primaryLabel: 'Enquire now', primaryHref: '#callback', secondaryLabel: 'Book a campus visit', secondaryHref: '/visit',
        },
        {
          eyebrow: 'BSAT · Scholarship & admission test',
          title: 'One 90-minute test.',
          highlight: `Up to ${sample.bsat.cap}% off tuition.`,
          body: 'For Class 10 students, on campus or online. Your BSAT score sets your tuition scholarship, and the fee calculator shows exactly what you will pay.',
          primaryLabel: 'Register for BSAT', primaryHref: '/scholarship#register', secondaryLabel: 'See your fee', secondaryHref: '/fees',
        },
        {
          eyebrow: 'Hostel & parent connect',
          title: 'A hostel parents can see into.',
          highlight: 'Alerts on every check-in.',
          body: 'Biometric check-in and check-out with a WhatsApp alert to parents, wardens on every floor, and a weekly report with attendance, test trend and the mentor’s note.',
          primaryLabel: 'Explore the hostel', primaryHref: '/hostel', secondaryLabel: 'Track an admission', secondaryHref: '/track',
        },
      ],
    },
  }),

  social: block({
    key: 'social',
    title: 'Social links & contact extras',
    description: 'Footer links. Leave empty to hide.',
    editors: CONTENT,
    schema: z.object({ sample: flag, instagram: url, youtube: url, facebook: url, googleBusiness: url, whatsappNumber: os(20) }),
    fields: [
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
      { key: 'facebook', label: 'Facebook', type: 'url' },
      { key: 'googleBusiness', label: 'Google Business Profile', type: 'url' },
      { key: 'whatsappNumber', label: 'WhatsApp Business number (confirm with the college)', type: 'text' },
    ],
    default: { sample: true, instagram: null, youtube: null, facebook: null, googleBusiness: null, whatsappNumber: null },
  }),
};

export type BlockKey = keyof typeof BLOCKS;
export type Content = { [K in BlockKey]: z.output<(typeof BLOCKS)[K]['schema']> };
export const BLOCK_KEYS = Object.keys(BLOCKS) as BlockKey[];

/** Sample defaults, parsed through the schemas so they have exactly the stored shape. */
export function defaultContent(): Content {
  return Object.fromEntries(BLOCK_KEYS.map((k) => [k, BLOCKS[k].schema.parse(BLOCKS[k].default)])) as Content;
}

export const canEditBlock = (roles: Role[], key: BlockKey) => roles.includes('developer') || roles.some((r) => (BLOCKS[key].editors as Role[]).includes(r));
