import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getProgram, PROGRAM_SLUGS } from '@/content/programs';
import { getContent } from '../cms';
import type { Content } from '../cms/blocks';
import { getConversationStore } from '../chat/service';
import { getCrmRepo } from '../crm/repo';
import { formatDate, todayIST } from '../dates';
import { calculateFee, formatINR, STAY_OPTIONS } from '../fees';
import { normalizeIndianMobile } from '../phone';
import { getStore, StoreError } from '../store';
import type { Attribution } from '../validation';
import { slotLabel, slotsFor, validateVisit } from '../visits';
import { bsatRegistered, visitConfirmation } from '../whatsapp/service';

type Tool = Anthropic.Beta.BetaTool;

const nullableString = { type: ['string', 'null'] } as const;

/** Strict schemas: every property required (nullable where optional), no extra properties. Built from the CMS slots and BSAT sessions. */
export const buildTools = ({ visitSlots, bsat }: Pick<Content, 'visitSlots' | 'bsat'>): Tool[] => [
  {
    name: 'calculate_fee',
    description:
      'Calculate the exact yearly fee for a program, stay option, BSAT score and instalment plan. Use whenever the visitor asks what they would pay. bsat_score is the BSAT percentage (0-100) or null if not taken.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        program: { type: 'string', enum: [...PROGRAM_SLUGS] },
        stay: { type: 'string', enum: STAY_OPTIONS.map((s) => s.value) },
        bsat_score: { type: ['number', 'null'] },
        ssc_10_gpa: { type: 'boolean' },
        instalments: { type: 'integer', enum: [1, 3, 10] },
      },
      required: ['program', 'stay', 'bsat_score', 'ssc_10_gpa', 'instalments'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_visit_slots',
    description: 'List campus visit slots and how many places are left on a date (YYYY-MM-DD, India time). Call before book_visit.',
    strict: true,
    input_schema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'], additionalProperties: false },
  },
  {
    name: 'save_enquiry',
    description:
      'Save the visitor as an admission enquiry so a counsellor calls back. Only after the visitor has given their name and mobile number. Returns consent_required if they have not yet agreed to share their details.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, phone: { type: 'string' }, program: { type: ['string', 'null'], enum: [...PROGRAM_SLUGS, null] }, note: nullableString },
      required: ['name', 'phone', 'program', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'book_visit',
    description:
      'Book a campus visit. Needs name, mobile, date (YYYY-MM-DD) and slot (HH:MM from get_visit_slots). Ask for missing details one at a time. Returns consent_required if the visitor has not yet agreed to share their details.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        date: { type: 'string' },
        slot: { type: 'string', enum: visitSlots.slots.map((s) => s.slot) },
        program: { type: ['string', 'null'], enum: [...PROGRAM_SLUGS, null] },
        family_size: { type: 'integer' },
      },
      required: ['name', 'phone', 'date', 'slot', 'program', 'family_size'],
      additionalProperties: false,
    },
  },
  {
    name: 'register_bsat',
    description: 'Register a Class 10 student for the BSAT scholarship test and get a hall ticket number. stream is MPC (engineering) or BiPC (medical); session_id comes from the BSAT sessions in the knowledge base.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { student_name: { type: 'string' }, phone: { type: 'string' }, stream: { type: 'string', enum: ['MPC', 'BiPC'] }, session_id: { type: 'string', enum: bsat.sessions.map((s) => s.id) } },
      required: ['student_name', 'phone', 'stream', 'session_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_application',
    description: 'When the visitor asks about the status of their admission or application. Admission details are private, so this returns how to view them securely.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'note_unanswered',
    description:
      'Record a question the knowledge base does not answer, so the college can add the answer. Call it whenever you have to say you do not know, then offer a counsellor. question is the visitor’s question in their own words, without names or phone numbers.',
    strict: true,
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'], additionalProperties: false },
  },
  {
    name: 'handoff_to_counsellor',
    description:
      'Hand the chat to a human admission counsellor. Use when the visitor asks for a person, when you cannot answer from the knowledge base, for complaints, or anything sensitive. reason is a short summary for the counsellor.',
    strict: true,
    input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'], additionalProperties: false },
  },
];

export interface ToolContext {
  conversationId: string;
  consent: boolean;
  attribution?: Attribution;
}

