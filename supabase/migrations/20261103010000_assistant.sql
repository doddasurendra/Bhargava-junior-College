-- AI admission assistant: website chat sessions live in conversations (status 'bot') before any handoff.
alter table public.conversations add column consent_at timestamptz;

-- Assistant analytics (brief §5.2): one row per assistant turn. No message text or personal data,
-- except unanswered questions with numbers stripped.
create table public.assistant_turns (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  mode             text not null check (mode in ('ai', 'fallback')),
  tools            text[] not null default '{}',
  outcome          text,              -- e.g. lead_saved, visit_booked, bsat_registered, handoff, refusal, unanswered
  input_tokens     int,
  output_tokens    int,
  cache_read_tokens int,
  question         text,              -- unanswered question (phone numbers stripped), for the knowledge-base backlog
  created_at       timestamptz not null default now()
);
create index assistant_turns_created_idx on public.assistant_turns (created_at desc);
alter table public.assistant_turns enable row level security;  -- service role only
