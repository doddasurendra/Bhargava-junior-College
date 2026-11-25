-- Open Book (AI digital library & exam preparation).
-- Most Open Book data lives in the existing `records` table as typed collections (ob_*), like every other
-- school module. This migration adds only what `records` can't do well: pgvector similarity search over
-- question embeddings for the uniqueness engine (§6), with RLS on and access for the service role only.

create extension if not exists vector;

create table if not exists public.ob_question_vectors (
  question_id text primary key,
  concept_key text not null,
  scope text not null,               -- 's:<studentId>' private, 'bank' shared, 'p:<paperId>' extracted from a paper
  embedding vector(1024) not null,   -- voyage-multilingual-2
  created_at timestamptz not null default now()
);
create index if not exists ob_question_vectors_concept on public.ob_question_vectors (concept_key, scope);
create index if not exists ob_question_vectors_hnsw on public.ob_question_vectors using hnsw (embedding vector_cosine_ops);

alter table public.ob_question_vectors enable row level security;
-- no policies: anon and authenticated get nothing; the server uses the service role.
revoke all on public.ob_question_vectors from anon, authenticated;

-- Nearest questions for one concept, restricted to the given scopes ('papers' = every extracted paper).
create or replace function public.ob_match_questions(query vector(1024), concept text, scopes text[], k int default 5)
returns table (question_id text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select v.question_id, 1 - (v.embedding <=> query) as similarity
  from public.ob_question_vectors v
  where v.concept_key = concept
    and (v.scope = any(scopes) or ('papers' = any(scopes) and v.scope like 'p:%'))
  order by v.embedding <=> query
  limit greatest(1, least(k, 50));
$$;
revoke execute on function public.ob_match_questions(vector, text, text[], int) from public, anon, authenticated;
grant execute on function public.ob_match_questions(vector, text, text[], int) to service_role;
