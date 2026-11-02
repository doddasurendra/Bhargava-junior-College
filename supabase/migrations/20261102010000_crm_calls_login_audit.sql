-- CRM phase 1: call logs (mandatory outcome per call), staff email, login audit.

alter table public.profiles add column email text unique;

create type public.call_outcome as enum ('connected', 'not_answered', 'busy', 'switched_off', 'wrong_number');

create table public.call_logs (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references public.leads (id) on delete cascade,
  actor_id           uuid not null references public.profiles (id),
  outcome            public.call_outcome not null,
  interest           public.lead_category,
  notes              text,
  next_follow_up_at  timestamptz,
  recording_url      text,          -- filled by cloud telephony (phase 2)
  created_at         timestamptz not null default now()
);
create index call_logs_lead_idx on public.call_logs (lead_id, created_at desc);
create index call_logs_actor_idx on public.call_logs (actor_id, created_at desc);

-- Every login and failed attempt (acceptance criteria). Written by the server with the service role.
create table public.login_audit (
  id          bigint generated always as identity primary key,
  email       text not null,
  user_id     uuid references auth.users (id),
  success     boolean not null,
  at          timestamptz not null default now()
);
create index login_audit_email_idx on public.login_audit (email, at desc);

alter table public.call_logs enable row level security;
alter table public.login_audit enable row level security;  -- service role only

create policy call_logs_read on public.call_logs for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy call_logs_insert on public.call_logs for insert to authenticated
  with check (actor_id = auth.uid() and exists (select 1 from public.leads l where l.id = lead_id));
