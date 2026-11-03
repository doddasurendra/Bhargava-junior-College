-- Families with more than one child. Leads still de-duplicate by mobile (brief §4.4) into the family's
-- PRIMARY lead; each sibling is its own lead (own owner, visit, decision, verification, College ID)
-- linked by sibling_of, sharing the parent phone.

alter table public.leads add column sibling_of uuid references public.leads (id);
create index leads_sibling_of_idx on public.leads (sibling_of) where sibling_of is not null;

drop index public.leads_phone_active_uidx;
create unique index leads_phone_primary_uidx on public.leads (phone) where merged_into is null and sibling_of is null;

-- Same as before; the conflict target now names the primary-lead index.
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
    p ->> 'phone', p ->> 'name', nullif(p ->> 'student_name', ''), nullif(p ->> 'student_class', ''), nullif(p ->> 'program', ''),
    p ->> 'source', p ->> 'source', v_consent, case when v_consent then now() end
  )
  on conflict (phone) where merged_into is null and sibling_of is null do update set
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
  insert into lead_audit (lead_id, action, new_value) values (v_id, case when v_new then 'created' else 'touchpoint' end, p ->> 'source');
  return query select v_id, v_new;
end $$;

-- Same as before, except imports only ever merge into a primary lead.
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
     where l.merged_into is null and l.sibling_of is null
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
    values (v_id, p_source, nullif(r ->> 'program', ''), concat_ws(' · ', nullif(r ->> 'note', ''), 'import ' || p_file || ' line ' || (r ->> 'line')));
  end loop;

  update import_batches b set created = b.created + v_c, merged = b.merged + v_m where b.id = p_batch;
  return query select v_c, v_m;
end $$;

/* A sibling's lead under the family's root lead: same phone, owner and consent; its own admission journey. */
create or replace function public.create_sibling(p_lead uuid, p_actor uuid, p jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_root leads%rowtype;
  v_id   uuid;
begin
  select * into v_root from leads where id = (select coalesce(sibling_of, id) from leads where id = p_lead) for update;
  if not found then raise exception 'lead_not_found'; end if;
  insert into leads (phone, contact_name, parent_name, student_name, class_level, school, area, program, first_source, last_source,
                     consent, consent_at, owner_id, assigned_at, sibling_of)
  values (v_root.phone, v_root.contact_name, v_root.parent_name, p ->> 'student_name', nullif(p ->> 'class_level', ''),
          nullif(p ->> 'school', ''), v_root.area, nullif(p ->> 'program', ''), 'sibling', 'sibling',
          v_root.consent, v_root.consent_at, v_root.owner_id, case when v_root.owner_id is not null then now() end, v_root.id)
  returning id into v_id;
  insert into lead_audit (lead_id, actor_id, action, new_value, reason) values (v_id, p_actor, 'created', 'sibling', 'Sibling of ' || coalesce(v_root.student_name, v_root.contact_name, ''));
  insert into lead_audit (lead_id, actor_id, action, field, new_value) values (v_root.id, p_actor, 'sibling_added', 'family', p ->> 'student_name');
  return v_id;
end $$;

revoke all on function public.capture_lead(jsonb), public.import_leads(uuid, uuid, text, text, jsonb), public.create_sibling(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.capture_lead(jsonb), public.import_leads(uuid, uuid, text, text, jsonb), public.create_sibling(uuid, uuid, jsonb) to service_role;
