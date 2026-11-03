-- 7 PM management report (brief §6.8, §7.3): one immutable-looking snapshot per day, as it was when sent.
create table public.daily_reports (
  report_date   date primary key,
  generated_at  timestamptz not null,
  payload       jsonb not null,
  recipients    int not null default 0
);
alter table public.daily_reports enable row level security;
create policy daily_reports_read on public.daily_reports for select to authenticated
  using (public.has_any_role(array['super_admin', 'management', 'principal', 'admission_manager']));
