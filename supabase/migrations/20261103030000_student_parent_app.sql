-- Student & Parent app: guardians with app access, the student's own login phone, hostel movements.

alter table public.students add column login_phone text check (login_phone is null or login_phone ~ '^\+91[6-9][0-9]{9}$');
create index students_login_phone_idx on public.students (login_phone) where login_phone is not null;

-- Several guardians per student, several children per guardian (acceptance criteria).
create table public.student_guardians (
  student_id  uuid not null references public.students (id) on delete cascade,
  phone       text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  name        text not null,
  relation    text not null check (relation in ('father', 'mother', 'guardian', 'other')),
  added_by    uuid references public.profiles (id),
  added_at    timestamptz not null default now(),
  primary key (student_id, phone)
);
create index student_guardians_phone_idx on public.student_guardians (phone);

-- Biometric hostel entry/exit (brief §3.4): every event alerts the guardians on WhatsApp.
create table public.hostel_events (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  direction        text not null check (direction in ('in', 'out')),
  at               timestamptz not null,
  device           text not null,
  device_event_id  text not null,
  alerted          int not null default 0,
  created_at       timestamptz not null default now(),
  unique (device, device_event_id)
);
create index hostel_events_student_idx on public.hostel_events (student_id, at desc);

alter table public.student_guardians enable row level security;
alter table public.hostel_events enable row level security;
create policy student_guardians_read on public.student_guardians for select to authenticated
  using (exists (select 1 from public.students s join public.leads l on l.id = s.lead_id where s.id = student_id));
create policy hostel_events_read on public.hostel_events for select to authenticated
  using (public.has_any_role(array['super_admin', 'management', 'principal', 'admin_office', 'hostel_warden']));

create or replace function public.create_student(p_lead uuid, p_actor uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into students (lead_id, full_name, dob, gender, program, stay, guardian_name, guardian_phone, login_phone, created_by)
  values (p_lead, p ->> 'full_name', (p ->> 'dob')::date, p ->> 'gender', p ->> 'program', p ->> 'stay', p ->> 'guardian_name', p ->> 'guardian_phone', nullif(p ->> 'login_phone', ''), p_actor);
  perform sign_off_stage(p_lead, 'student_record', p_actor, null);
exception when unique_violation then
  raise exception 'student_exists';
end $$;

/* Unchanged gate; additionally grants the primary guardian app access in the same transaction (brief §7.4). */
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
  insert into student_guardians (student_id, phone, name, relation, added_by)
  values (v_student.id, v_student.guardian_phone, v_student.guardian_name, 'guardian', p_actor)
  on conflict do nothing;
  perform sign_off_stage(p_lead, 'college_id', p_actor, v_id);
  insert into lead_audit (lead_id, actor_id, action, field, new_value) values (p_lead, p_actor, 'admitted', 'college_id', v_id);
  return v_id;
end $$;

revoke all on function public.create_student(uuid, uuid, jsonb), public.issue_college_id(uuid, uuid, text, int, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_student(uuid, uuid, jsonb), public.issue_college_id(uuid, uuid, text, int, jsonb, int) to service_role;
