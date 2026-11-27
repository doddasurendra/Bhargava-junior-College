/**
 * Staff CRM translation (English → Telugu / Hindi).
 *
 * The CRM's English text is the key. Dictionaries live in ./dict/*.ts as [english, telugu, hindi] rows.
 * A row's English may contain `{x}` (any text, e.g. a name or a count). It is carried into the
 * translation at the same marker. Lookups are exact first, then with numbers and `{x}` patterns,
 * then piecewise on " · " and "Label: value". Identifiers, database values and API names are never keys,
 * so they are never translated.
 */
export type CrmLang = 'te' | 'hi';
export interface CompiledDict { exact: Map<string, string>; patterns: { re: RegExp; out: string }[] }
export type Row = readonly [en: string, te: string, hi: string];

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds lookup tables for one language from the shared rows. */
export function compile(rows: readonly Row[], lang: CrmLang): CompiledDict {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; out: string }[] = [];
  const col = lang === 'te' ? 1 : 2;
  for (const r of rows) {
    const en = norm(r[0]), out = r[col];
    if (!out) continue;
    if (en.includes('{x}')) {
      const parts = en.split('{x}').map(esc);
      patterns.push({ re: new RegExp(`^${parts.join('(.+?)')}$`), out });
    } else exact.set(en, out);
  }
  // longer (more specific) patterns first
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, patterns };
}

/** Plain arrays for sending to the browser. */
export const serialise = (d: CompiledDict) => ({ exact: Object.fromEntries(d.exact), patterns: d.patterns.map((p) => [p.re.source, p.out] as const) });
export const deserialise = (j: { exact: Record<string, string>; patterns: (readonly [string, string])[] }): CompiledDict => ({ exact: new Map(Object.entries(j.exact)), patterns: j.patterns.map(([s, out]) => ({ re: new RegExp(s), out })) });

const fill = (out: string, caps: string[], d: CompiledDict, depth: number) => {
  let i = 0;
  return out.replace(/\{x\}/g, () => { const c = caps[i++] ?? ''; return translate(d, c, depth + 1) ?? c; });
};

/** Translation of one visible string, or null when the dictionary has none. */
export function translate(d: CompiledDict, input: string, depth = 0): string | null {
  const s = norm(input);
  if (!s || depth > 3) return null;
  if (!/[A-Za-z]/.test(s)) return null;
  const hit = d.exact.get(s);
  if (hit !== undefined) return hit;
  for (const p of d.patterns) {
    const m = p.re.exec(s);
    if (m) return fill(p.out, m.slice(1), d, depth);
  }
  // numbers inside a known phrase: "Waiting for approval (3)" via the row "Waiting for approval ({x})"
  // pieces: "Physics · Approved · 12 pages"
  if (s.includes(' · ')) {
    const parts = s.split(' · ');
    const tr = parts.map((p) => translate(d, p, depth + 1));
    if (tr.some((t) => t !== null)) return parts.map((p, i) => tr[i] ?? p).join(' · ');
  }
  // "Label: value" and "Label — value"
  const m = /^([^:—]{2,60})(:|—| -) (.+)$/.exec(s);
  if (m) {
    const a = translate(d, m[1], depth + 1), b = translate(d, m[3], depth + 1);
    if (a !== null || b !== null) return `${a ?? m[1]}${m[2]} ${b ?? m[3]}`;
  }
  // leading separators: "· overdue", "— top level", "→ next"
  const lead = /^([·—–→←•|]\s*)(.+)$/.exec(s);
  if (lead) { const x = translate(d, lead[2], depth + 1); if (x !== null) return lead[1] + x; }
  // trailing punctuation / ellipsis variants: "Saving…", "Search:"
  const t = /^(.*?)([.…:!?]+)$/.exec(s);
  if (t && t[1] && t[1] !== s) { const x = translate(d, t[1], depth + 1); if (x !== null) return x + t[2]; }
  return null;
}
