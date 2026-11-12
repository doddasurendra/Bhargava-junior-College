-- Student life: sports, speaker sessions, wellbeing & stress relief, open-book learning.
-- Module data lives in public.records (RLS on, no policies: only the server's service role can read or
-- write it, so no browser or signed-in client can query wellbeing rows directly). The app enforces who sees
-- what (counsellor-only notes, mentor flag only, Principal anonymous trends) and logs every wellbeing read
-- in the `wellbeing_access_log` collection.

insert into public.roles (key, label, is_staff) values
  ('sports_coach', 'Sports Coach', true),
  ('student_counsellor', 'Student Counsellor', true)
on conflict (key) do update set label = excluded.label, is_staff = excluded.is_staff;

-- Belt and braces: records must keep RLS on with no policies.
alter table public.records enable row level security;
