# Bhargava Junior College: digital platform

**Website (local):** http://localhost:3000 · **Every link (website, all role logins, CRM, portal):** [LINKS.md](LINKS.md) · **Checklist status:** [AUDIT_REPORT.md](AUDIT_REPORT.md)

One Next.js app and one database for all five parts of the brief: the **public website**, the **AI admission assistant** (web + WhatsApp), the **admission CRM**, the **Student & Parent app** (installable PWA) and the **management dashboard with the 7 PM report**, plus portals for every role in §9A.

## Portals by role (§9A.2)

| # | Login | Home | What they do |
|---|---|---|---|
| 1 | Super Admin | `/crm` | Everything; staff accounts, **permission matrix and custom roles** (`/crm/permissions`), security log, read-only **view as** |
| 2 | Management / Chairman | `/crm/dashboard` | §8 dashboard (10 parameters, filters, funnel, ROI, seats vs target), 7 PM reports + PDF, approvals of concessions above slab and refunds |
| 3 | Principal | `/crm/academics/overview` | Attendance and test performance across batches, weak-batch alerts, faculty workload, wellbeing alerts, leave approval, circulars, discipline |
| 4 | Admission Manager | `/crm` | Import, qualify, allocate, escalations, team performance, BSAT, concessions up to the slab |
| 5 | Telecaller | `/crm` | Own leads only, phone numbers masked, click-to-call, mandatory outcomes |
| 6 | Admission Counsellor | `/crm` | Visits, **counselling form**, decisions, chat inbox |
| 7 | Front Desk | `/crm/front-desk` | Today's visits, Arrived / No-show, walk-in leads, visitor log, gate passes |
| 8 | Admission Office | `/crm/verification` | Documents (incl. uploads from the app), student records |
| 9 | Accounts | `/crm/accounts` | Payment approval, receipts, instalment plans, dues and reminders, concessions/refunds, daily collection, **Tally CSV** |
| 10 | Admin Office | `/crm/students` | College ID, batch allotment, **ID cards**, TC / bonafide / study / conduct certificates, alumni moves |
| 11 | Academic Coordinator / Exam Cell | `/crm/academics` | Batches (cap 40), timetable (clash-checked), mentors, tests, result publishing, rank lists |
| 12 | Faculty | `/crm/academics/my-classes` | Timetable, attendance (parents alerted on absence), notes/DPPs/recordings, online + offline tests, doubt inbox, leave |
| 13 | Class Teacher / Mentor | `/crm/mentor` | 1 : 20 mentees with early warnings, notes (shared into the Sunday report), wellbeing check-ins, PTM slots, parent messages |
| 14 | Hostel Warden | `/crm/hostel` | Rooms, night roll, out-pass approval, sick room, complaints, visitors, mess menu |
| 15 | Transport In-charge | `/crm/transport` | Buses, students per bus, pickup/drop attendance, GPS positions |
| 16 | Content & Marketing | `/crm/cms` | Website content (19+ blocks), FAQs/knowledge base, campaigns, marketing spend |
| 17 | Student | `/app` | Timetable, study planner, timed JEE/NEET tests and analytics, doubts, attendance, notices, out-pass, bus, digital ID |
| 18 | Parent / Guardian | `/app` | Child switcher, attendance, results and mentor notes, dues + online payment, receipts, PTM, messages, out-pass approval, hostel, bus |
| 19 | Applicant | `/app` | Admission timeline, online application, document upload, visit booking/reschedule, fees; becomes Student/Parent when the College ID is issued |
| 20 | Alumni | `/app/alumni` | Profile, mentoring offer, referrals (CRM source `alumni_referral`) |

`/login` is the role picker. One person can hold several roles and switch without signing out (e.g. sample **V. Naresh**: faculty + mentor + warden). Locally, **Load demo leads** also admits six sample students with batches, timetable, mentors, rooms and a bus.

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

See **Supabase** below for deploying to a hosted project.

## What's built

| Area | Where |
|---|---|
| Home: hero carousel (slides edited in CMS → *Home page hero slides*; pauses on hover/focus, off for reduced motion) beside a fixed callback form, results ticker, stats, programs, toppers, why-Bhargava, BSAT banner, faculty, testimonials, FAQ, map | `app/page.tsx` |
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

## Admissions CRM (`/crm`)

