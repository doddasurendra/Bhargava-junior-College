/**
 * Turns a staff question into one of a fixed set of safe, parameterised lookups (§8.2 "tool calls").
 * Pure and deterministic, so it is tested and never hands a free-form query to the database.
 */
export type Intent =
  | { kind: 'lookup'; q: string }
  | { kind: 'attendance'; below: number; batch: string | null }
  | { kind: 'dues' }
  | { kind: 'compare'; who: string; count: number }
  | { kind: 'leads'; category: 'hot' | 'warm' | 'cold'; notCalledToday: boolean }
  | { kind: 'notes'; q: string };

const COLLEGE_ID = /\bBJC-\d{4}-[A-Z]{2,5}-\d{3,5}\b/i;

export function parseQuery(raw: string): Intent {
  const q = raw.trim().replace(/\s+/g, ' ');
  const lower = q.toLowerCase();

  const id = q.match(COLLEGE_ID);
  if (id && !/\b(compare|last \d+ tests?)\b/i.test(q)) return { kind: 'lookup', q: id[0].toUpperCase() };

  // "notes about fees", "search circulars on PTM", "mentor notes for stress", "policy on mobile phones"
  const notes = q.match(/^(?:search|find|show)?\s*(?:mentor\s+|counsell?or\s+|counselling\s+)?(?:notes?|circulars?|notices?|polic(?:y|ies))\s+(?:about|on|for|regarding|mentioning)\s+(.+)$/i);
  if (notes) return { kind: 'notes', q: notes[1].trim() };

  const leads = lower.match(/\b(hot|warm|cold)\s+leads?\b/);
  if (leads) return { kind: 'leads', category: leads[1] as 'hot' | 'warm' | 'cold', notCalledToday: /not (been )?called today|no call today|uncalled/.test(lower) };

  if (/\b(defaulters?|overdue fees?|fee dues|fees? (overdue|pending|due)|pending fees?)\b/.test(lower)) return { kind: 'dues' };

  const att = lower.match(/(?:below|under|less than|<)\s*(\d{1,3})\s*%?\s*(?:attendance)?/);
  if (att && /attendance/.test(lower)) {
    const below = Math.min(100, Math.max(1, parseInt(att[1], 10)));
    const batch = q.match(/\bin\s+(.+?)\s*$/i)?.[1]?.replace(/\bbatch\b/i, '').replace(/\s+/g, ' ').trim() || null;
    return { kind: 'attendance', below, batch: batch && !/attendance/i.test(batch) ? batch : null };
  }

  const cmp = q.match(/compare\s+(.+?)(?:'s|’s)?\s+last\s+(\d{1,2})\s+tests?/i) ?? q.match(/compare\s+(.+?)(?:'s|’s)?\s+tests?/i);
  if (cmp) return { kind: 'compare', who: cmp[1].trim(), count: cmp[2] ? Math.min(20, Math.max(1, parseInt(cmp[2], 10))) : 3 };

  return { kind: 'lookup', q };
}
