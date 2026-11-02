-- Bhargava Junior College — shared platform schema, phase 1.
-- One database for website, chat agent, CRM, student/parent app and management dashboard.
-- Phase 1 covers: roles, staff profiles, leads (+ dedupe by phone), touchpoints with attribution,
-- audit trail, campus visits, BSAT registrations, admission stage events, OTP challenges.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles & staff
-- ---------------------------------------------------------------------------
create table public.roles (
  key       text primary key,
  label     text not null,
  is_staff  boolean not null default true
);

-- TODO: reconcile with brief §9A (18 login types) — that section was missing from the spec we received.
insert into public.roles (key, label, is_staff) values
  ('super_admin', 'Super Admin', true),
  ('management', 'Management', true),
  ('principal', 'Principal', true),
  ('admission_manager', 'Admission Manager', true),
  ('data_executive', 'Data / Marketing Executive', true),
  ('telecaller', 'Telecaller', true),
  ('admission_counsellor', 'Admission Counsellor', true),
  ('front_desk', 'Front Desk', true),
  ('admission_office', 'Admission Office', true),
  ('accounts', 'Accounts', true),
  ('admin_office', 'Admin Office', true),
  ('academic_coordinator', 'Academic Coordinator', true),
  ('class_teacher', 'Class Teacher / Mentor', true),
  ('faculty', 'Faculty', true),
  ('hostel_warden', 'Hostel Warden', true),
  ('transport_incharge', 'Transport In-charge', true),
  ('student', 'Student', false),
  ('parent', 'Parent', false),
  ('applicant', 'Applicant', false),
  ('alumni', 'Alumni', false);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.user_roles (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role     text not null references public.roles (key),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create type public.lead_category as enum ('hot', 'warm', 'cold', 'invalid');
create type public.lead_status as enum (
  'open', 'visit_scheduled', 'visited', 'counselled', 'decision_pending', 'confirmed', 'lost', 'admitted', 'invalid'
);
create type public.admission_stage as enum (
  'enquiry', 'visit', 'counselling', 'application', 'documents', 'fee', 'receipt', 'student_record', 'college_id'
);

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  phone              text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  contact_name       text,
  parent_name        text,
  student_name       text,
  student_phone      text check (student_phone is null or student_phone ~ '^\+91[6-9][0-9]{9}$'),
  school             text,
  class_level        text,
  board              text,
  area               text,
  program            text check (program in ('iit-jee', 'neet', 'long-term-jee', 'long-term-neet')),
  category           public.lead_category,           -- null until qualified (§7.1 step 2)
  status             public.lead_status not null default 'open',
  stage              public.admission_stage not null default 'enquiry', -- latest completed stage
  owner_id           uuid references public.profiles (id),
  first_source       text not null,
  last_source        text not null,
  consent            boolean not null default false,
  consent_at         timestamptz,
  next_follow_up_at  timestamptz,
  last_contact_at    timestamptz,
  lost_reason        text,
  lost_competitor    text,
  merged_into        uuid references public.leads (id),
  college_id         text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One active lead per mobile number (duplicates are merged, not deleted).
create unique index leads_phone_active_uidx on public.leads (phone) where merged_into is null;
create index leads_owner_idx on public.leads (owner_id) where merged_into is null;
create index leads_follow_up_idx on public.leads (next_follow_up_at) where merged_into is null;

-- Every form submission / chat / import row that touched a lead, with attribution.
create table public.lead_touchpoints (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  source        text not null,
  program       text,
  note          text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  landing       text,
  page          text,
  referrer      text,
  device        text,
  created_at    timestamptz not null default now()
);
create index lead_touchpoints_lead_idx on public.lead_touchpoints (lead_id, created_at desc);

-- Audit trail: who, what, when, old → new (§7.5).
create table public.lead_audit (
  id         bigint generated always as identity primary key,
  lead_id    uuid not null references public.leads (id) on delete cascade,
  actor_id   uuid references public.profiles (id),  -- null = system / public form
  action     text not null,
  field      text,
  old_value  text,
  new_value  text,
  reason     text,
  at         timestamptz not null default now()
);
create index lead_audit_lead_idx on public.lead_audit (lead_id, at desc);

-- ---------------------------------------------------------------------------
-- Campus visits
-- ---------------------------------------------------------------------------
create table public.visit_slots (
  slot      text primary key,          -- 'HH:MM'
  label     text not null,
  capacity  int not null check (capacity > 0),
  saturday  boolean not null default true,
  active    boolean not null default true
);

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id),
  visit_date    date not null,
  slot          text not null references public.visit_slots (slot),
  family_size   int not null default 1 check (family_size between 1 and 8),
  program       text,
  status        text not null default 'scheduled' check (status in ('scheduled', 'arrived', 'no_show', 'completed', 'cancelled')),
  outcome       text,
  outcome_at    timestamptz,
  outcome_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index visits_date_slot_idx on public.visits (visit_date, slot) where status in ('scheduled', 'arrived');