Open http://localhost:3000/crm. In local development (no Supabase) you sign in by picking one of the sample staff (brief §3.6), with no password. If the store is empty, **Load demo leads** fills every queue. With Supabase configured, staff sign in with email and password through Supabase Auth. The session is a signed, 10-hour, httpOnly cookie (`SESSION_SECRET`).

### Staff sign-in and 2FA (`lib/auth/`)

- **Two-step verification is optional for every role** (owner's choice): everyone signs in with email + password and can turn 2FA on, and later off, from **My account**. To make it compulsory for some roles again, set `REQUIRE_2FA_ROLES=super_admin,management,accounts` (any role keys, comma-separated) and restart; no code change. 2FA uses any authenticator app with standard TOTP codes (6 digits, 30 seconds). When someone turns it on they scan a QR code, confirm one code and get **8 single-use recovery codes**, shown once only; every later sign-in asks for a code. The dev picker skips only the password; 2FA still applies to anyone who has it on.
- **Lockout:** after 5 wrong passwords or codes in a row, the account is locked for 15 minutes, unless a Super Admin unlocks it sooner. "Wrong email" and "wrong password" get the same message, so the form doesn't reveal who has an account.
- **Replay protection:** a code can't be reused, and ±30 s of phone clock drift is accepted. TOTP secrets are stored encrypted with AES-256-GCM (`MFA_ENCRYPTION_KEY`, or derived from `SESSION_SECRET`), and recovery codes are stored only as hashes.
- **Login audit:** every step is recorded, success or failure, with the reason, IP address and device. That covers password, dev picker, 2FA code, recovery code, 2FA setup, sign-out and admin actions. **Security** (`/crm/security`, Super Admin and Management) shows it next to everyone's 2FA status, recovery codes left and locks. A failed audit write is logged loudly but doesn't block the sign-in.
- **Lost phone:** sign in with a recovery code, or ask *another* Super Admin to **Reset 2FA**. That needs a reason, is audited, signs the user out everywhere, and makes them set up 2FA again at their next sign-in. A Super Admin can't reset their own 2FA, so keep at least two Super Admins, or keep the recovery codes safe.
- **Sessions:** **My account → Sign out everywhere else** ends every other session. A session cookie without the 2FA step completed is refused for anyone who has 2FA on (or whose role requires it), even if it is still valid.
- Supabase: `supabase/migrations/20261103050000_staff_auth.sql` (the `staff_auth` table, extra `login_audit` columns, and atomic RPCs for failure counting, code replay and recovery codes).
- **Staff accounts** (`/crm/staff`, Super Admin): add staff (name, work email, optional mobile, one or more roles), edit names and roles, deactivate or reactivate, and email a password-reset link. A new person gets a Supabase **invitation email** to set their own password, so no one ever types another person's password. Deactivating someone, or removing a role, signs them out at once, and their history stays under their name. The college can never be left without an active Super Admin (checked in the service and again in the `admin_save_staff` database function), and a Super Admin can't deactivate themselves or remove their own Super Admin role. Every change goes into the Security log with who did it. A sign-in email can't be changed. Migration: `20261103060000_staff_admin.sql`.
- **Forgot password** (`/crm/login/forgot`) always gives the same answer, whether or not the email is staff, and sends at most 3 links per hour per person. The link opens `/crm/login/reset`. The token is used up only when the new password is submitted, so email scanners that open links can't spend it. A new password needs 10+ characters and isn't a common or repeated pattern. Saving it signs out every other session and clears any lockout. 2FA stays as it is: a password reset never turns 2FA off.
- **Supabase setup for those emails:** in Auth → URL Configuration, set the Site URL to the live domain (it must match `NEXT_PUBLIC_SITE_URL`). In Auth → Email Templates, point the links at our page (the server-side token-hash flow):
  - *Invite user*: `{{ .SiteURL }}/crm/login/reset?token_hash={{ .TokenHash }}&type=invite`
  - *Reset password*: `{{ .SiteURL }}/crm/login/reset?token_hash={{ .TokenHash }}&type=recovery`
  
  Also set up custom SMTP (Supabase's built-in mailer is rate-limited and meant for testing), turn off public sign-ups (staff are only ever invited), and set the minimum password length to 10 so it matches ours.
- **Role switching:** someone with several roles works in one at a time and switches from **Working as** in the menu without signing out. The default is whichever role comes first in the standard role list, which starts with the admin and management roles. The choice is a plain cookie, but on every request the server accepts only roles the person actually holds, so it can only narrow their access. 2FA depends on *all* their roles, so an Accounts person working as Telecaller still needs their code. Each switch is written to the login audit, and a fresh sign-in starts in the default role. Try it as sample staff **Kavya** (Front Desk + Admission Office).

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

### Admission verification checkpoint (§7.4)

When a lead's decision is **Confirmed**, its page shows the six-step checkpoint, and `/crm/verification` lists every admission in progress, with "waiting on you" rows first.

| Step | Signed off by | How |
|---|---|---|
| 1 Application completed | Admission counsellor (or manager) | Sign-off button |
| 2 Documents verified | Admission office | Checklist (Received / Verified / N/A for "if applicable" items / Rejected with reason). Configurable per program in `content/sample.ts → documentChecklist` |
| 3 Fee payment confirmed | Accounts | Payments recorded by the front desk or admission office wait for Accounts approval; payments Accounts records are approved as they are recorded. Needs an approved payment and nothing still pending |
| 4 Official receipt | Accounts | "Generate official receipt" numbers every approved payment (`BJC/2027-28/00001`), with a printable receipt on the letterhead at `/crm/receipts/[id]` |
| 5 Student record | Admin office | Legal name, DOB, gender, program, stay, guardian |
| 6 College ID | Admin office | **Disabled until 1–5 are signed off.** Format configurable (`numbering.collegeId`, e.g. `BJC-2027-JEE-0001`), sequence per year + program. Marks the lead Admitted |

Each sign-off happens once (a second attempt is refused) and is written to the audit trail with who and when. Receipt numbers and College IDs come from atomic counters. In Supabase the gate is enforced again inside `issue_college_id()`, so it holds even if someone bypasses the app.

**Reversing a wrong sign-off:**
- **Who requests:** the step's owner or a manager clicks "Request reversal" with a reason.
- **Who approves:** a *different* manager (Super Admin, Management or Admission Manager). Self-approval is refused in the app and in the database.
- **What clears:** approving removes that sign-off plus the sign-offs that depended on it: application → student record, fee → receipt. A removed student record is copied into the audit trail first.
- **What never changes:** issued receipt numbers stay valid, payments are never deleted, and nothing can be reversed after a College ID is issued.

**Not yet (verification):** a PDF file with WhatsApp/email delivery of receipts (today: print / save as PDF), payment gateway auto-confirmation, DigiLocker fetch, cancelling an issued receipt, and the Student & Parent app login that the College ID unlocks.

## Student & Parent app (`/app`), first slice

The app is an **installable web app (PWA)** on the same backend. Families open `/app` and choose "Add to Home screen" on Android or iOS. Store-listed native apps can wrap it later (e.g. Capacitor) without a second backend.

- **Sign-in:** mobile number plus a 6-digit code on WhatsApp. Sessions last 30 days, in an httpOnly cookie whose audience (`app`) can never pass as a CRM session. Codes are sent only to registered numbers, but the screen says the same thing either way, so it can't be used to discover who is enrolled.
- **Who sees what:** computed fresh on every request from the phone number.

  | Profile | Who |
  |---|---|
  | **Parent** | Each student the number is a guardian of |
  | **Student** | The student's own number, if their lead had a student phone |
  | **Applicant** | An enquiry or application without a College ID yet |

  So an **applicant becomes a parent automatically when the College ID is issued**, and removing a guardian takes effect immediately. A number with several profiles (two children, or a child plus a sibling's application) gets a switcher at the top.
- **Guardians:** issuing the College ID grants the primary guardian access in the same transaction and sends `bjc_app_welcome` on WhatsApp. The admin office can **add more guardians** (several per student) or remove them from the lead page; the last one can't be removed.
- **Screens:**

  | Screen | What it shows |
  |---|---|
  | Home | Digital College ID card, last hostel movement, fees paid, guardians with access. Applicants see the admission timeline, counsellor and visit |
  | Fees | Payments and official receipts (the same receipt document as the CRM, printable). Only for that phone's own students |
  | Hostel | Biometric check-in/out log, weekly mess menu (sample), daily schedule, safety and health info |

- **Biometric hostel gate:** `POST /api/hostel/events` with header `x-device-key: $HOSTEL_DEVICE_KEY` and body `{ college_id, direction: "in"|"out", at, device, event_id }`. It's idempotent per device and event, and each new event sends `bjc_hostel_movement` on WhatsApp to every guardian. Without the key configured, the endpoint refuses everything.

**Siblings (family leads):** leads still de-duplicate by mobile number (§4.4), so a new enquiry from a known number lands on the family's *first* lead. To add another child, open that lead and use **Family → Add another child**. Each child gets their own lead with its own visit, decision, documents, fees and College ID. The parent's number, names, consent and owner are copied over, and the source is marked as `sibling`. Up to 6 children per family.
- Imports, website enquiries, WhatsApp opt-outs and the bot always match the first lead, never a sibling.
- *Track admission* and the parent app show every child on the number; the app's profile switcher moves between them.
- Supabase: `supabase/migrations/20261103040000_siblings.sql` (the `sibling_of` column, a partial unique index on primary leads, and the `create_sibling` RPC).

**Not yet (needs §9–12 of the brief, which were cut off):** attendance, tests and the mentor's note (and the Sunday WhatsApp parent report built on them), PTM booking, messaging the class teacher, the monthly wellbeing check-in, warden contacts and the sick-room log, online fee payment, push notifications, offline support, Telugu/Hindi in the app, PNG app icons, and the staff-side logins for faculty, wardens and transport.

## Management dashboard and the 7 PM report

**`/crm/dashboard`** is for Super Admin, Management, Principal and the Admission Manager. One period filter (**Today / Month to date / Season to date**, India time; season start is `admissionsSeason` in `content/sample.ts`) scopes everything below it.

| Section | What it shows |
|---|---|
| Right now | Live backlog: open, overdue, **overdue 48h+**, visits without outcome, unassigned, unqualified, pending decisions, in verification. Each tile links to the matching queue |
| Admission funnel | New leads → called → visits booked → held → confirmed → fee confirmed → College ID, with stage-to-stage %, calls/connect rate and no-shows. Hover a row for its definition |
| Last 30 days | Daily new leads, visits held and confirmations (line chart, one axis, table view) |
| Accountability by owner | Per telecaller/counsellor: open leads, calls, connect rate, overdue, **48h+**, visits booked, confirmed. Worst first |
| Overdue 48h+ | The leads §7.3 says go to management, with owner and how late |
| Where admissions are lost | Loss reasons, losses after a visit, and the competitors named |
| Lead sources | Leads by source and how many went on to visit or be confirmed |
| Data quality | Hot/Warm/Cold/Invalid/Unqualified mix by source and by school (§7.1) |

Chart colours were validated with the dataviz palette checker (colour-blind separation, lightness band, contrast) for the light (`#ffffff`) and dark (`#151c3d`) surfaces. They live as `--viz-*` tokens in `app/globals.css`. Every chart has hover values and a table view, and status tiles use an icon and a label, never colour alone.

**7 PM report:**
- **Schedule:** call `/api/cron/daily-report` daily at **13:30 UTC (19:00 IST)** with `Authorization: Bearer $CRON_SECRET`.
- **Snapshot:** it stores a snapshot (today, month to date, season) that never changes afterwards. Read it at `/crm/reports/<date>`, printable as a PDF.
- **WhatsApp:** template `bjc_daily_report` goes to every active Super Admin, Management or Principal user who has a mobile number. It's safe to re-run: the snapshot is replaced, but nobody gets the message twice.
- **Preview:** "Preview today's report" builds the snapshot without sending.

**Caveat:** §8 of the brief (dashboard metrics) was cut off in the copy we received. These metrics are derived from §6.8 and §7.1–7.5, and their definitions live in `lib/crm/metrics.ts` (unit tested), so they're easy to change.

## Chat: website assistant and handoff inbox

**Website widget** ("Ask admissions", on every public page):
- **Fallback assistant:** a rule-based bot (`lib/chat/faqBot.ts`, the "fallback bot" from §5) answers from site content only: courses, fees, BSAT, hostel, visits, tracking, documents, results and contact. It understands common romanised Telugu/Hindi ("fee entha", "kitna").
- **Honest limits:** it never promises ranks or seats, and says it doesn't know rather than guessing.
- **Quick replies and nudge:** quick-reply chips, plus a proactive nudge after 20 seconds on the fees and program pages.
- **Handoff:** "Talk to a counsellor" asks for name, mobile and consent, creates the lead (source `chat`) and opens a conversation with the full transcript. Replies arrive live.

**Inbox** (`/crm/inbox`, for telecallers, counsellors, front desk and managers):
- **Sources:** website handoffs and *every* WhatsApp message from a family (except STOP/START).
- **Routing:** a new conversation goes straight to the lead's owner, or to the shared **Waiting** queue that anyone can pick up. Views: Waiting / Mine / All open / Closed, with unread counts and a nav badge, refreshing every few seconds.
- **Replying:** reply (which picks the conversation up automatically), transfer to a colleague with a note, or close it with a required outcome note. A reply counts as contact on the lead.
- **24-hour window:** WhatsApp free-text replies are only allowed **within 24 hours of the family's last message**, as WhatsApp requires. After that the inbox explains why and points to templates.
- **Outside office hours:** the family gets an automatic reply, and a **callback is scheduled** on the lead for the next opening (Mon–Fri 7–5, Sat 9–3 IST).
- **Privacy:** staff-only notes (transfer reasons, close outcomes) are never shown to the family. Visitors see staff first names only, and a visitor's chat is protected by a random token stored only as a hash.

### AI admission assistant (`lib/assistant/`)

The website chat is answered by Claude (`claude-opus-5-5`, low effort for chat latency) using the **Anthropic TypeScript SDK**.
- **Knowledge:** answers come **only** from a knowledge base rendered from the same content files as the site (`lib/assistant/knowledge.ts`). It's small, so it sits whole in a prompt-cached system prompt rather than a vector store; move to retrieval once the CMS adds long content. Unconfirmed sample data is labelled so the assistant says "currently listed".
- **Behaviour:** replies in English, Telugu or Hindi, including romanised Telugu/Hindi. It never promises ranks or seats, and says it doesn't know rather than guessing.
- **Tools** (strict schemas, re-validated on the server):

  | Tool | What it does |
  |---|---|
  | `calculate_fee` | Exact yearly fee for a program, stay, BSAT score and instalment plan |
  | `get_visit_slots` / `book_visit` | Real slot availability; booking sends the WhatsApp confirmation |
  | `save_enquiry` | Creates or merges the lead (source `chat`) and returns the counsellor's name |
  | `register_bsat` | Registers for BSAT and returns the hall ticket number |
  | `check_application` | Never reveals status; points to the OTP-protected `/track` page |
  | `handoff_to_counsellor` | Hands the same conversation to the inbox (asks for contact details if missing) |
  | `note_unanswered` | Logs a question the knowledge base can't answer, for the backlog |

- **Consent (DPDP):** personal details are saved only after the visitor taps **"I agree"**. That button is the only thing that sets consent; the model can't.
- **Lead scoring:** a booked visit makes the lead **Hot**, and an enquiry or BSAT registration makes it at least **Warm**. Scores never go down.
- **Safety:**
  - **Refusals:** server-side refusal fallback is on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). If a request is still refused, the visitor gets a polite reply and an offer of a counsellor.
  - **Unavailable AI:** if Claude can't be reached (no credentials, network, rate limit, outage) or `ASSISTANT_DISABLED=1`, the rule-based assistant answers that turn, labelled "Quick answer".
- **Sessions:** each chat is a stored conversation (status `bot`) with a hashed visitor token. History comes from the server, never from the browser; a chat is limited to 40 turns, plus IP rate limits.
- **Analytics** (`/crm/assistant`, managers): chats, messages, resolution and handoff rate, leads, visits and BSAT registrations created, fallback rate, tool usage, cache hit rate, and **unanswered questions** (phone numbers stripped) to feed back into the content.

**To switch on:** set `ANTHROPIC_API_KEY` (or sign in with `ant auth login`). Every message costs API tokens, roughly a cached ~4k-token prefix plus the conversation per turn. Check `/crm/assistant` for the cache hit rate.

**Not yet (chat):** an eval set and live tuning against real questions, the assistant on WhatsApp (inbound WhatsApp messages still go straight to staff), mobile OTP verification inside the chat before saving, vernacular answers in the rule-based fallback, voice notes and media in the inbox, typing indicators and push notifications (the inbox polls), canned replies, and the chat analytics from §5.

## WhatsApp (Business Cloud API)

Code: `lib/whatsapp/`. Templates live in `lib/whatsapp/templates.ts`, the single source of truth, and are listed for submission at **/crm/whatsapp** (managers).

**What gets sent:**
- **Website (automatic):** an enquiry acknowledgement (or the program brochure PDF for brochure requests, once `brochures.urls` is set), the visit confirmation, the BSAT hall ticket, and the Track-admission OTP (Authentication template with a copy-code button).
- **Reminders:** visit reminders go **1 day and 2 hours before**, through `/api/cron/whatsapp-reminders`. Call it every 15 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this automatically). The day-before reminder is skipped for visits booked less than 24h ahead.
- **CRM, per lead:** college intro, brochure, location and visit confirmation. Values are filled in from the lead record, never typed by staff.
- **CRM, bulk:** intro or brochure to selected leads, at most 200 per send. Only opted-in numbers receive it, and the rest are counted as skipped.

**Consent and opt-out:**
- Website enquiries opt in through the form. Imported and phone-in leads need staff to **record the opt-in** with a note.
- A **STOP** reply opts the number out everywhere, and only the family can undo it by replying **START**.

**Delivery tracking:**
- **Outbox:** every message is stored with its status (queued → sent → delivered → read, or failed/skipped) and shown as a thread on the lead.
- **Dedupe keys:** each automatic message has one, so cron and webhook retries never double-send.
- **Webhook:** `/api/whatsapp/webhook` checks Meta's signature against the raw body.

**Without credentials:**
- **Development:** messages are logged (masked) and marked sent with a dev id.
- **Production:** messages are recorded as *skipped*, and the OTP endpoint returns 503.

**Go-live checklist:**
1. WhatsApp Business Account plus a verified number for the college.
2. Submit the 8 templates on /crm/whatsapp and wait for Meta's approval.
3. Set `MESSAGING_PROVIDER=whatsapp_cloud`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (permanent system-user token), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and `CRON_SECRET`.
4. Register the webhook URL with the verify token and subscribe to `messages`.
5. Schedule the cron.
6. Add the brochure PDF URLs.

**Not yet (WhatsApp):**
- Free-text replies from staff inside the 24-hour window (comes with the chat inbox / AI assistant).
- Automatic retry of rate-limited sends.
- Receipt PDFs over WhatsApp.
- Hostel check-in alerts and the Sunday parent report (student app phase).
- SMS fallback.


## CMS: all sample data is editable (`/crm/cms`)

Every placeholder in §2 and §3 is a **validated content block**: results, fees, BSAT, hostel, faculty and the leadership message, FAQs, visit slots, the document checklist, ID and receipt numbering, the mess menu, the season and seat targets, brochures and downloads, testimonials, the gallery and 360° tour, the blog, resources, careers, the parent corner, the mock test, the predictor inputs and social links. Each block has a form editor, per-block editor roles, version history with restore, and a "This is real data" switch that removes the *Sample data* badge. Pages, the fee calculator, booking capacity, the AI assistant's knowledge and tools, the rule-based bot, WhatsApp messages and the verification gate all read live content. Visit slots and BSAT sessions are also mirrored into their booking tables in Supabase.

## Security (§9A.4)

- RBAC with an editable matrix and custom roles. The Super Admin can never lose administration rights.
- **Data scoping:** telecallers see only their own leads; faculty see only their batches; mentors see their mentees; parents see only their children; students see only their own data.
- **Field masking:** roles without `phone.view` see `******7575` and call through click-to-call. Each reveal is audited.
- **Sessions:** server-side session records, a device list with remote sign-out, a 30-minute idle timeout for staff, a 2-device limit for students, and optional 2FA for every staff member (compulsory per role via `REQUIRE_2FA_ROLES`).
- **Login audit:** every step (and every admin action) is recorded with IP and device. Lockout after 5 failures.
- **View as:** read-only (the middleware refuses writes), bound to the admin's session, expires after 30 minutes, and is logged.
- **Staff exit:** deactivation signs the person out and reassigns their open leads to an admission manager.
- **DPDP:** notice and consent at the first app login. Applicant documents go to a private bucket, checked by magic bytes, 5 MB limit.

## Integrations: real code with placeholders until credentials exist

| Integration | Status | Turn on with |
|---|---|---|
| WhatsApp Business Cloud API | built; logs in development | `MESSAGING_PROVIDER=whatsapp_cloud` + the `WHATSAPP_*` variables, and Meta approval of every template in `lib/whatsapp/templates.ts` (now including absence alert, weekly report, fee reminder, out-pass, notice, test result) |
| Claude (AI assistant) | built; rule-based fallback | `ANTHROPIC_API_KEY` |
| Email (7 PM report PDF) | built (SMTP, works with SES) | `SMTP_*`, `EMAIL_FROM` |
| Razorpay (online fees) | built (orders, checkout, signature checks, webhook) | `RAZORPAY_*` |
| Exotel click-to-call | built (masked numbers revealed once, audited, until configured) | `EXOTEL_*` |
| Bus GPS | endpoint `/api/transport/location` | `TRANSPORT_DEVICE_KEY` |
| Biometric hostel gate | endpoint `/api/hostel/events` | `HOSTEL_DEVICE_KEY` |
| MSG91 SMS, DigiLocker, Firebase push, Google/Microsoft SSO | **not built** | needs accounts with those providers |

Scheduled jobs (`vercel.json`): the 7 PM report (13:30 UTC), visit reminders (every 15 minutes), the Sunday parent report (Sunday 12:30 UTC) and fee reminders (04:30 UTC). All require `CRON_SECRET`.

## Before launch: the college must provide

- [x] Official logo: taken from bhargavajuniorcollege.com, in `/public/logo.png` (+ 192/64 px icons and the Apple touch icon)
- [x] Motto spelling: *Vidhya Vruddhi Vikasam*, as on the official logo
- [ ] Confirm which number is on WhatsApp Business (enter it under Website content → Social links)
- [ ] Replace every CMS block's sample content and switch it to "real data"
- [ ] Parent testimonial quotes, the leadership message, photos and scorecard verification links
- [ ] Native-speaker review of the Telugu/Hindi strings in `lib/i18n.ts`
- [ ] Credentials for the integrations above, and approval of the WhatsApp templates

## Supabase

All migrations are in `supabase/migrations` (in order, through `20261104030000_harden_helper_functions.sql`). The portal data (academics, hostel, transport, CMS, sessions and so on) lives in one `records` table, which has RLS on and no policies, so only the server reads it.

**Hosted project:** every migration is applied to the dedicated project `nkhpahcmldfuwydeglml` (`https://nkhpahcmldfuwydeglml.supabase.co`), with the `seed.sql` visit slots and BSAT sessions. The database linter is clean apart from intentional notices (server-only tables with no policies; `has_any_role` callable by signed-in users because the RLS policies use it). To switch the app onto it, set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys); the app stays on the local JSON store until the service role key is set. For a new project: `npx supabase link --project-ref <ref>` and `npx supabase db push`.

