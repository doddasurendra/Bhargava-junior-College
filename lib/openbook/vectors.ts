import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cosineVec } from './text';

/**
 * Semantic duplicate check (§6.5) with pgvector. Needs VOYAGE_API_KEY (voyage-multilingual-2, 1024 dims).
 * Vectors live in public.ob_question_vectors (RLS on, service role only) and are searched with the
 * ob_match_questions() function (cosine distance, HNSW index). Locally (no Supabase) vectors are kept in
 * memory. Without the key this check is reported as "not configured" and only the lexical check runs.
 */
export const VECTOR_MODEL = 'voyage-multilingual-2';
export const vectorsConfigured = () => !!process.env.VOYAGE_API_KEY;
const sb = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null);
const mem = new Map<string, { scope: string; conceptKey: string; v: number[] }>();

export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!vectorsConfigured() || !texts.length) return null;
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts.map((t) => t.slice(0, 8000)), model: VECTOR_MODEL, input_type: 'document' }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { data: { embedding: number[] }[] };
  return j.data.map((d) => d.embedding);
}

export async function storeVector(questionId: string, conceptKey: string, scope: string, v: number[]) {
  const c = sb();
  if (c) await c.from('ob_question_vectors').upsert({ question_id: questionId, concept_key: conceptKey, scope, embedding: v });
  else mem.set(questionId, { scope, conceptKey, v });
}

/** Nearest stored questions for the concept within the given scopes (student's own + shared bank + papers). */
export async function nearest(v: number[], conceptKey: string, scopes: string[], k = 5): Promise<{ questionId: string; score: number }[]> {
  const c = sb();
  if (c) {
    const { data, error } = await c.rpc('ob_match_questions', { query: v, concept: conceptKey, scopes, k });
    if (error) throw new Error(`pgvector search failed: ${error.message}`);
    return (data as { question_id: string; similarity: number }[]).map((d) => ({ questionId: d.question_id, score: d.similarity }));
  }
  return [...mem.entries()]
    .filter(([, x]) => x.conceptKey === conceptKey && (scopes.includes(x.scope) || x.scope.startsWith('p:') && scopes.includes('papers')))
    .map(([id, x]) => ({ questionId: id, score: cosineVec(v, x.v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
