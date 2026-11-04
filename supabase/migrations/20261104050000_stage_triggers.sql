-- §11 triggers, enforced in the database as well as the app:
--  1. every stage sign-off names its owner (who signed it off)
--  2. every stage change on a lead is written to the audit trail (stage history, with the lead's owner)
--  3. the College ID can never be set — even by a direct UPDATE — until all five verification steps are signed off

create or replace function public.stage_event_owner_required() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.signed_off_by is null and new.owner_id is null then
    raise exception 'owner_required' using detail = 'Every stage sign-off needs an owner.';
  end if;
  return new;
end $$;

drop trigger if exists admission_stage_events_owner on public.admission_stage_events;
create trigger admission_stage_events_owner before insert or update on public.admission_stage_events
  for each row execute function public.stage_event_owner_required();

create or replace function public.lead_stage_history() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into lead_audit (lead_id, actor_id, action, field, old_value, new_value, reason)
    values (new.id, new.owner_id, 'stage_changed', 'stage', old.stage::text, new.stage::text,
            case when new.owner_id is null then 'no lead owner at the time' end);
  end if;
  return new;
end $$;

drop trigger if exists leads_stage_history on public.leads;
create trigger leads_stage_history after update of stage on public.leads
  for each row execute function public.lead_stage_history();

create or replace function public.college_id_gate() returns trigger
language plpgsql set search_path = public as $$
declare v_lead uuid;
begin
  -- students rows point at their lead; leads rows are the lead (separate branches: NEW only has its own table's columns)
  if tg_table_name = 'students' then
    v_lead := (to_jsonb(new) ->> 'lead_id')::uuid;
  else
    v_lead := (to_jsonb(new) ->> 'id')::uuid;
  end if;
  if new.college_id is not null and (old.college_id is null or old.college_id is distinct from new.college_id) then
    if (select count(distinct stage) from admission_stage_events
          where lead_id = v_lead and stage in ('application', 'documents', 'fee', 'receipt', 'student_record')) < 5 then
      raise exception 'gate_not_met' using detail = 'College ID needs application, documents, fee, receipt and student record signed off.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists leads_college_id_gate on public.leads;
create trigger leads_college_id_gate before update of college_id on public.leads
  for each row execute function public.college_id_gate();
drop trigger if exists students_college_id_gate on public.students;
create trigger students_college_id_gate before update of college_id on public.students
  for each row execute function public.college_id_gate();

revoke all on function public.stage_event_owner_required(), public.lead_stage_history(), public.college_id_gate() from public, anon, authenticated;