export interface ToolEffects {
  needsConsent?: boolean;
  handoff?: { reason: string; name: string | null; phone: string | null };
  outcome?: 'lead_saved' | 'visit_booked' | 'bsat_registered' | 'handoff';
  links?: { label: string; href: string }[];
  /** a question the knowledge base could not answer (personal data stripped) */
  unanswered?: string;
}

type Result = { content: string; isError?: boolean; effects?: ToolEffects };

const ok = (data: unknown, effects?: ToolEffects): Result => ({ content: JSON.stringify(data), effects });
const err = (message: string, effects?: ToolEffects): Result => ({ content: JSON.stringify({ error: message }), isError: true, effects });

const CONSENT_REQUIRED = () =>
  err('consent_required: The visitor must agree before we save their details. Ask them to tap the "I agree" button that is now shown below the chat. Do not save anything until they do.', { needsConsent: true });

const phone = z.string().transform((v, c) => normalizeIndianMobile(v) ?? (c.addIssue({ code: 'custom', message: 'invalid' }), z.NEVER));
const name = z.string().trim().min(2).max(80);
const program = z.enum(PROGRAM_SLUGS).nullable();

async function linkConversation(ctx: ToolContext, leadId: string, contactName: string, contactPhone: string) {
  await getConversationStore().update(ctx.conversationId, { leadId, contactName, contactPhone });
}

/** Lead scoring from the conversation (brief §5.2): booking a visit ⇒ hot, an enquiry ⇒ at least warm. Never downgrades. */
async function score(leadId: string, to: 'hot' | 'warm') {
  const repo = getCrmRepo();
  const lead = await repo.getLead(leadId);
  if (!lead || lead.category === 'hot' || lead.category === 'invalid' || (to === 'warm' && lead.category === 'warm')) return;
  await repo.updateLead(leadId, { category: to }, [{ action: 'qualified', field: 'category', oldValue: lead.category, newValue: to, reason: 'AI assistant: conversation intent' }]);
}

