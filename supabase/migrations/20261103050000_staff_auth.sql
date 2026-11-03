-- Staff sign-in security: TOTP 2FA (required for super_admin, management, accounts), lockout after repeated
-- failures, sign-out-everywhere, and a fuller login audit. Passwords stay in Supabase Auth.

create table public.staff_auth (
  profile_id        uuid primary key references public.profiles (id) on delete cascade,
  totp_secret_enc   text,                 -- AES-256-GCM sealed by the server (MFA_ENCRYPTION_KEY)
  totp_pending_enc  text,                 -- shown on the enrolment screen, not yet confirmed
  totp_enabled_at   timestamptz,
  totp_last_step    bigint not null default 0,  -- replay protection
  recovery_hashes   text[] not null default '{}',
  failed_count      int not null default 0,
  locked_until      timestamptz,
  session_version   int not null default 0,
  updated_at        timestamptz not null default now()
);
alter table public.staff_auth enable row level security;  -- no policies: service role only

alter table public.login_audit alter column email drop not null;
alter table public.login_audit
  add column method     text not null default 'password',
  add column reason     text,
  add column ip         text,
  add column user_agent text,
  add column actor_id   uuid references public.profiles (id);
create index login_audit_at_idx on public.login_audit (at desc);
create index login_audit_user_idx on public.login_audit (user_id, at desc);

-- Count a failed password or code; lock once p_max is reached. A lapsed lock starts a fresh count.
create or replace function public.auth_record_failure(p_profile uuid, p_max int, p_lock_seconds int)
returns public.staff_auth
language plpgsql security definer set search_path = public as $$
declare r public.staff_auth;
begin
  insert into public.staff_auth (profile_id) values (p_profile) on conflict (profile_id) do nothing;
  select * into r from public.staff_auth where profile_id = p_profile for update;
  if r.locked_until is not null and r.locked_until <= now() then
    r.failed_count := 0;
    r.locked_until := null;
  end if;
  r.failed_count := r.failed_count + 1;
  if r.failed_count >= p_max and r.locked_until is null then
    r.locked_until := now() + make_interval(secs => p_lock_seconds);
  end if;
  update public.staff_auth set failed_count = r.failed_count, locked_until = r.locked_until, updated_at = now()
    where profile_id = p_profile returning * into r;
  return r;
end $$;

-- Accept a TOTP time step only if it is newer than the last one used (a code can't be replayed).
create or replace function public.auth_use_step(p_profile uuid, p_step bigint)
returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update public.staff_auth set totp_last_step = p_step, updated_at = now()
    where profile_id = p_profile and totp_last_step < p_step
    returning 1
  )
  select exists (select 1 from u);
$$;

-- Spend a recovery code (single use).
create or replace function public.auth_consume_recovery(p_profile uuid, p_hash text)
returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update public.staff_auth set recovery_hashes = array_remove(recovery_hashes, p_hash), updated_at = now()
    where profile_id = p_profile and p_hash = any (recovery_hashes)
    returning 1
  )
  select exists (select 1 from u);
$$;

revoke all on function public.auth_record_failure(uuid, int, int) from public, anon, authenticated;
revoke all on function public.auth_use_step(uuid, bigint) from public, anon, authenticated;
revoke all on function public.auth_consume_recovery(uuid, text) from public, anon, authenticated;
grant execute on function public.auth_record_failure(uuid, int, int) to service_role;
grant execute on function public.auth_use_step(uuid, bigint) to service_role;
grant execute on function public.auth_consume_recovery(uuid, text) to service_role;