-- ---------------------------------------------------------------------------
-- BSAT
-- ---------------------------------------------------------------------------
create table public.bsat_sessions (
  id         text primary key,
  exam_date  date not null,
  mode       text not null check (mode in ('campus', 'online')),
  capacity   int not null default 300,
  active     boolean not null default true
);

create sequence public.bsat_hall_ticket_seq;

create table public.bsat_registrations (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null unique references public.leads (id),
  session_id   text not null references public.bsat_sessions (id),
  stream       text not null check (stream in ('MPC', 'BiPC')),
  hall_ticket  text not null unique,
  score_pct    numeric(5, 2),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Admission stage sign-offs (feeds "Track your admission" and the College ID gate)
-- ---------------------------------------------------------------------------
create table public.admission_stage_events (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id),
  stage          public.admission_stage not null,
  owner_id       uuid references public.profiles (id),
  completed_at   timestamptz not null default now(),
  signed_off_by  uuid references public.profiles (id),
  note           text,
  unique (lead_id, stage)
);

-- ---------------------------------------------------------------------------
-- OTP challenges (one active challenge per phone; code is stored hashed)
-- ---------------------------------------------------------------------------
create table public.otp_challenges (
  phone        text primary key,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Write functions (called by the website server with the service role)
-- ---------------------------------------------------------------------------
create or replace function public.capture_lead(p jsonb)
returns table (lead_id uuid, is_new boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid;
  v_new     boolean;
  v_consent boolean := coalesce((p ->> 'consent')::boolean, false);
begin
  insert into leads (phone, contact_name, student_name, class_level, program, first_source, last_source, consent, consent_at)
  values (
    p ->> 'phone',
    p ->> 'name',
    nullif(p ->> 'student_name', ''),
    nullif(p ->> 'student_class', ''),
    nullif(p ->> 'program', ''),
    p ->> 'source',
    p ->> 'source',
    v_consent,
    case when v_consent then now() end
  )
  on conflict (phone) where merged_into is null do update set
    contact_name = coalesce(leads.contact_name, excluded.contact_name),
    student_name = coalesce(leads.student_name, excluded.student_name),
    class_level  = coalesce(leads.class_level, excluded.class_level),
    program      = coalesce(excluded.program, leads.program),
    last_source  = excluded.last_source,
    consent      = leads.consent or excluded.consent,
    consent_at   = coalesce(leads.consent_at, excluded.consent_at)
  returning id, (xmax = 0) into v_id, v_new;

  insert into lead_touchpoints (lead_id, source, program, note, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing, page, referrer, device)
  values (
    v_id, p ->> 'source', nullif(p ->> 'program', ''), nullif(p ->> 'note', ''),
    p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign', p ->> 'utm_term', p ->> 'utm_content',
    p ->> 'landing', p ->> 'page', p ->> 'referrer', p ->> 'device'
  );

  insert into lead_audit (lead_id, action, new_value)
  values (v_id, case when v_new then 'created' else 'touchpoint' end, p ->> 'source');

  return query select v_id, v_new;
end $$;

create or replace function public.book_visit(p jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_date   date := (p ->> 'date')::date;
  v_slot   text := p ->> 'slot';
  v_cfg    visit_slots%rowtype;
  v_count  int;
  v_lead   uuid;
  v_id     uuid;
begin
  if extract(isodow from v_date) = 7 then raise exception 'closed_day'; end if;
  if v_date <= (now() at time zone 'Asia/Kolkata')::date then raise exception 'closed_day'; end if;

  select * into v_cfg from visit_slots where slot = v_slot and active;
  if not found or (extract(isodow from v_date) = 6 and not v_cfg.saturday) then raise exception 'invalid_slot'; end if;

  -- serialise bookings for this date+slot so capacity cannot be exceeded
  perform pg_advisory_xact_lock(hashtext((p ->> 'date') || '|' || v_slot));
  select count(*) into v_count from visits where visit_date = v_date and slot = v_slot and status in ('scheduled', 'arrived');
  if v_count >= v_cfg.capacity then raise exception 'slot_full'; end if;

  select c.lead_id into v_lead from capture_lead(p || jsonb_build_object('source', 'visit')) c;

  insert into visits (lead_id, visit_date, slot, family_size, program)
  values (v_lead, v_date, v_slot, coalesce((p ->> 'family_size')::int, 1), nullif(p ->> 'program', ''))
  returning id into v_id;

  update leads set status = 'visit_scheduled' where id = v_lead and status = 'open';
  insert into lead_audit (lead_id, action, new_value) values (v_lead, 'visit_booked', v_date::text || ' ' || v_slot);
  return v_id;
end $$;

create or replace function public.register_bsat(p jsonb)
returns table (hall_ticket text, already_registered boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_session  bsat_sessions%rowtype;
  v_lead     uuid;
  v_existing text;
  v_count    int;
  v_ticket   text;
begin
  select * into v_session from bsat_sessions where id = p ->> 'session_id' and active;
  if not found or v_session.exam_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'invalid_session'; end if;

  select c.lead_id into v_lead from capture_lead(p || jsonb_build_object('source', 'bsat')) c;

  select r.hall_ticket into v_existing from bsat_registrations r where r.lead_id = v_lead;
  if found then return query select v_existing, true; return; end if;

  perform pg_advisory_xact_lock(hashtext('bsat|' || v_session.id));
  select count(*) into v_count from bsat_registrations where session_id = v_session.id;
  if v_count >= v_session.capacity then raise exception 'session_full'; end if;

  v_ticket := 'BSAT27-' || lpad(nextval('bsat_hall_ticket_seq')::text, 5, '0');
  insert into bsat_registrations (lead_id, session_id, stream, hall_ticket) values (v_lead, v_session.id, p ->> 'stream', v_ticket);
  insert into lead_audit (lead_id, action, new_value) values (v_lead, 'bsat_registered', v_ticket);
  return query select v_ticket, false;
end $$;

revoke all on function public.capture_lead(jsonb), public.book_visit(jsonb), public.register_bsat(jsonb) from public, anon, authenticated;
grant execute on function public.capture_lead(jsonb), public.book_visit(jsonb), public.register_bsat(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. The public website writes only through the service role on the server.
-- Staff policies below are the phase-1 baseline for the CRM (telecallers see only their own leads).
-- ---------------------------------------------------------------------------
create or replace function public.has_any_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = any (roles));
$$;

create or replace function public.can_see_all_leads() returns boolean
language sql stable as $$
  select public.has_any_role(array['super_admin', 'management', 'principal', 'admission_manager', 'data_executive', 'front_desk', 'admission_office', 'accounts', 'admin_office']);
$$;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_touchpoints enable row level security;
alter table public.lead_audit enable row level security;
alter table public.visit_slots enable row level security;
alter table public.visits enable row level security;
alter table public.bsat_sessions enable row level security;
alter table public.bsat_registrations enable row level security;
alter table public.admission_stage_events enable row level security;
alter table public.otp_challenges enable row level security;  -- service role only

create policy roles_read on public.roles for select to authenticated using (true);
create policy slots_read on public.visit_slots for select using (active);
create policy sessions_read on public.bsat_sessions for select using (active);

create policy profiles_self on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_any_role(array['super_admin', 'management', 'admission_manager']));
create policy user_roles_self on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['super_admin']));

create policy leads_read on public.leads for select to authenticated
  using (public.can_see_all_leads() or owner_id = auth.uid());
create policy leads_update on public.leads for update to authenticated
  using (public.can_see_all_leads() or owner_id = auth.uid())
  with check (public.can_see_all_leads() or owner_id = auth.uid());

create policy touchpoints_read on public.lead_touchpoints for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy audit_read on public.lead_audit for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy visits_read on public.visits for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy bsat_read on public.bsat_registrations for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy stage_events_read on public.admission_stage_events for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
