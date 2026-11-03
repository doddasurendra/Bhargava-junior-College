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

Open http://localhost:3000/crm. In local development (no Supabase) you sign in by picking one of the sample staff (brief §3.6), with no password. If the store is empty, **Load demo leads** fills every queue. With Supabase configured, staff sign in with email and password through Supabase Auth. The session is a signed, 10-hour, httpOnly cookie (`SESSION_SECRET`).

### Staff sign-in and 2FA (`lib/auth/`)

- **Two-step verification is required for Super Admin, Management and Accounts** (anyone with one of those roles). It uses any authenticator app with standard TOTP codes (6 digits, 30 seconds). On their first sign-in they scan a QR code, confirm one code and get **8 single-use recovery codes**, shown once only. Every later sign-in asks for a code. Other staff can turn 2FA on, and later off, from **My account**. The dev picker skips only the password; 2FA still applies.
- **Lockout:** after 5 wrong passwords or codes in a row, the account is locked for 15 minutes, unless a Super Admin unlocks it sooner. "Wrong email" and "wrong password" get the same message, so the form doesn't reveal who has an account.
- **Replay protection:** a code can't be reused, and ±30 s of phone clock drift is accepted. TOTP secrets are stored encrypted with AES-256-GCM (`MFA_ENCRYPTION_KEY`, or derived from `SESSION_SECRET`), and recovery codes are stored only as hashes.
- **Login audit:** every step is recorded, success or failure, with the reason, IP address and device. That covers password, dev picker, 2FA code, recovery code, 2FA setup, sign-out and admin actions. **Security** (`/crm/security`, Super Admin and Management) shows it next to everyone's 2FA status, recovery codes left and locks. A failed audit write is logged loudly but doesn't block the sign-in.
- **Lost phone:** sign in with a recovery code, or ask *another* Super Admin to **Reset 2FA**. That needs a reason, is audited, signs the user out everywhere, and makes them set up 2FA again at their next sign-in. A Super Admin can't reset their own 2FA, so keep at least two Super Admins, or keep the recovery codes safe.
- **Sessions:** **My account → Sign out everywhere else** ends every other session. A session cookie without the 2FA step completed is refused for 2FA roles, even if it is still valid. So existing Accounts and Super Admin sessions have to sign in again after this release.
- Supabase: `supabase/migrations/20261103050000_staff_auth.sql` (the `staff_auth` table, extra `login_audit` columns, and atomic RPCs for failure counting, code replay and recovery codes).
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

**Not yet:** direct .xlsx upload, Kanban view, a data-quality report (category mix by school and source), click-to-call telephony and recordings, WhatsApp/SMS templates and campaigns, the AI-handoff chat inbox, the verification checkpoint (documents → fee → receipt → student record → College ID), the staff mobile app, and the 7 PM report (§8 is missing from the brief).

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
