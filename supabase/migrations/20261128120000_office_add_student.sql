-- Admin Office: add one student directly (Add Student form and Excel/CSV import) with the College ID the college
-- already issued. Lead + student + primary guardian are written in one transaction (all or nothing). Additive only:
-- no table is changed and no existing row is touched. Only the server (service role) may call it, like
-- create_student / issue_college_id.
create or replace function public.office_add_student(p_actor uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lead uuid;
  v_student uuid;
  v_cid text := upper(trim(p ->> 'college_id'));
begin
  if v_cid is null or v_cid = '' then raise exception 'college_id_required'; end if;
  if exists (select 1 from students where college_id = v_cid) or exists (select 1 from leads where college_id = v_cid) then
    raise exception 'college_id_exists';
  end if;
  insert into leads (phone, contact_name, parent_name, student_name, program, status, stage, first_source, last_source, consent, consent_at, college_id)
  values (p ->> 'guardian_phone', p ->> 'guardian_name', p ->> 'guardian_name', p ->> 'full_name', p ->> 'program', 'admitted', 'college_id', 'office_import', 'office_import', true, now(), v_cid)
  returning id into v_lead;
  insert into students (lead_id, full_name, dob, gender, program, stay, guardian_name, guardian_phone, login_phone, college_id, created_by)
  values (v_lead, p ->> 'full_name', (p ->> 'dob')::date, p ->> 'gender', p ->> 'program', p ->> 'stay', p ->> 'guardian_name', p ->> 'guardian_phone', null, v_cid, p_actor)
  returning id into v_student;
  insert into student_guardians (student_id, phone, name, relation, added_by)
  values (v_student, p ->> 'guardian_phone', p ->> 'guardian_name', coalesce(nullif(p ->> 'relation', ''), 'parent'), p_actor)
  on conflict do nothing;
  return v_student;
end $$;

revoke all on function public.office_add_student(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.office_add_student(uuid, jsonb) to service_role;
