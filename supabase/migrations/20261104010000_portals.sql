-- Portals (§9A): gateway-confirmed fee payments, the private bucket for applicant documents, and lead
-- sources used by the front desk and alumni referrals.

-- Online payments are confirmed by the gateway (Razorpay), not recorded by a staff member.
alter table public.payments alter column recorded_by drop not null;
-- one row per gateway payment id (the webhook and the checkout callback may both arrive)
create unique index payments_gateway_reference_uidx on public.payments (reference) where recorded_by is null and reference is not null;

-- Private bucket: no public access; the server hands out files only after an authorisation check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applicant-docs', 'applicant-docs', false, 5000000, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
