-- Manager-approved reversal of a wrong verification sign-off (requester ≠ approver, enforced in the app).

create table public.verification_reversals (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id),
  stage          public.admission_stage not null check (stage in ('application', 'documents', 'fee', 'receipt', 'student_record')),
  reason         text not null check (length(trim(reason)) >= 5),
  requested_by   uuid not null references public.profiles (id),
  requested_at   timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by     uuid references public.profiles (id),
  decided_at     timestamptz,
  decision_note  text,
  check (decided_by is null or decided_by <> requested_by)
);
create unique index verification_reversals_one_pending on public.verification_reversals (lead_id, stage) where status = 'pending';

alter table public.verification_reversals enable row level security;
create policy verification_reversals_read on public.verification_reversals for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));

create or replace function public.decide_reversal(p_id uuid, p_approve boolean, p_actor uuid, p_note text)
returns admission_stage[]
language plpgsql security definer set search_path = public as $$
declare
  r         verification_reversals%rowtype;
  v_clear   admission_stage[];
  v_student students%rowtype;
  s         admission_stage;
begin
  select * into r from verification_reversals where id = p_id for update;
  if not found then raise exception 'reversal_not_found'; end if;
  if r.status <> 'pending' then raise exception 'reversal_decided'; end if;
  if r.requested_by = p_actor then raise exception 'reversal_self_approval'; end if;

  if p_approve then
    perform 1 from leads where id = r.lead_id for update;
    if exists (select 1 from admission_stage_events where lead_id = r.lead_id and stage = 'college_id') then raise exception 'reversal_after_college_id'; end if;
    if not exists (select 1 from admission_stage_events where lead_id = r.lead_id and stage = r.stage) then raise exception 'reversal_not_signed'; end if;

    v_clear := array[r.stage];
    if r.stage = 'application' and exists (select 1 from admission_stage_events where lead_id = r.lead_id and stage = 'student_record') then v_clear := v_clear || 'student_record'::admission_stage; end if;
    if r.stage = 'fee' and exists (select 1 from admission_stage_events where lead_id = r.lead_id and stage = 'receipt') then v_clear := v_clear || 'receipt'::admission_stage; end if;

    delete from admission_stage_events where lead_id = r.lead_id and stage = any (v_clear);
    if 'student_record' = any (v_clear) then
      select * into v_student from students where lead_id = r.lead_id;
      if found then
        insert into lead_audit (lead_id, actor_id, action, field, old_value, reason)
        values (r.lead_id, p_actor, 'student_record_removed', 'student', to_jsonb(v_student)::text, r.reason);
        delete from students where id = v_student.id;
      end if;
    end if;
    update leads set stage = coalesce((select max(stage) from admission_stage_events where lead_id = r.lead_id and stage > 'counselling'), 'counselling')
     where id = r.lead_id;
    foreach s in array v_clear loop
      insert into lead_audit (lead_id, actor_id, action, field, old_value, reason) values (r.lead_id, p_actor, 'sign_off_reversed', 'stage', s::text, r.reason);
    end loop;
  end if;

  update verification_reversals set status = case when p_approve then 'approved' else 'rejected' end, decided_by = p_actor, decided_at = now(), decision_note = p_note where id = p_id;
  insert into lead_audit (lead_id, actor_id, action, field, new_value, reason)
  values (r.lead_id, p_actor, case when p_approve then 'reversal_approved' else 'reversal_rejected' end, 'stage', r.stage::text, p_note);
  return coalesce(v_clear, '{}');
end $$;

revoke all on function public.decide_reversal(uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_reversal(uuid, boolean, uuid, text) to service_role;
