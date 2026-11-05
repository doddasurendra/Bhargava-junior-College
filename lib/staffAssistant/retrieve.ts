/**
 * Keyword retrieval over unstructured text (notices/circulars, mentor notes, counselling notes) for the staff
 * assistant. BM25-style ranking: rare terms count more, repeated terms saturate, long documents are damped.
 * Pure and deterministic. A pgvector embedding search can replace this once an embeddings provider is set up.
 */
export interface Doc {
  id: string;
  source: 'notice' | 'mentor_note' | 'counselling' | 'kb';
  title: string;
  text: string;
  date: string | null;
  href: string | null;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'about', 'are', 'was', 'were', 'this', 'that', 'from', 'has', 'have', 'not', 'but', 'all', 'any', 'can', 'his', 'her', 'their', 'our', 'you', 'your', 'who', 'what', 'when', 'how']);
/** Light stemming: plural "s" (fees → fee, notes → note) and -ing/-ed on longer words (missing → miss). */
const stem = (w: string) => (w.length > 5 && /(ing|ed)$/.test(w) ? w.replace(/(ing|ed)$/, '') : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export const terms = (s: string) => (s.toLowerCase().normalize('NFKD').match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

export function search(docs: Doc[], query: string, limit = 10) {
  const q = [...new Set(terms(query))];
  if (!q.length || !docs.length) return [];
  const toks = docs.map((d) => terms(`${d.title} ${d.title} ${d.text}`));
  const avg = toks.reduce((t, x) => t + x.length, 0) / toks.length || 1;
  const df = new Map(q.map((t) => [t, toks.filter((x) => x.includes(t)).length]));
  const k1 = 1.2;
  const b = 0.75;
  return docs
    .map((d, i) => {
      const len = toks[i].length;
      let score = 0;
      for (const t of q) {
        const tf = toks[i].filter((x) => x === t).length;
        if (!tf) continue;
        const idf = Math.log(1 + (docs.length - df.get(t)! + 0.5) / (df.get(t)! + 0.5));
        score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * len) / avg)));
      }
      return { doc: d, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b2) => b2.score - a.score || (b2.doc.date ?? '').localeCompare(a.doc.date ?? ''))
    .slice(0, limit)
    .map((r) => ({ ...r.doc, snippet: snippet(r.doc.text, q), score: Math.round(r.score * 100) / 100 }));
}

/** ~200 characters around the first matching term. */
export function snippet(text: string, q: string[]) {
  const lower = text.toLowerCase();
  const at = q.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 200).replace(/\s+/g, ' ').trim()}${start + 200 < text.length ? '…' : ''}`;
}
