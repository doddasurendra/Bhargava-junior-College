import { createHash } from 'node:crypto';

/**
 * Text normalisation, fingerprints and similarity for the question uniqueness engine (§6), plus the safety
 * filters the community and scanner use (§20). Pure functions; unit tested in openbook.test.ts.
 */

const STOP = new Set('a an the of to in on at for and or is are was were be been by with as from that this which what find calculate determine if then than its it into per its their his her they we you your will would shall can could should does do did has have had when where how why whose whom given following correct option options statement statements'.split(' '));

/** Lower-case, unify symbols and spacing, drop option labels and punctuation, keep numbers and letters (any script). */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\(text|mathrm|mathbf)\{([^}]*)\}/g, '$2')
    .replace(/[×✕]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/(^|\s)\(?[a-d]\)\s/g, ' ')
    .replace(/\.(?!\d)|(?<!\d)\./g, ' ')
    .replace(/[^\p{L}\p{N}.*+\-/=^%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const fingerprint = (s: string) => createHash('sha256').update(normalize(s)).digest('hex');

/** Content words (no stop words), with numbers kept: changing the numbers makes a different problem. */
export function tokens(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t && !STOP.has(t));
}

function trigrams(s: string): Set<string> {
  const t = ` ${normalize(s).replace(/\s+/g, ' ')} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
const bag = (ts: string[]) => { const m = new Map<string, number>(); for (const t of ts) m.set(t, (m.get(t) ?? 0) + 1); return m; };

/**
 * Lexical similarity 0–1: the larger of word-bag cosine and character-trigram Jaccard. Catches reworded
 * copies that keep the same terms and numbers. It does not understand paraphrase with different words; the
 * pgvector embedding check does that when an embeddings key is configured.
 */
export function lexicalSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  const c = cosine(bag(ta), bag(tb));
  const ga = trigrams(a), gb = trigrams(b);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const j = ga.size + gb.size - inter ? inter / (ga.size + gb.size - inter) : 0;
  return Math.max(c, j);
}

export function cosineVec(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// ---------------------------------------------------------------- safety filters (community, minors)

const PHONE = /(?:\+?\d[\s-]?){10,}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|in|net|org|io|me|ly|gg|co)\b/i;
const HANDLE = /(?:^|\s)@[a-z0-9_.]{3,}|\b(?:insta(?:gram)?|snap(?:chat)?|whats ?app|telegram|wa\.me)\b/i;
/** A short list of common English, Hindi and Telugu abuse words (transliterated); admins can extend it. */
const ABUSE = /\b(?:fuck\w*|shit\w*|bitch\w*|bastard|asshole|dick\w*|slut|whore|idiot|stupid|moron|loser|dumbass|chutiya\w*|madarchod|behenchod|bhosdi\w*|gandu|randi|harami|kamina|lanja\w*|dengey|pichi ?nakodaka|pooku|bewakoof|nalayak)\b/i;

export type BlockReason = 'phone' | 'email' | 'link' | 'handle' | 'abuse';
/** Personal contact details and abuse are blocked before a post is saved (§20). */
export function blockedContent(s: string): BlockReason | null {
  if (PHONE.test(s.replace(/\b(19|20)\d{2}\b/g, ''))) return 'phone';
  if (EMAIL.test(s)) return 'email';
  if (LINK.test(s)) return 'link';
  if (HANDLE.test(s)) return 'handle';
  if (ABUSE.test(s)) return 'abuse';
  return null;
}
export const BLOCK_MESSAGE: Record<BlockReason, string> = {
  phone: 'Phone numbers are not allowed. Keep personal details private.',
  email: 'Email addresses are not allowed. Keep personal details private.',
  link: 'Links are not allowed in the community.',
  handle: 'Social media handles are not allowed. Keep personal details private.',
  abuse: 'Please keep it respectful. That language is not allowed.',
};

/** Splits a paper's text into numbered questions ("1.", "Q1", "1)", "Q.1"), with options (a)–(d) kept inside. */
export function splitQuestions(text: string): { qno: string; text: string }[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: { qno: string; text: string }[] = [];
  let cur: { qno: string; text: string } | null = null;
  const start = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):]\s+(.*)$/i;
  for (const line of lines) {
    const m = line.match(start);
    const n = m ? Number(m[1]) : NaN;
    // a new question when the number follows the previous one (avoids "1. " inside a solution or a list)
    if (m && (!cur || n === Number(cur.qno) + 1 || (out.length === 0 && n <= 3))) {
      if (cur) out.push(cur);
      cur = { qno: m[1], text: m[2] };
    } else if (cur) cur.text += '\n' + line;
  }
  if (cur) out.push(cur);
  return out.map((q) => ({ ...q, text: q.text.trim() })).filter((q) => q.text.length >= 12);
}

/** Pulls "(a) … (b) … (c) … (d) …" options out of a question's text. */
export function parseOptions(t: string): { stem: string; options: string[] } {
  const m = t.split(/\n?\s*\(?([a-dA-D1-4])\)\s+/);
  if (m.length >= 9) {
    const stem = m[0].trim();
    const options: string[] = [];
    for (let i = 1; i + 1 < m.length && options.length < 4; i += 2) options.push(m[i + 1].trim().replace(/\s+/g, ' '));
    if (options.length === 4 && options.every(Boolean)) return { stem, options };
  }
  return { stem: t.trim(), options: [] };
}
