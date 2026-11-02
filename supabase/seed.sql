-- SAMPLE configuration for local development (mirrors content/sample.ts). Replace before launch.

insert into public.visit_slots (slot, label, capacity, saturday) values
  ('10:00', '10:00 AM', 5, true),
  ('11:30', '11:30 AM', 5, true),
  ('14:00', '2:00 PM', 5, true),
  ('15:30', '3:30 PM', 5, false)
on conflict (slot) do nothing;

insert into public.bsat_sessions (id, exam_date, mode) values
  ('2026-11-16-campus', '2026-11-16', 'campus'),
  ('2026-11-30-online', '2026-11-30', 'online'),
  ('2026-12-14-campus', '2026-12-14', 'campus')
on conflict (id) do nothing;
