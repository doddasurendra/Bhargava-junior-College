/**
 * WhatsApp message templates — the single source of truth. Each must be created with exactly this name,
 * category, language and body in Meta Business Manager (WhatsApp Manager → Message templates) and approved
 * before it can be sent. The CRM page /crm/whatsapp lists them for whoever submits them.
 * Body placeholders are {{1}}, {{2}}… in order.
 */
export type TemplateCategory = 'utility' | 'marketing' | 'authentication';

export interface TemplateDef {
  key: string;
  /** Meta template name */
  name: string;
  category: TemplateCategory;
  language: string;
  description: string;
  body: string;
  params: string[];
  header?: 'document';
  /** Can staff send it by hand from the CRM? (otherwise only the system sends it) */
  manual: boolean;
  /** Allowed in bulk sends */
  bulk?: boolean;
}

export const TEMPLATES = [
  {
    key: 'enquiry_ack',
    name: 'bjc_enquiry_ack',
    category: 'utility',
    language: 'en',
    description: 'Sent when a family enquires on the website.',
    body: 'Hello {{1}}, thank you for contacting Bhargava Junior College. Our admissions team will call you during office hours. For anything urgent, call {{2}}.',
    params: ['Name', 'College phone'],
    manual: false,
  },
  {
    key: 'visit_confirmation',
    name: 'bjc_visit_confirmation',
    category: 'utility',
    language: 'en',
    description: 'Sent when a campus visit is booked (website, chat or CRM).',
    body: 'Hello {{1}}, your campus visit to Bhargava Junior College is confirmed for {{2}}. Address: {{3}}. Directions: {{4}}. Reply here if you need to change the time.',
    params: ['Name', 'Date and time', 'Address', 'Map link'],
    manual: true,
  },
  {
    key: 'visit_reminder',
    name: 'bjc_visit_reminder',
    category: 'utility',
    language: 'en',
    description: 'Sent automatically 1 day and 2 hours before a campus visit.',
    body: 'Reminder: your campus visit to Bhargava Junior College is {{1}} at {{2}}. Directions: {{3}}. Reply here if you can no longer come.',
    params: ['"tomorrow" or "today"', 'Time', 'Map link'],
    manual: false,
  },
  {
    key: 'bsat_registration',
    name: 'bjc_bsat_registration',
    category: 'utility',
    language: 'en',
    description: 'Sent when a student registers for BSAT.',
    body: 'Hello {{1}}, you are registered for BSAT on {{2}} ({{3}}). Your hall ticket number is {{4}}. Results are announced within 48 hours of the test.',
    params: ['Student name', 'Date', 'Campus / online', 'Hall ticket number'],
    manual: false,
  },
  {
    key: 'brochure',
    name: 'bjc_brochure',
    category: 'marketing',
    language: 'en',
    description: 'Program brochure as a PDF. Needs a brochure URL for the program (content/sample.ts → brochures).',
    body: 'Hello {{1}}, here is the {{2}} brochure from Bhargava Junior College, with fees, hostel and scholarship details. Reply here or call {{3}} with any questions.',
    params: ['Name', 'Program', 'College phone'],
    header: 'document',
    manual: true,
    bulk: true,
  },
  {
    key: 'college_intro',
    name: 'bjc_college_intro',
    category: 'marketing',
    language: 'en',
    description: 'Introduction after a first call, or to imported school data that has opted in.',
    body: 'Hello {{1}}, greetings from Bhargava Junior College, Saroornagar. We offer IIT-JEE and NEET UG integrated with the TS Intermediate Board, in batches of up to 40 students. See fees and book a campus visit: {{2}}',
    params: ['Name', 'Website link'],
    manual: true,
    bulk: true,
  },
  {
    key: 'location',
    name: 'bjc_location',
    category: 'utility',
    language: 'en',
    description: 'The campus address and map link.',
    body: 'Bhargava Junior College is at {{1}}. Directions: {{2}}. Office hours: {{3}}.',
    params: ['Address', 'Map link', 'Office hours'],
    manual: true,
  },
  {
    key: 'daily_report',
    name: 'bjc_daily_report',
    category: 'utility',
    language: 'en',
    description: 'The 7 PM admissions report, sent to management.',
    body: 'Bhargava admissions, {{1}}: {{2}} new leads, {{3}} visits held, {{4}} admissions confirmed today. {{5}} follow-ups overdue 48h+, {{6}} visits without an outcome. Full report: {{7}}',
    params: ['Date', 'New leads', 'Visits held', 'Confirmed', 'Overdue 48h+', 'Visits without outcome', 'Report link'],
    manual: false,
  },
  {
    key: 'hostel_movement',
    name: 'bjc_hostel_movement',
    category: 'utility',
    language: 'en',
    description: 'Sent to every guardian on each biometric hostel check-in and check-out.',
    body: '{{1}} {{2}} the Bhargava hostel at {{3}}. For any concern, call the warden.',
    params: ['Student first name', '"checked in to" or "checked out of"', 'Date and time'],
    manual: false,
  },
  {
    key: 'app_welcome',
    name: 'bjc_app_welcome',
    category: 'utility',
    language: 'en',
    description: 'Sent to a guardian when they get app access (College ID issued, or a guardian added).',
    body: 'Welcome to Bhargava Junior College. {{1}} has College ID {{2}}. Open the parent app at {{3}} and sign in with this mobile number.',
    params: ['Student name', 'College ID', 'App link'],
    manual: false,
  },
  {
    key: 'otp',
    name: 'bjc_otp',
    category: 'authentication',
    language: 'en',
    description: 'One-time code for "Track your admission". Create as an Authentication template with a copy-code button.',
    body: '{{1}} is your verification code. For your security, do not share this code.',
    params: ['Code'],
    manual: false,
  },
  {
    key: 'absence_alert',
    name: 'bjc_absence_alert',
    category: 'utility',
    language: 'en',
    description: 'Sent to every guardian when a student is marked absent (§9 parent login: daily attendance).',
    body: '{{1}} was marked absent on {{2}} ({{3}}). If this is unexpected, please call the college office at {{4}}.',
    params: ['Student first name', 'Date', 'Batch', 'College phone'],
    manual: false,
  },
  {
    key: 'weekly_report',
    name: 'bjc_weekly_report',
    category: 'utility',
    language: 'en',
    description: 'Sunday parent report (§6.9): attendance, test trend and the mentor’s note.',
    body: 'Weekly report for {{1}} ({{2}}). Attendance: {{3}}. Tests: {{4}}. Mentor’s note: {{5}} Full details are in the parent app.',
    params: ['Student first name', 'Week', 'Attendance', 'Tests', 'Mentor note'],
    manual: false,
  },
  {
    key: 'fee_reminder',
    name: 'bjc_fee_reminder',
    category: 'utility',
    language: 'en',
    description: 'Instalment due reminder from Accounts.',
    body: 'Dear parent, the fee instalment of {{1}} for {{2}} is due on {{3}}. You can pay in the parent app or at the college office. Ignore this if already paid.',
    params: ['Amount', 'Student name', 'Due date'],
    manual: false,
  },
  {
    key: 'outpass_request',
    name: 'bjc_outpass_request',
    category: 'utility',
    language: 'en',
    description: 'Asks the parent to approve a hostel out-pass in the app.',
    body: '{{1}} has requested a hostel out-pass from {{2}} to {{3}} ({{4}}). Please approve or decline it in the parent app.',
    params: ['Student first name', 'From', 'To', 'Reason'],
    manual: false,
  },
  {
    key: 'notice',
    name: 'bjc_notice',
    category: 'utility',
    language: 'en',
    description: 'A new circular or notice from the college.',
    body: 'New notice from Bhargava Junior College: {{1}}. Read it in the app: {{2}}',
    params: ['Title', 'Link'],
    manual: false,
  },
  {
    key: 'test_result',
    name: 'bjc_test_result',
    category: 'utility',
    language: 'en',
    description: 'A test result has been published.',
    body: '{{1}}’s result for {{2}} is out: {{3}}. See the subject and chapter analysis in the app.',
    params: ['Student first name', 'Test', 'Score'],
    manual: false,
  },
] as const satisfies readonly TemplateDef[];

export type TemplateKey = (typeof TEMPLATES)[number]['key'];

export function getTemplate(key: string): TemplateDef | undefined {
  return (TEMPLATES as readonly TemplateDef[]).find((t) => t.key === key);
}

export function renderBody(def: TemplateDef, params: string[]): string {
  return def.body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? `{{${n}}}`);
}

/** Template params must be non-empty single-line text (Meta rejects newlines/tabs and >4 consecutive spaces). */
export function validateParams(def: TemplateDef, params: string[]): string | null {
  if (params.length !== def.params.length) return `${def.name} needs ${def.params.length} values, got ${params.length}.`;
  for (const [i, p] of params.entries()) {
    if (!p || !p.trim()) return `${def.params[i]} is empty.`;
    if (/[\n\t]| {5,}/.test(p)) return `${def.params[i]} must be a single line.`;
    if (p.length > 1024) return `${def.params[i]} is too long.`;
  }
  return null;
}
