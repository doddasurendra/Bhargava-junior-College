/**
 * Safety protocol (pure, unit tested). Detects possible serious distress or self-harm in free text, in
 * English, Telugu and Hindi (script and common romanised forms). It errs on the side of alerting a human:
 * a false alarm costs the counsellor a check-in; a miss could cost much more. It never diagnoses or counsels.
 */
const PATTERNS: RegExp[] = [
  // English
  /\b(kill|hurt|harm|cut)(ing|s)?\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bself[-\s]?harm/i,
  /\b(end|take)\s+my\s+(own\s+)?life\b/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\b(better\s+off|better)\s+dead\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living)\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\bend\s+it\s+all\b/i,
  // Hindi (Devanagari + romanised)
  /आत्महत्या/,
  /मर\s*(ना|जाना)\s*चाह/,
  /जीना\s*नहीं\s*चाह/,
  /खुद\s*को\s*(मार|नुकसान|चोट)/,
  /\b(marna|mar\s+jana)\s+chah(ta|ti)\b/i,
  /\bjeena\s+nahi\b/i,
  /\bkhud\s*ko\s*(maar|nuksan)/i,
  // Telugu (script + romanised)
  /ఆత్మహత్య/,
  /చచ్చిపో(వాల|తా|వాలని)/,
  /చనిపో(వాల|తా|వాలని)/,
  /బతకాలని\s*లేదు/,
  /\b(chachipovalani|chanipovalani|chachipotha|chanipotha)\b/i,
  /\bbathakalani\s+ledu\b/i,
];

export function detectDistress(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.normalize('NFC');
  return PATTERNS.some((p) => p.test(t));
}

export interface Helpline {
  name: string;
  number: string;
  hours: string | null;
  note: string | null;
}

/** Defaults until an admin edits the list. TODO(college): verify every number before launch. */
export const DEFAULT_HELPLINES: Helpline[] = [
  { name: 'Tele-MANAS (Govt. of India mental-health helpline)', number: '14416', hours: '24×7, free', note: 'Also 1-800-891-4416. Telugu, Hindi, English and more.' },
  { name: 'Emergency', number: '112', hours: '24×7', note: 'If someone is in immediate danger.' },
];

/** The calm message shown to the person who wrote the text. Not counselling: it points to people who can help. */
export function safetyMessage(counsellor: { name: string; phone: string | null } | null, lines: Helpline[]): string {
  const who = counsellor ? `${counsellor.name}${counsellor.phone ? ` (${counsellor.phone})` : ''}` : 'the college counsellor';
  const list = lines.map((h) => `${h.name}: ${h.number}${h.hours ? ` (${h.hours})` : ''}`).join('\n');
  return `Thank you for telling us. You don't have to handle this alone, and you matter to us.\n\nOur counsellor ${who} has been asked to reach you soon. If you feel unsafe right now, please talk to someone near you and call:\n${list}`;
}
