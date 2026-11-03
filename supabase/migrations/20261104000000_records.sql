-- Document store for CMS content, settings, academics, mentoring, hostel, transport, PTM and messages
-- (see lib/records). Two indexed keys per record cover the lookups the screens need.

create table public.records (
  collection  text not null,
  id          text not null default gen_random_uuid()::text,
  k1          text,
  k2          text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);
create index records_k1_idx on public.records (collection, k1);
create index records_k2_idx on public.records (collection, k2);
create index records_created_idx on public.records (collection, created_at desc);

alter table public.records enable row level security;  -- service role only (server)
