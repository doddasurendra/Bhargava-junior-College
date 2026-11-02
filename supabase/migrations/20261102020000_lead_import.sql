-- Bulk lead import (brief §7.1 step 1): import batches + atomic insert-or-merge per chunk.

create table public.import_batches (
  id                  uuid primary key default gen_random_uuid(),
  file_name           text not null,
  source              text not null,
  actor_id            uuid not null references public.profiles (id),
  total_rows          int not null,
  invalid             int not null default 0,
  duplicates_in_file  int not null default 0,
  created             int not null default 0,
  merged              int not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.leads add column import_batch_id uuid references public.import_batches (id);
create index leads_student_phone_idx on public.leads (student_phone) where merged_into is null and student_phone is not null;

alter table public.import_batches enable row level security;
create policy import_batches_read on public.import_batches for select to authenticated
  using (public.has_any_role(array['super_admin', 'management', 'admission_manager', 'data_executive']));

/*
  p_rows: [{ line, phone, student_phone, student_name, parent_name, school, class_level, board, area, program, note }]
  Phones are already normalised (+91XXXXXXXXXX) and de-duplicated within the file by the server.
  Existing leads are matched on phone or student phone; merges fill blanks only.
*/
create or replace function public.import_leads(p_batch uuid, p_actor uuid, p_source text, p_file text, p_rows jsonb)
returns table (created int, merged int)
language plpgsql security definer set search_path = public as $$
declare
  r       jsonb;
  v_id    uuid;
  v_c     int := 0;
  v_m     int := 0;
  v_sp    text;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    v_sp := nullif(r ->> 'student_phone', '');
    select l.id into v_id
      from leads l
     where l.merged_into is null
       and (l.phone = r ->> 'phone' or l.student_phone = r ->> 'phone'
            or (v_sp is not null and (l.phone = v_sp or l.student_phone = v_sp)))
     limit 1
     for update;

    if v_id is null then
      insert into leads (phone, contact_name, parent_name, student_name, student_phone, school, class_level, board, area, program,
                         first_source, last_source, consent, import_batch_id)
      values (r ->> 'phone',
              coalesce(nullif(r ->> 'parent_name', ''), nullif(r ->> 'student_name', '')),
              nullif(r ->> 'parent_name', ''), nullif(r ->> 'student_name', ''), v_sp,
              nullif(r ->> 'school', ''), nullif(r ->> 'class_level', ''), nullif(r ->> 'board', ''), nullif(r ->> 'area', ''),
              nullif(r ->> 'program', ''), p_source, p_source, false, p_batch)
      returning id into v_id;
      v_c := v_c + 1;
      insert into lead_audit (lead_id, actor_id, action, new_value, reason) values (v_id, p_actor, 'created', p_source, 'import ' || p_file);
    else
      update leads set
        contact_name  = coalesce(contact_name, nullif(r ->> 'parent_name', ''), nullif(r ->> 'student_name', '')),
        parent_name   = coalesce(parent_name, nullif(r ->> 'parent_name', '')),
        student_name  = coalesce(student_name, nullif(r ->> 'student_name', '')),
        student_phone = coalesce(student_phone, case when v_sp is distinct from phone then v_sp end),
        school        = coalesce(school, nullif(r ->> 'school', '')),
        class_level   = coalesce(class_level, nullif(r ->> 'class_level', '')),
        board         = coalesce(board, nullif(r ->> 'board', '')),
        area          = coalesce(area, nullif(r ->> 'area', '')),
        program       = coalesce(program, nullif(r ->> 'program', '')),
        last_source   = p_source
      where id = v_id;
      v_m := v_m + 1;
      insert into lead_audit (lead_id, actor_id, action, new_value, reason)
      values (v_id, p_actor, 'merged_import', p_source, 'import ' || p_file || ', line ' || (r ->> 'line'));
    end if;

    insert into lead_touchpoints (lead_id, source, program, note)
    values (v_id, p_source, nullif(r ->> 'program', ''),
            concat_ws(' · ', nullif(r ->> 'note', ''), 'import ' || p_file || ' line ' || (r ->> 'line')));
  end loop;

  update import_batches b set created = b.created + v_c, merged = b.merged + v_m where b.id = p_batch;
  return query select v_c, v_m;
end $$;

revoke all on function public.import_leads(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_leads(uuid, uuid, text, text, jsonb) to service_role;
