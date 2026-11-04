-- Database linter fixes: pin search_path on helper functions, and stop signed-out callers from running the
-- role helpers over /rest/v1/rpc. Signed-in users keep EXECUTE because the RLS policies call these helpers
-- with the caller's privileges (has_any_role only ever answers about auth.uid() itself).
alter function public.touch_updated_at() set search_path = public;
alter function public.can_see_all_leads() set search_path = public;
revoke execute on function public.has_any_role(text[]) from public, anon;
grant execute on function public.has_any_role(text[]) to authenticated, service_role;
revoke execute on function public.can_see_all_leads() from public, anon;
grant execute on function public.can_see_all_leads() to authenticated, service_role;
