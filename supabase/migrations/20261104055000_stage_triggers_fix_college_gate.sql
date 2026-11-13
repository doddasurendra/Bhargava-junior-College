-- Applied to the live project on 4 Nov 2026 as `stage_triggers_fix_college_gate` (version 20261104094559).
-- Kept here so the repo matches the database's migration history. The same fix is already folded into
-- 20261104050000_stage_triggers.sql, so re-running this is a no-op (create or replace, same body).
--
-- Fix: `new.lead_id` fails to compile on `leads` (no such column) even inside a CASE, so read the
-- id through to_jsonb(new), which works for both tables.
create or replace function public.college_id_gate() returns trigger
language plpgsql set search_path = public as $$
declare v_lead uuid;
begin
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

revoke all on function public.college_id_gate() from public, anon, authenticated;
