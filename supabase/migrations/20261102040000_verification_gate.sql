-- Admission verification checkpoint (brief §7.4): documents, payments, receipts, student records,
-- numbering counters and the College ID hard gate. All state-changing steps are atomic functions
-- callable only by the service role; the website server enforces role permissions before calling them.

create table public.lead_documents (
  lead_id     uuid not null references public.leads (id) on delete cascade,
  doc_key     text not null,
  status      text not null default 'pending' check (status in ('pending', 'received', 'verified', 'not_applicable', 'rejected')),
  note        text,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  primary key (lead_id, doc_key)
  -- DigiLocker fetch (phase 2) adds: source, digilocker_uri, fetched_at
);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads (id),
  amount       int not null check (amount > 0 and amount <= 1000000),
  mode         text not null check (mode in ('upi', 'card', 'netbanking', 'bank_transfer', 'cheque', 'cash', 'gateway')),
  reference    text,
  paid_on      date not null,
  status       text not null check (status in ('pending_approval', 'approved', 'rejected')),
  recorded_by  uuid not null references public.profiles (id),
  recorded_at  timestamptz not null default now(),
  approved_by  uuid references public.profiles (id),
  approved_at  timestamptz,
  receipt_no   text unique,
  receipt_at   timestamptz
);
create index payments_lead_idx on public.payments (lead_id);

create table public.students (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null unique references public.leads (id),
  full_name       text not null,
  dob             date not null,
  gender          text not null check (gender in ('female', 'male', 'other')),
  program         text not null check (program in ('iit-jee', 'neet', 'long-term-jee', 'long-term-neet')),
  stay            text not null check (stay in ('day', 'hostel')),
  guardian_name   text not null,
  guardian_phone  text not null check (guardian_phone ~ '^\+91[6-9][0-9]{9}$'),
  college_id      text unique,
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now()
);

create table public.id_counters (
  key    text primary key,
  value  int not null
);

alter table public.lead_documents enable row level security;
alter table public.payments enable row level security;
alter table public.students enable row level security;
alter table public.id_counters enable row level security;  -- service role only

create policy lead_documents_read on public.lead_documents for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy payments_read on public.payments for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy students_read on public.students for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));

-- ---------------------------------------------------------------------------

create or replace function public.next_counter(p_key text) returns int
language sql security definer set search_path = public as $$
  insert into id_counters (key, value) values (p_key, 1)
  on conflict (key) do update set value = id_counters.value + 1
  returning value;
$$;

create or replace function public.sign_off_stage(p_lead uuid, p_stage admission_stage, p_actor uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into admission_stage_events (lead_id, stage, owner_id, signed_off_by, note)
  values (p_lead, p_stage, p_actor, p_actor, p_note);
  update leads set stage = greatest(stage, p_stage) where id = p_lead;
  insert into lead_audit (lead_id, actor_id, action, field, new_value, reason) values (p_lead, p_actor, 'signed_off', 'stage', p_stage::text, p_note);
exception when unique_violation then
  raise exception 'already_signed_off';
end $$;

create or replace function public.issue_receipts(p_lead uuid, p_actor uuid, p_counter text, p_prefix text, p_digits int)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  p       record;
  v_no    text;
  v_out   text[] := '{}';
begin
  if not exists (select 1 from admission_stage_events where lead_id = p_lead and stage = 'fee') then raise exception 'fee_not_confirmed'; end if;
  for p in select id from payments where lead_id = p_lead and status = 'approved' and receipt_no is null order by recorded_at for update loop
    v_no := p_prefix || '/' || lpad(next_counter(p_counter)::text, p_digits, '0');
    update payments set receipt_no = v_no, receipt_at = now() where id = p.id;
    v_out := v_out || v_no;
  end loop;
  if cardinality(v_out) = 0 and not exists (select 1 from payments where lead_id = p_lead and receipt_no is not null) then raise exception 'nothing_to_receipt'; end if;
  perform sign_off_stage(p_lead, 'receipt', p_actor, case when cardinality(v_out) > 0 then 'Receipts ' || array_to_string(v_out, ', ') end);
  return v_out;
end $$;

create or replace function public.create_student(p_lead uuid, p_actor uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into students (lead_id, full_name, dob, gender, program, stay, guardian_name, guardian_phone, created_by)
  values (p_lead, p ->> 'full_name', (p ->> 'dob')::date, p ->> 'gender', p ->> 'program', p ->> 'stay', p ->> 'guardian_name', p ->> 'guardian_phone', p_actor);
  perform sign_off_stage(p_lead, 'student_record', p_actor, null);
exception when unique_violation then
  raise exception 'student_exists';
end $$;

/* The hard gate: refuses unless application, documents, fee, receipt and student record are all signed off. */
create or replace function public.issue_college_id(p_lead uuid, p_actor uuid, p_template text, p_year int, p_codes jsonb, p_digits int)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_student  students%rowtype;
  v_code     text;
  v_id       text;
begin
  if (select count(*) from admission_stage_events
       where lead_id = p_lead and stage in ('application', 'documents', 'fee', 'receipt', 'student_record')) < 5 then
    raise exception 'gate_not_met';
  end if;
  select * into v_student from students where lead_id = p_lead for update;
  if not found then raise exception 'no_student'; end if;
  if v_student.college_id is not null then raise exception 'already_issued'; end if;
  v_code := p_codes ->> v_student.program;
  if v_code is null then raise exception 'no_program_code'; end if;

  v_id := replace(replace(replace(p_template, '{YEAR}', p_year::text), '{PROGRAM}', v_code), '{SEQ}',
                  lpad(next_counter('college_id:' || p_year || ':' || v_code)::text, p_digits, '0'));
  update students set college_id = v_id where id = v_student.id;
  update leads set college_id = v_id, status = 'admitted', next_follow_up_at = null where id = p_lead;
  perform sign_off_stage(p_lead, 'college_id', p_actor, v_id);
  insert into lead_audit (lead_id, actor_id, action, field, new_value) values (p_lead, p_actor, 'admitted', 'college_id', v_id);
  return v_id;
end $$;

revoke all on function public.next_counter(text), public.sign_off_stage(uuid, admission_stage, uuid, text),
  public.issue_receipts(uuid, uuid, text, text, int), public.create_student(uuid, uuid, jsonb),
  public.issue_college_id(uuid, uuid, text, int, jsonb, int) from public, anon, authenticated;
grant execute on function public.next_counter(text), public.sign_off_stage(uuid, admission_stage, uuid, text),
  public.issue_receipts(uuid, uuid, text, text, int), public.create_student(uuid, uuid, jsonb),
  public.issue_college_id(uuid, uuid, text, int, jsonb, int) to service_role;
