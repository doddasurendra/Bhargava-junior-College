-- Chat handoff inbox (brief §5.2, §7.6): website chat and WhatsApp conversations handed to staff.

create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  channel             text not null check (channel in ('whatsapp', 'web')),
  contact_phone       text,
  contact_name        text,
  lead_id             uuid references public.leads (id),
  status              text not null check (status in ('bot', 'waiting', 'assigned', 'closed')),
  assignee_id         uuid references public.profiles (id),
  handoff_reason      text,
  handoff_at          timestamptz,
  last_message_at     timestamptz not null default now(),
  last_inbound_at     timestamptz,
  unread              int not null default 0,
  visitor_token_hash  text,
  created_at          timestamptz not null default now(),
  closed_at           timestamptz,
  close_note          text,
  check (status <> 'assigned' or assignee_id is not null)
);
create index conversations_queue_idx on public.conversations (status, last_message_at desc);
create index conversations_assignee_idx on public.conversations (assignee_id, last_message_at desc) where status <> 'closed';
create unique index conversations_open_whatsapp on public.conversations (contact_phone) where channel = 'whatsapp' and status <> 'closed';

create table public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  author           text not null check (author in ('contact', 'bot', 'staff', 'system', 'note')),  -- note = staff-only
  staff_id         uuid references public.profiles (id),
  text             text not null check (length(text) <= 4000),
  wa_message_id    uuid references public.wa_messages (id),
  created_at       timestamptz not null default now()
);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
-- Read access for staff who can see the linked lead, or the assignee. The website server uses the service role.
create policy conversations_read on public.conversations for select to authenticated
  using (assignee_id = auth.uid() or public.can_see_all_leads() or (lead_id is not null and exists (select 1 from public.leads l where l.id = lead_id)));
create policy conversation_messages_read on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));

create or replace function public.add_conversation_message(p_conversation uuid, p_author text, p_staff uuid, p_text text, p_wa_message uuid, p_at timestamptz)
returns public.conversation_messages
language plpgsql security definer set search_path = public as $$
declare
  v_row conversation_messages;
  v_at  timestamptz := coalesce(p_at, now());
begin
  insert into conversation_messages (conversation_id, author, staff_id, text, wa_message_id, created_at)
  values (p_conversation, p_author, p_staff, p_text, p_wa_message, v_at)
  returning * into v_row;
  update conversations set
    last_message_at = greatest(last_message_at, v_at),
    last_inbound_at = case when p_author = 'contact' then greatest(coalesce(last_inbound_at, v_at), v_at) else last_inbound_at end,
    unread          = unread + case when p_author = 'contact' then 1 else 0 end
  where id = p_conversation;
  return v_row;
end $$;

revoke all on function public.add_conversation_message(uuid, text, uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.add_conversation_message(uuid, text, uuid, text, uuid, timestamptz) to service_role;
