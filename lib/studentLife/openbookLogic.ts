/** Open-book learning: pure helpers (unit tested). */

export const RESOURCE_LABELS = { ownNotes: 'Own notes', ncert: 'NCERT textbook', formulaSheet: 'Formula sheet', calculator: 'Calculator', internet: 'Internet (reference sites only)' } as const;
/** "Own notes, NCERT textbook" — the resources an assignment allows. */
export const resourceList = (r: Record<keyof typeof RESOURCE_LABELS, boolean>) =>
  (Object.keys(RESOURCE_LABELS) as (keyof typeof RESOURCE_LABELS)[]).filter((k) => r[k]).map((k) => RESOURCE_LABELS[k]).join(', ') || 'None';

const words = (t: string) => t.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2);

/** Word-trigram Jaccard similarity, 0–1. Used to flag near-identical answers between students. */
export function similarity(a: string, b: string): number {
  const grams = (t: string) => {
    const w = words(t);
    const s = new Set<string>();
    for (let i = 0; i + 2 < w.length; i++) s.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return s;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size < 4 || B.size < 4) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SIMILARITY_FLAG = 0.6;

/** Pairs of students whose answers to the same question look copied. */
export function similarPairs(attempts: { studentId: string; answers: Record<string, string> }[]) {
  const out: { questionId: string; a: string; b: string; score: number }[] = [];
  for (let i = 0; i < attempts.length; i++)
    for (let j = i + 1; j < attempts.length; j++)
      for (const [q, text] of Object.entries(attempts[i].answers)) {
        const other = attempts[j].answers[q];
        if (!other) continue;
        const score = similarity(text, other);
        if (score >= SIMILARITY_FLAG) out.push({ questionId: q, a: attempts[i].studentId, b: attempts[j].studentId, score: Math.round(score * 100) / 100 });
      }
  return out;
}

/**
 * Rule-based marking suggestion when no AI model is configured: overlap with the model answer's key terms,
 * length and reasoning words. The teacher always confirms or changes it.
 */
export function heuristicSuggestion(answer: string, modelAnswer: string, rubric: { criterion: string; max: number }[]) {
  const key = new Set(words(modelAnswer));
  const got = words(answer);
  const overlap = key.size ? got.filter((w) => key.has(w)).length / key.size : 0;
  const reasoning = /\b(because|so|therefore|since|hence|which means|this shows)\b/i.test(answer) ? 1 : 0;
  const length = Math.min(1, got.length / Math.max(20, words(modelAnswer).length * 0.6));
  const scores: Record<string, number> = {};
  for (const r of rubric) {
    const c = r.criterion.toLowerCase();
    const f = c.includes('explain') ? (reasoning * 0.6 + length * 0.4) : c.includes('resource') ? (got.length > 5 ? 1 : 0) : c.includes('method') ? Math.min(1, overlap * 1.4) * 0.7 + reasoning * 0.3 : Math.min(1, overlap * 1.5);
    scores[r.criterion] = Math.round(Math.max(0, Math.min(1, f)) * r.max);
  }
  return scores;
}

/**
 * "Knows the formula but can't apply it" vs "understands but forgets": compare closed-book and open-book %.
 * Thresholds are deliberately simple so a teacher can explain them to a parent.
 */
export function learningProfile(closedPct: number | null, openPct: number | null): { key: 'apply_gap' | 'recall_gap' | 'balanced' | 'needs_support' | 'not_enough_data'; label: string } {
  if (closedPct === null || openPct === null) return { key: 'not_enough_data', label: 'Not enough data yet' };
  if (openPct < 50 && closedPct < 50) return { key: 'needs_support', label: 'Needs support in both: revisit the concepts' };
  if (openPct - closedPct >= 15) return { key: 'recall_gap', label: 'Understands but forgets: more recall practice' };
  if (closedPct - openPct >= 10) return { key: 'apply_gap', label: 'Knows the formula but can’t apply it: more application questions' };
  return { key: 'balanced', label: 'Balanced: understands and remembers' };
}

/** Deterministic per-student question set from the assignment's pool (randomised but stable on reload). */
export function pickFor(pool: string[], n: number, seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
