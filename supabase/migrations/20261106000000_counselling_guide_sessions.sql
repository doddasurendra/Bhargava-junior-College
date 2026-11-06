-- Parent Counselling Session Guide (10 steps): one row per counselling meeting, filled in live by the counsellor.
-- answers: JSON keyed by question id; the other columns are derived from it on every save for CRM queries.

create table if not exists public.counselling_guide_sessions (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  counsellor_id   text not null,
  language        text not null default 'te' check (language in ('te', 'en', 'hi')),
  answers         jsonb not null default '{}'::jsonb,
  worries         text[] not null default '{}' check (cardinality(worries) <= 2),
  next_step       text,
  next_step_date  date,
  interest        text check (interest in ('high', 'medium', 'low')),
  follow_up_date  date,
  outcome         text,
  self_check      jsonb not null default '[]'::jsonb,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists counselling_guide_sessions_lead_idx on public.counselling_guide_sessions (lead_id, started_at desc);
create index if not exists counselling_guide_sessions_counsellor_idx on public.counselling_guide_sessions (counsellor_id, started_at desc);

-- Service role only (the server). No policies: anon and authenticated clients can read or write nothing.
alter table public.counselling_guide_sessions enable row level security;