export async function runTool(nameOf: string, input: unknown, ctx: ToolContext): Promise<Result> {
  try {
    switch (nameOf) {
      case 'calculate_fee': {
        const { fees, bsat } = await getContent();
        const i = z.object({ program: z.enum(PROGRAM_SLUGS), stay: z.enum(['day', 'day-transport', 'hostel-nonac', 'hostel-ac']), bsat_score: z.number().min(0).max(100).nullable(), ssc_10_gpa: z.boolean(), instalments: z.union([z.literal(1), z.literal(3), z.literal(10)]) }).parse(input);
        const p = getProgram(i.program)!;
        const r = calculateFee({ track: p.track, stay: i.stay, bsatScore: i.bsat_score, ssc10Gpa: i.ssc_10_gpa, instalments: i.instalments }, fees, bsat);
        return ok(
          { program: p.name, lines: r.lines.map((l) => `${l.label}: ${formatINR(l.amount)}`), scholarship_percent: r.scholarshipPct, year_1_total: formatINR(r.yearOne), year_2_total: r.yearTwo === null ? null : formatINR(r.yearTwo), per_instalment: `${r.instalments} × ${formatINR(r.perInstalment)}`, note: 'Estimate from the published (sample) fee table; final fee is in the admission letter.' },
          { links: [{ label: 'Fee calculator', href: '/fees#calculator' }] },
        );
      }
      case 'get_visit_slots': {
        const { date } = z.object({ date: z.string() }).parse(input);
        const { visitSlots } = await getContent();
        const invalid = validateVisit(date, visitSlots.slots[0].slot, visitSlots);
        if (invalid && !/slot/.test(invalid)) return err(invalid);
        const booked = await getStore().slotBookings(date);
        return ok({ date: formatDate(date), slots: slotsFor(date, visitSlots).map((s) => ({ slot: s.slot, label: s.label, places_left: Math.max(0, s.capacity - (booked[s.slot] ?? 0)) })) });
      }
      case 'save_enquiry': {
        if (!ctx.consent) return CONSENT_REQUIRED();
        const i = z.object({ name, phone, program, note: z.string().max(500).nullable() }).parse(input);
        const { leadId } = await getStore().captureLead({ name: i.name, phone: i.phone, program: i.program ?? undefined, note: i.note ?? undefined, source: 'chat', consent: true, attribution: ctx.attribution });
        await linkConversation(ctx, leadId, i.name, i.phone);
        await score(leadId, 'warm');
        const lead = await getCrmRepo().getLead(leadId);
        const owner = lead?.ownerId ? (await getCrmRepo().getStaff(lead.ownerId))?.fullName.split(' ')[0] : null;
        return ok({ saved: true, counsellor: owner ?? 'our admissions team', callback: 'during office hours' }, { outcome: 'lead_saved' });
      }
      case 'book_visit': {
        if (!ctx.consent) return CONSENT_REQUIRED();
        const i = z.object({ name, phone, date: z.string(), slot: z.string(), program, family_size: z.number().int().min(1).max(8) }).parse(input);
        const { visitSlots } = await getContent();
        const invalid = validateVisit(i.date, i.slot, visitSlots);
        if (invalid) return err(invalid);
        const { visitId } = await getStore().createVisit({ name: i.name, phone: i.phone, date: i.date, slot: i.slot, familySize: i.family_size, program: i.program ?? undefined, consent: true, attribution: ctx.attribution });
        const lead = await getStore().captureLead({ name: i.name, phone: i.phone, source: 'chat', consent: true, attribution: ctx.attribution });
        await linkConversation(ctx, lead.leadId, i.name, i.phone);
        await score(lead.leadId, 'hot');
        const when = `${formatDate(i.date)}, ${visitSlots.slots.find((s) => s.slot === i.slot)?.label ?? i.slot}`;
        await visitConfirmation(visitId, i.name, i.phone, when).catch(() => undefined);
        return ok({ booked: true, when, confirmation: 'WhatsApp confirmation sent; reminders 1 day and 2 hours before.' }, { outcome: 'visit_booked' });
      }
      case 'register_bsat': {
        if (!ctx.consent) return CONSENT_REQUIRED();
        const i = z.object({ student_name: name, phone, stream: z.enum(['MPC', 'BiPC']), session_id: z.string() }).parse(input);
        const { bsat } = await getContent();
        const session = bsat.sessions.find((s) => s.id === i.session_id);
        if (!session || session.date < todayIST()) return err('That test date has passed or does not exist. Offer an upcoming session.');
        const r = await getStore().registerBsat({ name: i.student_name, studentName: i.student_name, phone: i.phone, stream: i.stream, sessionId: i.session_id, consent: true, attribution: ctx.attribution });
        const lead = await getStore().captureLead({ name: i.student_name, phone: i.phone, source: 'chat', consent: true });
        await linkConversation(ctx, lead.leadId, i.student_name, i.phone);
        await score(lead.leadId, 'warm');
        if (!r.alreadyRegistered) await bsatRegistered(i.student_name, i.phone, formatDate(session.date), session.mode, r.hallTicket).catch(() => undefined);
        return ok({ hall_ticket: r.hallTicket, already_registered: r.alreadyRegistered, date: formatDate(session.date), mode: session.mode }, { outcome: 'bsat_registered' });
      }
      case 'check_application':
        return ok(
          { private: true, how: 'Admission status is shown only after a one-time code is sent to the registered mobile. Ask the visitor to open the Track admission page.', page: '/track' },
          { links: [{ label: 'Track admission', href: '/track' }] },
        );
      case 'note_unanswered': {
        const { question } = z.object({ question: z.string().max(300) }).parse(input);
        // Strip anything that looks like a phone number or ID before storing.
        return ok({ noted: true }, { unanswered: question.replace(/\+?\d[\d\s-]{4,}\d/g, '•••').trim() });
      }
      case 'handoff_to_counsellor': {
        const { reason } = z.object({ reason: z.string().max(300) }).parse(input);
        const conv = await getConversationStore().get(ctx.conversationId);
        return ok({ handed_off: true, next: 'Tell the visitor a counsellor will join; the chat window will ask for their name and number if needed.' }, { handoff: { reason, name: conv?.contactName ?? null, phone: conv?.contactPhone ?? null }, outcome: 'handoff' });
      }
      default:
        return err(`Unknown tool ${nameOf}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return err(`Invalid input: ${e.issues.map((i) => i.path.join('.')).join(', ')}. Ask the visitor for the missing or invalid detail.`);
    if (e instanceof StoreError) return err(e.code === 'slot_full' ? 'That slot just filled up. Offer another slot.' : 'Not available. Offer another option.');
    console.error('[assistant] tool failed', nameOf, (e as Error).message);
    return err('Something went wrong on our side. Offer to connect the visitor to a counsellor.');
  }
}
