-- Hosted Supabase projects ship an event-trigger function public.rls_auto_enable() (SECURITY DEFINER) that the
-- database linter flags as callable over /rest/v1/rpc by anon and authenticated. It only needs to run as an
-- event trigger, so nobody should be able to call it through the API. Guarded: absent on a local stack.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
