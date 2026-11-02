-- When the current owner was assigned. Imported leads start their follow-up clock here, not at import time.
alter table public.leads add column assigned_at timestamptz;
update public.leads set assigned_at = updated_at where owner_id is not null and assigned_at is null;
