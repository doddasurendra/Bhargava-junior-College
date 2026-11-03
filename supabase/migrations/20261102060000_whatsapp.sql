-- WhatsApp Business Cloud API: outbox with delivery status, inbound messages, opt-outs.

create table public.wa_messages (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid references public.leads (id),
  to_phone             text not null,
  template             text not null,
  body                 text not null,           -- rendered text as sent; OTP codes are redacted
  status               text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  provider_message_id  text unique,
  error                text,
  dedupe_key           text unique,              -- e.g. visit:<id>:day_before — makes cron/webhook retries harmless
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index wa_messages_lead_idx on public.wa_messages (lead_id, created_at desc);

create table public.wa_inbound (
  id                   uuid primary key default gen_random_uuid(),
  provider_message_id  text not null unique,
  from_phone           text not null,
  lead_id              uuid references public.leads (id),
  type                 text not null,
  text                 text,
  received_at          timestamptz not null
);
create index wa_inbound_lead_idx on public.wa_inbound (lead_id, received_at desc);
create index wa_inbound_from_idx on public.wa_inbound (from_phone, received_at desc);

create table public.wa_opt_outs (
  phone   text primary key,
  source  text not null,
  at      timestamptz not null default now()
);

alter table public.wa_messages enable row level security;
alter table public.wa_inbound enable row level security;
alter table public.wa_opt_outs enable row level security;  -- service role only

create policy wa_messages_read on public.wa_messages for select to authenticated using (lead_id is not null and exists (select 1 from public.leads l where l.id = lead_id));
create policy wa_inbound_read on public.wa_inbound for select to authenticated using (lead_id is not null and exists (select 1 from public.leads l where l.id = lead_id));

/* Delivery statuses arrive out of order; only move forward. 'failed' is final. */
create or replace function public.wa_apply_status(p_provider_id text, p_status text, p_error text)
returns void
language sql security definer set search_path = public as $$
  update wa_messages
     set status = p_status, error = coalesce(p_error, error), updated_at = now()
   where provider_message_id = p_provider_id
     and status <> 'failed'
     and (case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 end)
       > (case status when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 4 end);
$$;

revoke all on function public.wa_apply_status(text, text, text) from public, anon, authenticated;
grant execute on function public.wa_apply_status(text, text, text) to service_role;
