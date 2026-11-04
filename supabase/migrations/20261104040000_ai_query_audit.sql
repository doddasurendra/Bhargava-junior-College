-- Staff college assistant (§8.2): every question asked — who, what, when, which students it returned.
-- Written only by the website server (service role); read by Super Admin, Management and Principal.
create table if not exists public.ai_query_audit (
  id            bigint generated always as identity primary key,
  actor_id      text not null,
  role          text not null,
  query         text not null check (length(query) between 1 and 500),
  intent        text not null,
  result_count  int not null default 0 check (result_count >= 0),
  student_ids   text[] not null default '{}',
  at            timestamptz not null default now()
);
create index if not exists ai_query_audit_at_idx on public.ai_query_audit (at desc);
create index if not exists ai_query_audit_actor_idx on public.ai_query_audit (actor_id, at desc);

alter table public.ai_query_audit enable row level security;
drop policy if exists ai_query_audit_read on public.ai_query_audit;
create policy ai_query_audit_read on public.ai_query_audit for select to authenticated
  using (public.has_any_role(array['super_admin', 'management', 'principal']));
revoke insert, update, delete on public.ai_query_audit from anon, authenticated;
