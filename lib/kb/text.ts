/**
 * Language-aware text utilities for the Knowledge Hub index: Unicode tokens (so Telugu and Hindi words are
 * searchable, not just English), light English stemming, chunking with page numbers, highlighting and
 * near-duplicate detection. Pure functions, unit-tested.
 */

const STOP = new Set(['the', 'and', 'for', 'with', 'about', 'are', 'was', 'were', 'this', 'that', 'from', 'has', 'have', 'not', 'but', 'all', 'any', 'can', 'his', 'her', 'their', 'our', 'you', 'your', 'who', 'what', 'when', 'how', 'which', 'where', 'does', 'did', 'will', 'shall', 'into', 'there', 'them', 'they', 'its', 'also', 'than', 'then', 'है', 'के', 'की', 'का', 'में', 'और', 'से', 'को', 'क्या', 'हैं', 'ఏమిటి', 'ఎలా', 'మరియు']);
const stem = (w: string) => (!/^[a-z0-9]+$/.test(w) ? w : w.length > 5 && /(ing|ed)$/.test(w) ? w.replace(/(ing|ed)$/, '') : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function tokens(s: string): string[] {
  const raw = s.toLowerCase().normalize('NFC').match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return raw.filter((w) => (/^[a-z0-9]+$/.test(w) ? w.length > 2 : w.length > 1) && !STOP.has(w)).map(stem);
}

export interface IndexDoc {
  id: string;
  title: string;
  text: string;
}

/** BM25 over a prepared corpus. Prepared once per index build, reused for every query. */
export function prepare(docs: IndexDoc[]) {
  const toks = docs.map((d) => tokens(`${d.title} ${d.title} ${d.text}`));
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const avg = toks.reduce((t, x) => t + x.length, 0) / (toks.length || 1) || 1;
  const vocab = new Set(df.keys());
  return { docs, toks, df, avg, vocab };
}
export type Prepared = ReturnType<typeof prepare>;

export function bm25(p: Prepared, query: string, allow: (i: number) => boolean) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const N = p.docs.length;
  const k1 = 1.2;
  const b = 0.75;
  const out: { i: number; score: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (!allow(i)) continue; // permission filter BEFORE scoring
    const len = p.toks[i].length;
    let score = 0;
    for (const t of q) {
      let tf = 0;
      for (const w of p.toks[i]) if (w === t) tf++;
      if (!tf) continue;
      const df = p.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * len) / p.avg)));
    }
    if (score > 0) out.push({ i, score });
  }
  return out.sort((a, c) => c.score - a.score);
}

/** Chunks of ~900 characters on paragraph boundaries, keeping the nearest markdown heading as the section. */
export function chunkText(text: string, size = 900): { section: string | null; text: string }[] {
  const out: { section: string | null; text: string }[] = [];
  let section: string | null = null;
  let cur = '';
  const flush = () => {
    if (cur.trim()) out.push({ section, text: cur.trim() });
    cur = '';
  };
  for (const line of text.split(/\n/)) {
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) {
      flush();
      section = h[1].trim().slice(0, 200);
      continue;
    }
    if (cur.length + line.length > size && cur) flush();
    if (line.length > size * 1.5) {
      // a very long line (PDF text without breaks): split on sentences
      for (const s of line.split(/(?<=[.!?।])\s+/)) {
        if (cur.length + s.length > size && cur) flush();
        cur += `${s} `;
      }
      cur += '\n';
    } else cur += `${line}\n`;
  }
  flush();
  return out;
}

export function snippet(text: string, query: string, len = 220) {
  const q = tokens(query);
  const lower = text.toLowerCase();
  const at = q.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 70);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + len).replace(/\s+/g, ' ').trim()}${start + len < text.length ? '…' : ''}`;
}

/** Wrap query terms in «» markers; the page renders them as <mark>. */
export function highlight(s: string, query: string) {
  const q = [...new Set(tokens(query))].filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!q.length) return s;
  return s.replace(new RegExp(`(${q.join('|')})`, 'giu'), '«$1»');
}

/** Jaccard similarity of 3-word shingles: ≥ 0.6 counts as a near-duplicate. */
export function similarity(a: string, b: string) {
  const sh = (s: string) => {
    const t = tokens(s);
    const out = new Set<string>();
    for (let i = 0; i + 2 < t.length; i++) out.add(`${t[i]} ${t[i + 1]} ${t[i + 2]}`);
    if (!out.size && t.length) out.add(t.join(' '));
    return out;
  };
  const A = sh(a);
  const B = sh(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Normalised form of a question, for grouping repeated unanswered questions. */
export const normQuestion = (q: string) => tokens(q).sort().join(' ').slice(0, 300);

/** Line diff (LCS) for the version-compare screen. */
export function diffLines(a: string, b: string): { op: '=' | '+' | '-'; line: string }[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = x.length;
  const m = y.length;
  if (n * m > 4_000_000) return [...x.map((line) => ({ op: '-' as const, line })), ...y.map((line) => ({ op: '+' as const, line }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: '=' | '+' | '-'; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ op: '=', line: x[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', line: x[i++] });
    else out.push({ op: '+', line: y[j++] });
  }
  while (i < n) out.push({ op: '-', line: x[i++] });
  while (j < m) out.push({ op: '+', line: y[j++] });
  return out;
}
