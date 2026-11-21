-- Knowledge Hub (lib/kb). Articles, files, versions, audit, AI conversations, gaps, queue, rules and logs live
-- in the existing public.records table (RLS on, no policies: service role only — the browser can never read
-- them; every read goes through the server's access-level + sensitivity check, including the AI's retrieval).
-- This migration adds what records can't hold: pgvector embeddings, the private file bucket, and a health
-- function for the Supabase Integration Centre (/crm/knowledge/supabase).

create extension if not exists vector with schema extensions;

-- Embeddings (voyage-multilingual-2, 1024 dims) keyed by a hash of the chunk text, so re-indexing is free
-- for unchanged chunks. Optional: used only when VOYAGE_API_KEY is configured.
create table if not exists public.kb_embeddings (
  hash        text primary key,
  model       text not null,
  embedding   extensions.vector(1024) not null,
  created_at  timestamptz not null default now()
);
alter table public.kb_embeddings enable row level security;  -- service role only (no policies)

-- Private bucket for Knowledge Hub documents: 50 MB per file, document and image types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kb-files', 'kb-files', false, 52428800, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain', 'text/markdown',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Health report: every public table with its RLS flag and row estimate, applied migrations, extensions,
-- pg_cron jobs (when pg_cron is installed) and the embeddings count. Read-only.
create or replace function public.kb_health()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb;
  migs jsonb := '[]'::jsonb;
  jobs jsonb := null;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(jsonb_agg(version order by version), ''[]''::jsonb) from supabase_migrations.schema_migrations' into migs;
  end if;
  if to_regclass('cron.job') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''jobname'', jobname, ''schedule'', schedule, ''active'', active)), ''[]''::jsonb) from cron.job' into jobs;
  end if;
  select jsonb_build_object(
    'tables', (select coalesce(jsonb_agg(jsonb_build_object('name', c.relname, 'rls', c.relrowsecurity, 'rows', greatest(c.reltuples, 0)::bigint) order by c.relname), '[]'::jsonb)
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r'),
    'migrations', migs,
    'extensions', (select coalesce(jsonb_agg(extname order by extname), '[]'::jsonb) from pg_extension),
    'cron', jobs,
    'kb_embeddings', (select count(*) from public.kb_embeddings)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.kb_health() from public, anon, authenticated;
grant execute on function public.kb_health() to service_role;
