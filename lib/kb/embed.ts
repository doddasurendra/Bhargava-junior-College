import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Optional semantic layer (§1.5 hybrid search, §21 pgvector). Off until an embeddings provider key is set:
 * VOYAGE_API_KEY (model voyage-multilingual-2, 1024 dimensions; it covers English, Telugu and Hindi). Without
 * it, search is keyword-only and the Supabase screen says so. With Supabase connected, vectors are also
 * written to public.kb_embeddings (pgvector, RLS on, service role only) so they survive restarts.
 */
export const EMBED_MODEL = 'voyage-multilingual-2';
export const EMBED_DIM = 1024;
export const embeddingsConfigured = () => !!process.env.VOYAGE_API_KEY;

const mem = new Map<string, Float32Array>();
const hashOf = (text: string) => createHash('sha256').update(`${EMBED_MODEL}\n${text}`).digest('hex').slice(0, 32);
const sb = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null);

async function voyage(input: string[], inputType: 'query' | 'document'): Promise<Float32Array[] | null> {
  try {
    const r = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
      body: JSON.stringify({ input, model: EMBED_MODEL, input_type: inputType }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { data: { embedding: number[] }[] };
    return j.data.map((d) => Float32Array.from(d.embedding));
  } catch (e) {
    console.error('[kb] embeddings failed', (e as Error).message);
    return null;
  }
}

export async function embedQuery(q: string) {
  if (!embeddingsConfigured()) return null;
  return (await voyage([q], 'query'))?.[0] ?? null;
}

const cos = (a: Float32Array, b: Float32Array) => {
  let d = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
  }
  return d / (Math.sqrt(x * y) || 1);
};

/** Embeds any chunks not yet embedded (64 per request, at most 512 per call), then scores the allowed ones. */
export async function vectorScores(chunks: { text: string; title: string }[], qv: Float32Array, allow: (i: number) => boolean) {
  const missing: number[] = [];
  chunks.forEach((c, i) => {
    if (allow(i) && !mem.has(hashOf(`${c.title}\n${c.text}`.slice(0, 8000)))) missing.push(i);
  });
  const client = sb();
  for (let s = 0; s < Math.min(missing.length, 512); s += 64) {
    const batch = missing.slice(s, s + 64);
    const texts = batch.map((i) => `${chunks[i].title}\n${chunks[i].text}`.slice(0, 8000));
    const vecs = await voyage(texts, 'document');
    if (!vecs) break;
    vecs.forEach((v, j) => mem.set(hashOf(texts[j]), v));
    if (client) await client.from('kb_embeddings').upsert(texts.map((t, j) => ({ hash: hashOf(t), model: EMBED_MODEL, embedding: Array.from(vecs[j]) })), { onConflict: 'hash' });
  }
  const out: [number, number][] = [];
  chunks.forEach((c, i) => {
    if (!allow(i)) return;
    const v = mem.get(hashOf(`${c.title}\n${c.text}`.slice(0, 8000)));
    if (v) out.push([i, Math.max(0, cos(v, qv))]);
  });
  return out;
}

export function embeddingStats(chunks: { text: string; title: string }[]) {
  const have = chunks.filter((c) => mem.has(hashOf(`${c.title}\n${c.text}`.slice(0, 8000)))).length;
  return { model: EMBED_MODEL, dim: EMBED_DIM, configured: embeddingsConfigured(), embedded: have, missing: chunks.length - have };
}

export function clearEmbeddingCache() {
  mem.clear();
}
