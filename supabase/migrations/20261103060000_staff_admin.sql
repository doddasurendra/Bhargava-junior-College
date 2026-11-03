-- Staff accounts managed from the CRM (Super Admin): profile + roles saved together, and the college can
-- never end up with no active Super Admin.

create or replace function public.admin_save_staff(
  p_id uuid, p_full_name text, p_email text, p_phone text, p_active boolean, p_roles text[]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, active)
    values (p_id, p_full_name, lower(p_email), p_phone, p_active)
  on conflict (id) do update
    set full_name = excluded.full_name, phone = excluded.phone, active = excluded.active;
  -- email is the sign-in identity (Supabase Auth); it is set once here and not changed by this function

  delete from public.user_roles where user_id = p_id and role <> all (p_roles);
  insert into public.user_roles (user_id, role)
    select p_id, r from unnest(p_roles) as r
  on conflict do nothing;

  if not exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.role = 'super_admin' and p.active
  ) then
    raise exception 'At least one active Super Admin is required.' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.admin_save_staff(uuid, text, text, text, boolean, text[]) from public, anon, authenticated;
grant execute on function public.admin_save_staff(uuid, text, text, text, boolean, text[]) to service_role;
