-- College rule: students see no fee information. Fee rows (payments, reversals of fee sign-offs) can be read through
-- the Supabase API only by staff accounts (a row in user_roles with a staff role). Students and parents use the app's
-- own sessions and never get Supabase Auth accounts; this RESTRICTIVE policy makes the rule explicit even if one were
-- ever created. The app server uses the service role and is not affected (parents still see their own child's fees there).
-- Nothing is deleted and existing policies stay as they are.

drop policy if exists payments_staff_only on public.payments;
create policy payments_staff_only on public.payments
  as restrictive for select to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role not in ('student', 'parent', 'guardian', 'applicant', 'alumni')));

drop policy if exists verification_reversals_staff_only on public.verification_reversals;
create policy verification_reversals_staff_only on public.verification_reversals
  as restrictive for select to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role not in ('student', 'parent', 'guardian', 'applicant', 'alumni')));

-- anonymous API callers (no sign-in) never read fee rows
revoke select on public.payments from anon;
revoke select on public.verification_reversals from anon;