## Developer role (full access)

`/login` → **Developer** (or `/crm/login?as=developer`). The Developer has **every permission, always**, including permissions added later; the permission matrix can't take any away (`lib/crm/permissions.ts`). It edits every website content block, uses the college assistant and reads its query log, manages staff, resets 2FA and unlocks accounts.

- **Developer console** (`/crm/developer`, the Developer's home): environment status (secrets shown only as set / not set), shortcuts to content, permissions, staff and security, and links to every website, CRM and portal page.
- **Open the Student & Parent portal as a family**: one click per guardian or student number. **Local development only** (`next dev` without Supabase), so a developer session can never browse families' data on the live site without their own sign-in.
- **Safety:** normal email + password sign-in like the Admission Manager (no 2FA required, by the owner's choice; it can still be switched on from My account). Only a Developer can grant, remove or change the Developer role, and nobody can remove their own (`lib/auth/staffAdmin.ts`). Everything is still recorded in the audit and login logs. Tested in `lib/auth/developer.test.ts`.
- Local sample user: **Developer** in the `/crm/login` picker: one click, no code.

## Master prompt v2: status against its done checklist

| Item | Status |
|---|---|
| `/admission-system`: flowchart with colour key, the 10 stages (exact wording), operating principle | **Done** (`content/admissionSystem.ts`); the principle is also the CRM header line |
| Qualification before allocation (§3.2-A) | **Enforced**: `assignLeads` refuses unqualified and Invalid leads (`lib/crm/allocation.test.ts`) |
| Post-visit pipeline, lost needs a reason, follow-up ageing and 24 h / 48 h escalation, College ID gate, audit trail (§3.2 B–E) | Done (see Admissions CRM above) |
| Management dashboard: 10 parameters, filters, funnel, 7 PM report | Done (`/crm/dashboard`, `/crm/reports`, Vercel Cron `30 13 * * *`) |
| §10 route names (`/courses`, `/bsat`, `/vision`, `/dashboard/*`, `/student`, `/parent`) | Redirect to the existing pages (`next.config.mjs`) |
| Website form → de-duplicated CRM lead | Done. A new lead has no telecaller until it is qualified (rule A); the admission manager owns the unassigned queue |
| Logo everywhere | **Done**: the official logo in the header, footer, favicon, app icons, both login screens, the chat widget, receipts, ID cards and report cards (all read `college.logoSrc`) |
| Demo logins | Local development: the `/crm/login` role picker (one sample user per role, no password). **TODO:** seeded Supabase Auth accounts per role; needs the service role key, and demo passwords must not be used on the hosted project |
| **TODO** Eduten-style practice (`/dashboard/practice`): question bank, auto-marking, XP/badges/streaks, goals, misconception report, teacher analytics, parent report | Not built. Today: online tests with auto-marking in the app (`/app/tests`) and teacher test analytics (`/crm/academics`) |
| Staff college assistant (`/crm/college-assistant`, alias `/dashboard/ai-assistant`) | **Done.** College ID / roll number or name → full profile (programme, batch, previous school, board, parents and phones, attendance and recent absences, every test with rank and trend, fees paid/outstanding/overdue and receipts, hostel room or bus, mentor notes, admission sign-offs). Questions: “students below 75% attendance in JEE batch A”, “fee defaulters”, “compare Rahul’s last 3 tests”, “Hot leads not called today”. Answers come only from fixed, parameterised lookups (`lib/staffAssistant/parse.ts`) over the records, so nothing is invented; “not found” otherwise. Same scoping as the CRM (faculty their batches, masked phones without `phone.view`). Every question goes to `ai_query_audit` (who, what, when, which students), visible to Management, Principal and Super Admin. Tested in `lib/staffAssistant/*.test.ts`. **TODO:** an LLM layer on top of the same tools for free-form phrasing, and pgvector RAG over notes and circulars |
| **TODO** Sample seed of 60 leads / 40 students with 30 days of attendance and 6 tests on Supabase | Local: **Load demo leads** fills every queue and admits sample students. Hosted seed not loaded |
| Gurukul/Raion back office | **Done.** Library (`/crm/library`: catalogue, issue with copy limits, 14-day loans, overdue days, return), events calendar (`/crm/events`), homework per batch (`/crm/homework`, teachers only for their own batches), printable report card (`/crm/students/[id]/report-card`, save as PDF), Excel exports (`/crm/exports`: students, attendance, leads, dues, library loans; each needs its own permission, phones masked as on screen). Already built: admissions, profiles, batches, attendance, timetable, tests/marks, fees/dues/receipts, staff and roles, notices, transport, hostel, WhatsApp, leave, PTM, out-pass, siblings. New permissions `homework.assign`, `library.manage`, `events.manage` are editable in the matrix. Tested in `lib/school/backoffice.test.ts` |
| About Us from bhargavajuniorcollege.com | **Done**: society, address, phones, email, hours, Dr. G. V. Venkat Ramana’s credentials, vision, mission, “what sets us apart” and the four programmes (`content/college.ts`, checked 4 Nov 2026). `/vision` opens the Vision section |

## Not built / known limits

- **Native Flutter apps (§9):** the Student & Parent app is an installable PWA on the same backend. Push notifications, biometric unlock and offline mode are not built; WhatsApp alerts cover notifications for now.
- **Live classes:** live and recorded classes are links (any meeting or video platform). There is no built-in video.
- **AI doubt helper, adaptive tests, ML lead scoring, the voice agent, multi-campus `campus_id`, APAAR, WhatsApp Flows, UPI AutoPay and the open API (§12):** these are future-ready items and are not built. Early warnings use rules for now (`lib/school/logic.ts`).
- **Other §4 items not built:** a Kanban view and fully translated page bodies (only the site chrome is translated).
- **Staff sign-in email changes:** not possible; deactivate the account and add a new one.
