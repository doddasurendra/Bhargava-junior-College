# Bhargava Junior College: digital platform

This is phase 1: the **public website** and the **shared database schema**. The AI chat agent, CRM, student and parent app, and management dashboard will be built on the same backend.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; it works with no env vars set
npm run dev                  # http://localhost:3000
npm test                     # unit tests (fees, scholarship, phone, visits, store)
npm run typecheck
```

When no Supabase variables are set, all writes go to a **local JSON store** at `.data/dev-db.json`. This file is gitignored because it holds personal data. With no SMS provider configured, OTP codes are printed to the server console and shown on the Track page (development only).

### With local Supabase

```bash
npx supabase init            # creates supabase/config.toml and keeps the existing migrations
npx supabase start           # applies supabase/migrations + supabase/seed.sql
# copy the API URL + service_role key into .env.local:
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_SERVICE_ROLE_KEY=...
```

Nothing is pushed to a remote Supabase project yet.

## What's built

| Area | Where |
|---|---|
| Home: hero with callback form, results ticker, stats, programs, toppers, why-Bhargava, BSAT banner, faculty, testimonials, FAQ, map | `app/page.tsx` |
| Program pages ×4 (Course schema, brochure lead gate) | `app/programs/[slug]` |
| Fees table + fee & scholarship calculator (program × stay × BSAT × GPA × instalments) | `app/fees`, `lib/fees.ts` |
| BSAT: slabs, dates, registration that returns a hall-ticket number (Event schema) | `app/scholarship`, `/api/bsat` |
| Campus visit booking: Mon–Sat, slot capacity (no 3:30 PM slot on Saturdays) | `app/visit`, `/api/visits`, `lib/visits.ts` |
| Track admission: OTP-gated, parcel-style timeline with owner and date | `app/track`, `/api/otp`, `/api/track` |
| Results with filters, hostel, admissions, about, contact, course finder | `app/*` |
| Global: top strip, sticky header, EN/తెలుగు/हिंदी switch (site chrome), dark mode, mobile bottom bar, WhatsApp button, exit-intent pop-up | `components/SiteChrome.tsx`, `ClientWidgets.tsx` |
| SEO: EducationalOrganization, Course, FAQPage, Event JSON-LD, sitemap, robots, local keywords | `lib/seo.ts` |

**Every form creates a lead** through one pipeline (`lib/store`). Each lead is deduplicated by normalised mobile number. Every submission is kept as a *touchpoint* with source, UTM, landing page, page, referrer and device. The forms have DPDP consent, a honeypot and rate limits.

### Database (`supabase/migrations`)

The schema has roles (20, pending §9A), profiles, `leads` (one active row per phone, merged rows kept), `lead_touchpoints`, `lead_audit` (who/what/when/old→new), `visit_slots`/`visits`, `bsat_sessions`/`bsat_registrations`, `admission_stage_events` (feeds tracking and the College-ID gate) and `otp_challenges`. Writes go through `capture_lead`, `book_visit` (advisory-locked capacity check) and `register_bsat`, which only the service role can execute. RLS is on everywhere, and telecallers can see only their own leads.

## Admissions CRM (`/crm`), in progress

Open http://localhost:3000/crm. In local development (no Supabase) you sign in by picking one of the sample staff (brief §3.6), with no password. If the store is empty, **Load demo leads** fills every queue. With Supabase configured, staff sign in with email and password through Supabase Auth, and every attempt is written to `login_audit`. The session is a signed, 10-hour, httpOnly cookie (`SESSION_SECRET`).

| Built (brief §7) | Where |
|---|---|
| My tasks: overdue / escalated / today / upcoming / unassigned counts, and visits today and needing an outcome | `app/crm/(app)/page.tsx` |
| Leads list: queues, filters (category, status, program, source, owner, search), bulk assign (named owner or load-balanced round-robin) and bulk category | `app/crm/(app)/leads` |
| Lead detail: one owner, reassignment needs a reason, qualification Hot/Warm/Cold/Invalid, **mandatory call outcome + next follow-up unless closed**, close-as-lost with reason/competitor, admission decision Confirmed/Pending/Lost, full timeline (website touchpoints, calls, audit) | `app/crm/(app)/leads/[id]` |
| Campus visits: Arrived / No-show, outcome required, past visits without outcome flagged and escalated after 24h | `app/crm/(app)/visits` |
| Follow-up escalation: overdue → owner, 24h → supervisor, 48h → flagged for the 7 PM report | `lib/crm/rules.ts` |
| Permissions: telecallers and counsellors see only their own leads; managers assign and qualify; front desk checks in visits | `lib/crm/permissions.ts` |
| **Lead import (CSV):** column mapping auto-guessed from headers (school-data style "Father's Name", "Mobile No", "Group"…), program text normalised (MPC → IIT-JEE, BiPC → NEET, "long term"), source required, default school/program, server-side preview (new / merge / duplicates-in-file / rejected with reasons, by-school breakdown), downloadable rejected rows (formula-injection safe), batch history | `app/crm/(app)/import`, `lib/crm/csv.ts`, `lib/crm/importer.ts` |

Imports are de-duplicated by mobile number, both within the file and against existing leads (matching their phone or student phone). A merge **only fills empty fields**, so nothing staff or the family already gave is overwritten, and an audit entry and touchpoint record which file and line it came from. Imported leads have `consent = false`. Their follow-up clock starts **when they are assigned**, not when they're imported, so a large school list shows as "Awaiting assignment" rather than flooding the overdue and escalation queues. Web enquiries are still due the moment they arrive. Limits: 5,000 rows / 2 MB per file. Excel files must be saved as CSV first.

Business rules are pure functions in `lib/crm/rules.ts`, with unit tests. Every mutation goes through `lib/crm/service.ts`, which re-checks permission and lead visibility and writes the audit trail.

**Not yet:** direct .xlsx upload, Kanban view, a data-quality report (category mix by school and source), click-to-call telephony and recordings, WhatsApp/SMS templates and campaigns, the AI-handoff chat inbox, the verification checkpoint (documents → fee → receipt → student record → College ID), the staff mobile app, role switching UI, 2FA, and the 7 PM report (§8 is missing from the brief).

## Before launch: the college must provide

- [ ] Official `logo.png` → add it to `/public` and set `logoSrc` in `content/college.ts` (a placeholder SVG crest is in use)
- [ ] Confirm the motto spelling: *Vikasam* or *Vikasa*
- [ ] Confirm which number is on WhatsApp Business
- [ ] Replace everything in `content/sample.ts` (results, fees, BSAT, hostel, faculty, FAQs, visit slots) and set `sample: false`, which removes the "Sample data" badges
- [ ] Parent testimonial quotes, the leadership message, photos and scorecard verification links
- [ ] Native-speaker review of the Telugu/Hindi strings in `lib/i18n.ts`

## Not built yet (next phases)

- **Website remainder:** free resources, mock test, rank/college predictor, blog, downloads, careers, parent corner, online application form and fee payment, hero carousel, gallery/360° tour, fully translated page bodies
- **Integrations:** WhatsApp Business and SMS provider (`lib/messaging.ts` is a stub), payment gateway, DigiLocker, cloud telephony
- **Headless CMS:** content is currently typed files in `content/`
- **AI Admission Assistant** (RAG and CRM tool calls), **Admission CRM**, **Student & Parent app**, **Management dashboard / 7 PM report**
- **Spec gaps:** the brief we received was cut off. §8 (dashboard), §9/9A (the 18 logins), §10–12 and most of the acceptance criteria are missing.
