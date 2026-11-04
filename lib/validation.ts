import { z } from 'zod';
import { PROGRAM_SLUGS } from '@/content/programs';
import { normalizeIndianMobile } from './phone';

/** Every form on the site maps to one of these lead sources (brief §4.4). */
export const LEAD_SOURCES = [
  'enquiry',
  'callback',
  'brochure',
  'resource',
  'mock_test',
  'bsat',
  'visit',
  'chat',
  'exit_popup',
  'course_finder',
  'fee_calculator',
  'contact',
  'application',
  'alumni_referral',
] as const;

/** Sources only staff create (not accepted from public forms). */
export const STAFF_SOURCES = ['walk_in', 'phone_in', 'referral'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const CLASS_OPTIONS = ['Class 9', 'Class 10', 'Completed Class 10', 'Intermediate / Class 12', 'Completed Class 12'] as const;

export const phoneSchema = z
  .string({ required_error: 'Please enter a mobile number' })
  .transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number' });
      return z.NEVER;
    }
    return n;
  });

const nameSchema = z.string({ required_error: 'Please enter your name' }).trim().min(2, 'Please enter your name').max(80, 'Name is too long');
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const consentSchema = z.literal(true, { errorMap: () => ({ message: 'Please agree to be contacted so we can respond' }) });

export const attributionSchema = z
  .object({
    utm_source: optText(100),
    utm_medium: optText(100),
    utm_campaign: optText(150),
    utm_term: optText(150),
    utm_content: optText(150),
    landing: optText(300),
    page: optText(300),
    referrer: optText(500),
    device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  })
  .partial()
  .optional();
export type Attribution = z.infer<typeof attributionSchema>;

export const leadRequestSchema = z.object({
  name: nameSchema,
  studentName: optText(80),
  phone: phoneSchema,
  studentClass: z.enum(CLASS_OPTIONS).optional(),
  program: z.enum(PROGRAM_SLUGS).optional(),
  source: z.enum(LEAD_SOURCES),
  note: optText(600),
  consent: consentSchema,
  attribution: attributionSchema,
});
export type LeadRequest = z.infer<typeof leadRequestSchema>;

export const visitRequestSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  program: z.enum(PROGRAM_SLUGS).optional(),
  date: z.string(),
  slot: z.string().max(10),
  familySize: z.coerce.number().int().min(1, 'At least 1 person').max(8, 'Up to 8 people per visit'),
  consent: consentSchema,
  attribution: attributionSchema,
});
export type VisitRequest = z.infer<typeof visitRequestSchema>;

export const bsatRequestSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  stream: z.enum(['MPC', 'BiPC']),
  sessionId: z.string().max(40),
  consent: consentSchema,
  attribution: attributionSchema,
});
export type BsatRequest = z.infer<typeof bsatRequestSchema>;

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const trackRequestSchema = z.object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });
