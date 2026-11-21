import 'server-only';
import { getContent } from '../cms';
import type { Lang } from '../i18n';
import { buildCorpus, detectLang, rewriteQuery } from '../rag';
import { getRecordStore } from '../records';
import { canRead, type Level, type Sensitivity, type Viewer } from './access';
import { kbArticles, kbFiles, kbFileText, kbSearches } from './collections';
import { liveFileVersion } from './files';
import { liveView, syncStamp } from './service';
import { bm25, chunkText, highlight, prepare, snippet, type Prepared } from './text';
import { embedQuery, embeddingsConfigured, vectorScores } from './embed';

/**
 * ONE index for everything (§1.5, §17): live KB articles, live documents (page by page) and the website
 * content the public chatbot already answers from. Rebuilt when the sync stamp changes (every publish,
 * archive or replace) or the CMS content changes — so a published item is searchable on this server at
 * once and on others within the 15 s content cache (well inside the 1 minute target).
 *
 * Retrieval = BM25 keyword (Unicode, so Telugu and Hindi text is searchable) with Telugu/Hindi → English
 * query expansion, plus cosine similarity over embeddings when an embeddings provider is configured
 * (hybrid). Chunks the viewer may not see are filtered out BEFORE scoring — nothing restricted can reach
 * a result list or the LLM.
 */
export interface Chunk {
  id: string;
  sourceKind: 'article' | 'file' | 'website';
  sourceId: string;
  title: string;
  section: string | null;
  page: number | null;
  pageLabel: string;
  text: string;
  lang: Lang;
  access: Level;
  sensitivity: Sensitivity;
  ownerId: string | null;
  centre: string;
  topic: string | null;
  channels: string[];
  sample: boolean;
  updatedAt: string;
  reviewBy: string | null;
  websiteUrl?: string;
}

interface Built {
  key: string;
  chunks: Chunk[];
  prep: Prepared;
  builtAt: string;
  ms: number;
}
let cache: Built | null = null;
let contentRef: unknown = null;

export async function buildIndex(force = false): Promise<Built> {
  const [stamp, content] = await Promise.all([syncStamp(), getContent()]);
  const key = `${stamp.stamp ?? '0'}`;
  if (!force && cache && cache.key === key && contentRef === content) return cache;
  const t0 = Date.now();
  const st = getRecordStore();
  const chunks: Chunk[] = [];

  for (const r of await kbArticles.list(st)) {
    const a = await liveView(r);
    if (!a) continue;
    for (const lang of ['en', 'te', 'hi'] as const) {
      const body = lang === 'en' ? a.body.en : a.body[lang];
      if (!body?.trim()) continue;
      const title = (lang === 'en' ? a.title.en : a.title[lang]) || a.title.en;
      chunkText(body).forEach((c, i) => chunks.push({ id: `a:${r.id}:${lang}:${i}`, sourceKind: 'article', sourceId: r.id, title, section: c.section, page: null, pageLabel: 'section', text: c.text, lang, access: a.access, sensitivity: a.sensitivity, ownerId: a.ownerId, centre: a.centre, topic: a.topic, channels: a.channels, sample: a.sample, updatedAt: r.updatedAt, reviewBy: a.reviewBy }));
    }
  }

  for (const r of await kbFiles.list(st)) {
    const ver = liveFileVersion(r.data);
    if (ver === null) continue;
    const txt = (await kbFileText.get(st, `${r.id}:${ver}`))?.data;
    if (!txt) continue;
    txt.pages.forEach((p, pi) => {
      if (!p.trim()) return;
      chunkText(p, 1100).forEach((c, ci) => chunks.push({ id: `f:${r.id}:${pi}:${ci}`, sourceKind: 'file', sourceId: r.id, title: r.data.title.en, section: c.section, page: pi + 1, pageLabel: txt.pageLabel, text: c.text, lang: detectLang(c.text), access: r.data.access, sensitivity: r.data.sensitivity, ownerId: r.data.ownerId, centre: r.data.centre, topic: r.data.topic, channels: r.data.channels, sample: r.data.sample, updatedAt: r.updatedAt, reviewBy: r.data.reviewBy }));
    });
  }

  // the website's own verified content (CMS blocks, FAQs, public CMS articles): public, read-only here
  for (const c of buildCorpus(content)) {
    chunks.push({ id: `w:${c.id}`, sourceKind: 'website', sourceId: c.id, title: c.title, section: c.section, page: null, pageLabel: 'section', text: c.text, lang: 'en', access: 'public', sensitivity: 'public', ownerId: null, centre: 'core', topic: 'website', channels: ['website', 'bot', 'app', 'staff'], sample: c.sample, updatedAt: '', reviewBy: null, websiteUrl: c.url });
  }

  const prep = prepare(chunks.map((c) => ({ id: c.id, title: `${c.title} ${c.section ?? ''}`, text: c.text })));
  cache = { key, chunks, prep, builtAt: new Date().toISOString(), ms: Date.now() - t0 };
  contentRef = content;
  return cache;
}

export async function indexInfo() {
  const b = await buildIndex();
  const by = (k: Chunk['sourceKind']) => b.chunks.filter((c) => c.sourceKind === k).length;
  return { chunks: b.chunks.length, articles: by('article'), files: by('file'), website: by('website'), builtAt: b.builtAt, ms: b.ms, key: b.key, vocab: b.prep.vocab.size, embeddings: embeddingsConfigured() };
}

/** Href to a source for this viewer (staff → CRM, families → app, public → website). */
export function hrefFor(v: Viewer, c: Pick<Chunk, 'sourceKind' | 'sourceId' | 'page' | 'websiteUrl' | 'channels'>) {
  if (c.sourceKind === 'website') return c.websiteUrl ?? '/';
  // bot-only items answer questions but have no public page
  if (v.kind === 'public' && !c.channels.includes('website')) return '/knowledge-base';
  const base = v.kind === 'staff' ? '/crm/knowledge' : v.kind === 'public' ? '/knowledge-base' : '/app/knowledge';
  if (c.sourceKind === 'article') return v.kind === 'staff' ? `${base}/articles/${c.sourceId}` : `${base}/a/${c.sourceId}`;
  return v.kind === 'staff' ? `${base}/documents/${c.sourceId}${c.page ? `#p${c.page}` : ''}` : `/api/kb/files/${c.sourceId}${c.page ? `#page=${c.page}` : ''}`;
}

export interface SearchFilter {
  centre?: string;
  sourceKind?: Chunk['sourceKind'];
  lang?: Lang;
  access?: Level;
  channel?: string;
  topic?: string;
}

export interface Hit extends Chunk {
  score: number;
  snippet: string;
  href: string;
}

/** Hybrid search, permission-filtered first. `perSource` collapses to the best chunk per document. */
export async function search(v: Viewer, q: string, f: SearchFilter = {}, opts: { k?: number; perSource?: boolean; log?: boolean } = {}): Promise<Hit[]> {
  const t0 = Date.now();
  const query = q.trim().slice(0, 300);
  if (!query) return [];
  const b = await buildIndex();
  const allow = (i: number) => {
    const c = b.chunks[i];
    if (!canRead(v, c)) return false;
    if (v.kind === 'public' && !c.channels.includes('website') && !c.channels.includes('bot')) return false;
    if ((v.kind === 'student' || v.kind === 'parent') && !c.channels.includes('app') && c.sourceKind !== 'website') return false;
    if (f.centre && c.centre !== f.centre) return false;
    if (f.sourceKind && c.sourceKind !== f.sourceKind) return false;
    if (f.lang && c.lang !== f.lang) return false;
    if (f.access && c.access !== f.access) return false;
    if (f.topic && c.topic !== f.topic) return false;
    if (f.channel && !c.channels.includes(f.channel)) return false;
    return true;
  };
  // the original words (any script) + English expansion of Telugu/Hindi questions + typo-fixed terms
  const expanded = `${query} ${rewriteQuery(query, b.prep.vocab)}`;
  const kw = bm25(b.prep, expanded, allow);
  const max = kw[0]?.score ?? 0;
  const scores = new Map<number, number>(kw.map((h) => [h.i, max ? h.score / max : 0]));
  if (embeddingsConfigured()) {
    const qv = await embedQuery(query);
    if (qv) for (const [i, s] of await vectorScores(b.chunks, qv, allow)) scores.set(i, (scores.get(i) ?? 0) * 0.55 + s * 0.45);
  }
  const ranked = [...scores.entries()].filter(([, s]) => s > 0.05).sort((x, y) => y[1] - x[1]);
  const out: Hit[] = [];
  const seen = new Set<string>();
  const k = opts.k ?? 20;
  for (const [i, s] of ranked) {
    const c = b.chunks[i];
    const key = opts.perSource ? `${c.sourceKind}:${c.sourceId}` : c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    // raw BM25 for the threshold the AI uses
    const raw = kw.find((h) => h.i === i)?.score ?? 0;
    out.push({ ...c, score: Math.round((raw || s * 3) * 100) / 100, snippet: highlight(snippet(c.text, expanded), query), href: hrefFor(v, c) });
    if (out.length >= k) break;
  }
  if (opts.log !== false) {
    try {
      await kbSearches.put(getRecordStore(), { q: query, viewer: v.kind === 'staff' ? v.user.roles[0] ?? 'staff' : v.kind, lang: detectLang(query), results: out.length, ms: Date.now() - t0, clicked: null, at: new Date().toISOString() });
    } catch {
      /* logging must never break search */
    }
  }
  return out;
}

/** Related items: the top hits for this item's own title, excluding itself. */
export async function related(v: Viewer, sourceId: string, title: string, k = 5) {
  return (await search(v, title, {}, { k: k + 3, perSource: true, log: false })).filter((h) => h.sourceId !== sourceId && h.sourceKind !== 'website').slice(0, k);
}
