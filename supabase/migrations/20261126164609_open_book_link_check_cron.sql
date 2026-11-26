-- Open Book weekly official-link check (§2 "Edge Function + pg_cron").
-- pg_cron calls the Edge Function `openbook-link-check` (supabase/functions/openbook-link-check) every Sunday
-- 03:00 UTC through pg_net, with a shared secret kept in Vault. The function reads the same secret through
-- public.ob_cron_secret() (service role only) and refuses any other caller.
create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ob_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ob_cron_secret', 'Open Book weekly link-check job secret');
  end if;
end $$;

create or replace function public.ob_cron_secret() returns text
language sql stable security definer
set search_path = public, vault
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'ob_cron_secret' limit 1 $$;
revoke execute on function public.ob_cron_secret() from public, anon, authenticated;
grant execute on function public.ob_cron_secret() to service_role;

select cron.unschedule('openbook-link-check') where exists (select 1 from cron.job where jobname = 'openbook-link-check');
select cron.schedule('openbook-link-check', '0 3 * * 0', $cron$
  select net.http_post(
    url := 'https://nkhpahcmldfuwydeglml.supabase.co/functions/v1/openbook-link-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ob-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ob_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
