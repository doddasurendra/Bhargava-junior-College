-- Developer role: builds and maintains the platform; every permission in the app (lib/crm/permissions.ts).
insert into public.roles (key, label, is_staff) values ('developer', 'Developer', true) on conflict (key) do update set label = excluded.label, is_staff = true;
-- The Developer sees everything a Super Admin sees under RLS too.
create or replace function public.can_see_all_leads() returns boolean
language sql stable set search_path = public as $$
  select public.has_any_role(array['developer', 'super_admin', 'management', 'principal', 'admission_manager', 'data_executive', 'front_desk', 'admission_office', 'accounts', 'admin_office']);
$$;
