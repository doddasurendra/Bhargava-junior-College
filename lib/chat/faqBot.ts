/**
 * Rule-based admission assistant: the fallback bot from brief §5 ("fallback rule-based bot if the LLM is
 * unavailable"). Answers ONLY from site content, never invents facts, and hands off to a counsellor when
 * it does not know. Pure; runs in the browser widget.
 */
import { college, fullAddress } from '@/content/college';
import { programs } from '@/content/programs';
import type { Content } from '../cms/blocks';

/** The live CMS facts the bot quotes (server: getContent(); browser widget: passed in from the site layout). */
export type BotFacts = Pick<Content, 'fees' | 'bsat' | 'hostel'>;
import { formatINR } from '../fees';

export interface BotReply {
  text: string;
  links?: { label: string; href: string }[];
  /** offer the "Talk to a counsellor" handoff */
  offerHandoff?: boolean;
  intent: Intent | 'unknown' | 'handoff' | 'greeting';
}

export type Intent = 'courses' | 'fees' | 'scholarship' | 'hostel' | 'visit' | 'track' | 'contact' | 'results' | 'documents' | 'rank';

export const CHIPS: { intent: Intent | 'handoff'; label: string }[] = [
  { intent: 'courses', label: 'Courses' },
  { intent: 'fees', label: 'Fees' },
  { intent: 'scholarship', label: 'Scholarship (BSAT)' },
  { intent: 'hostel', label: 'Hostel' },
  { intent: 'visit', label: 'Book campus visit' },
  { intent: 'track', label: 'Track my admission' },
  { intent: 'handoff', label: 'Talk to a counsellor' },
];

export const GREETING: BotReply = {
  intent: 'greeting',
  text: `Hello! I'm the Bhargava Admission Assistant. I can answer questions about courses, fees, BSAT scholarships, the hostel and campus visits, or connect you to a counsellor.`,
};

/** Keywords include common Telugu/Hindi words typed in English letters (fees = "fee entha", "kitna"…). */
const RULES: { intent: Intent; words: RegExp }[] = [
  { intent: 'handoff' as never, words: /\b(counsel+or|human|person|agent|call me|callback|talk to|speak to|manager|principal)\b/i },
  { intent: 'rank', words: /\b(guarantee|guaranteed|assured|promise)\b/i },
  { intent: 'fees', words: /\b(fee|fees|cost|price|charges?|amount|instal+ments?|emi|payment|entha|kitna|kitne|paisa|rupees?)\b/i },
  { intent: 'scholarship', words: /\b(bsat|scholarship|discount|concession|test date|hall ticket|exam date)\b/i },
  { intent: 'hostel', words: /\b(hostel|room|mess|food|warden|stay|accommodation|boarding|ac room)\b/i },
  { intent: 'visit', words: /\b(visit|tour|see the campus|come to campus|appointment|book)\b/i },
  { intent: 'track', words: /\b(track|status|application status|my admission|college id)\b/i },
  { intent: 'documents', words: /\b(documents?|certificates?|tc|transfer certificate|aadhaar|memo|required papers)\b/i },
  { intent: 'results', words: /\b(results?|toppers?|ranks?|air|selections?)\b/i },
  { intent: 'courses', words: /\b(course|courses|program|programme|jee|neet|iit|mpc|bipc|medical|engineering|long term|repeater|batch|syllabus|inter)\b/i },
  { intent: 'contact', words: /\b(address|location|where|map|directions|phone|contact|number|timings?|hours|open)\b/i },
];

export function detectIntent(text: string): Intent | 'handoff' | 'unknown' {
  for (const r of RULES) if (r.words.test(text)) return r.intent;
  return 'unknown';
}

export function answer(intent: Intent | 'handoff' | 'unknown', facts: BotFacts): BotReply {
  const { fees, bsat, hostel } = facts;
  switch (intent) {
    case 'courses':
      return {
        intent,
        text: `We offer ${programs.map((p) => `${p.name} (${p.duration})`).join(', ')}. The 2-year programs run alongside the TS Intermediate Board. Batches have at most ${college.maxBatchSize} students.`,
        links: [{ label: 'Compare programs', href: '/programs' }, { label: 'Course finder', href: '/course-finder' }],
      };
    case 'fees':
      return {
        intent,
        text: `Tuition is ${formatINR(fees.twoYear.tuition)} a year for the 2-year JEE/NEET programs and ${formatINR(fees.longTerm.tuition)} for Long Term, plus ${formatINR(fees.twoYear.material)} for study material and tests. Hostel is ${formatINR(fees.hostelNonAc)} (non-AC) or ${formatINR(fees.hostelAc)} (AC) including food. You can pay in ${fees.instalmentOptions.join(', ')} instalments.`,
        links: [{ label: 'Fee calculator', href: '/fees#calculator' }],
      };
    case 'scholarship':
      return {
        intent,
        text: `BSAT is a ${bsat.durationMin}-minute test for Class 10 students. Your score sets a tuition scholarship of up to ${bsat.cap}% (${bsat.slabs.map((s) => `${s.label}: ${s.pct}%`).join(', ')}), with ${bsat.gpaBonus}% extra for a 10 GPA in SSC.`,
        links: [{ label: 'Register for BSAT', href: '/scholarship#register' }],
      };
    case 'hostel':
      return {
        intent,
        text: `${hostel.blocks}, with ${hostel.rooms.join(', ').toLowerCase()}. ${hostel.safety[2]}. ${hostel.food}`,
        links: [{ label: 'Hostel details', href: '/hostel' }],
      };
    case 'visit':
      return { intent, text: 'You can book a campus visit for any day from Monday to Saturday. You will get a WhatsApp confirmation and reminders.', links: [{ label: 'Book a visit', href: '/visit' }] };
    case 'track':
      return { intent, text: 'Enter the mobile number you enquired with and we will send a one-time code to show your admission status.', links: [{ label: 'Track admission', href: '/track' }] };
    case 'documents':
      return { intent, text: 'You will need the SSC memo, transfer certificate, study certificate, Aadhaar, photographs and, if applicable, a caste/income certificate.', links: [{ label: 'Admission process', href: '/admissions' }] };
    case 'results':
      return { intent, text: 'Our results page lists JEE, NEET and Intermediate results, and each topper card links to the official scorecard once verified.', links: [{ label: 'See results', href: '/results' }] };
    case 'rank':
      return { intent, text: 'We never promise ranks or seats. What we can promise is small batches, daily practice papers, weekly tests and a mentor for every 20 students. A counsellor can explain the academic plan.', offerHandoff: true };
    case 'contact':
      return { intent, text: `We are at ${fullAddress}. Call ${college.phones.map((p) => p.display).join(' or ')}. Office hours: ${college.hoursShort}.`, links: [{ label: 'Directions', href: '/contact' }] };
    case 'handoff':
      return { intent: 'handoff', text: 'I can connect you to an admission counsellor. Please share your name and mobile number.', offerHandoff: true };
    default:
      return { intent: 'unknown', text: "I'm not sure about that one, and I don't want to guess. A counsellor can answer it for you.", offerHandoff: true };
  }
}

export function reply(text: string, facts: BotFacts): BotReply {
  return answer(detectIntent(text), facts);
}
