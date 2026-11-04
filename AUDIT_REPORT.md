# Audit — 4 Nov 2026 (localhost:3000, commit after `3737013`)

**PASS: 59 / 73   PARTIAL: 14   MISSING: 0**

How each row was checked: **T** = automated test against the real store (`npm test`, 176+ tests), **L** = live request to the running app, **C** = clicked/read in Chrome, **DB** = queried the Supabase project, **Code** = read the implementation. Chrome froze several times under low memory (8 GB machine, ~1 GB free), so many rows rely on T/L instead of clicking.

## MISSING & PARTIAL (fix list, in priority order)
1. **S1** PARTIAL – tables exist (31, all RLS) but not with the §11 names; academics/campus data lives in the server-only `records` table.
2. ~~S3~~ fixed – owner-required, stage-history and College ID gate triggers in the database.
3. **S4** PARTIAL – Supabase now has 60 sample leads (`supabase/seed_sample_leads.sql`) + visit slots + BSAT sessions. 40 students and 300 questions are not seeded: students need staff profiles, which need Supabase Auth accounts (service role key).
4. ~~C8~~ fixed – dedicated `ai_query_audit` table with RLS in Supabase.
5. ~~A7~~ fixed – allocation by school and by area added.
6. **A17** PARTIAL – receipts are auto-numbered and print / save as PDF with the logo; no generated PDF file or WhatsApp delivery.
7. **D4** PARTIAL – "Send 7 PM report now" button added; the daily run is Vercel Cron `30 13 * * *` (`vercel.json`), not Supabase pg_cron.
8. **L1** PARTIAL – 20 account types (16 staff roles + student/parent/applicant/alumni) and one sample user per role in the local sign-in; no Supabase Auth demo accounts or demo passwords in README (needs the service role key; demo passwords on the hosted project would be unsafe).
9. **L4** PARTIAL – phone OTP and email/password are built; email/password needs Supabase Auth (service role key); OTP is logged, not sent, until WhatsApp/SMS credentials exist.
10. **C5** PARTIAL – weak chapters, counsellor notes and scholarship added; **photo, SSC marks, email and full address are not captured by the admission form** (shown as "not recorded").
11. **C7** PARTIAL – fixed parameterised lookups, "not found" for unknown IDs (T); **no pgvector RAG** over notes/circulars.
12. **G1** PARTIAL – every back-office module exists except **SMS** (WhatsApp is built; MSG91 not).
13. ~~G2~~ fixed – parent portal complete, including leave application.
14. **G3** PARTIAL – Gurukul modules matched except **Branches** (multi-campus) and biometric punch reconciliation.
15. ~~E9~~ fixed – school-wide practice statistics.
16. ~~E1–E8, E10~~ fixed – Eduten-style practice: `/app/practice` (student/parent) and `/crm/practice` (teacher/heads).
17. **W1** PARTIAL – home has everything except a **gallery** section (gallery is on `/campus`) and testimonial text (college must provide).
18. **B3** PARTIAL – About has society, motto, vision, mission, Dr. G. V. Venkat Ramana, programs, address, phones, email, hours; **testimonial quotes** are not provided by the college yet.
19. **S7** PARTIAL – code on GitHub, `.env*` not committed, secret scan clean; **repository visibility (private) not verified** from here.
20. **S8** PARTIAL – all migrations applied to Supabase; no edge functions (the app uses Next.js API routes); seed partial (S4).

## Gurukul / Raion Connect modules seen (G0)
Opened https://projectgurukul.vercel.app/ in Chrome: **Dashboard** (Today with exceptions first: unmatched biometric punches, offline gate device, overdue dues, expiring packages, overdue enquiry follow-ups, grading today; collections, outstanding dues, attendance today, active students), **Trends**, **Branches**, **Enrol student**, **Students**, **Fees**, **Classes**, **Grading & Events**, **Operations**, **Reports**, **Settings**.
Ours: dashboard backlog tiles + 7 PM report (exceptions first), students, fees/dues/receipts, batches & timetable, tests/results + events calendar, hostel/transport/front desk/library, reports & exports, permissions/CMS/settings. Not built: Branches, punch reconciliation.

## Full table
| ID | Item | Status | Evidence | What is missing |
|---|---|---|---|---|
| B1 | Logo everywhere | PASS | C: header, `/login` cards; `college.logoSrc=/logo.png` used by footer, favicon, manifest, both sign-ins, chat widget, CRM sidebar, receipts, ID card, report card | — |
| B2 | Colours, fonts, dark mode | PASS | Code: `app/layout.tsx` Marcellus/Figtree/IBM Plex Mono; navy/maroon/gold tokens; theme toggle | — |
| B3 | About page details | PARTIAL | L/C: `/about` (vision text found) | testimonial quotes |
| B4 | Old-site menu pages | PASS | L: `/`, `/courses`→`/programs`, `/about`, `/vision`→`/about#vision`, `/contact`, `/downloads` | — |
| A1 | Admission system page | PASS | C: `/admission-system` text: flowchart + 5A/5B loop, colour key, 10 stages exact, principle | — |
| A2 | CSV import with mapping | PASS | T: `lib/crm/importer.test.ts`; `/crm/import` | — |
| A3 | Lead fields | PASS | Code: `CrmLead` + lead page | — |
| A4 | De-dup by phone | PASS | T: `file.test.ts` "dedupes leads by phone"; DB unique index | — |
| A5 | Qualify before allocation | PASS | T: `lib/crm/allocation.test.ts` | — |
| A6 | Data-quality report | PASS | Code: dashboard "Data quality" by source and school | — |
| A7 | Allocation modes | PASS | T: `allocation.test.ts` groupedRoundRobin; manual, round-robin, **by school, by area** (one telecaller per school/area, load-balanced), reason on reassign | — |
| A8 | Mandatory call outcome | PASS | Code/T: `validateCall` in `lib/crm/rules.ts` | — |
| A9 | Follow-up date mandatory | PASS | Code: rules.ts "Set the next follow-up date and time." | — |
| A10 | Follow-up queues | PASS | Code: queues today/overdue/upcoming/escalated; `/dashboard/followups`→`/crm` | — |
| A11 | Campus visit flow | PASS | T: slot capacity test; check-in, outcome, 24 h flag (`visitFlag`) | — |
| A12 | Counselling record | PASS | Code: `recordCounselling`, outcome form | — |
| A13 | Decision rules | PASS | Code: `validateDecision` (lost→reason, pending→date) | — |
| A14 | Post-visit pipeline | PASS | Code: statuses visited→counselled→decision_pending→confirmed/lost | — |
| A15 | Ageing + escalation | PASS | T: `metrics.test.ts` escalated48; follow-up ageing | — |
| A16 | Verification gate | PASS | T: "refuses the College ID until every step"; DB `issue_college_id` | — |
| A17 | Receipt PDF | PARTIAL | Code: receipts auto-numbered, printable with logo | generated PDF / delivery |
| A18 | Accountability + audit | PASS | Code/T: `lead_audit` on every change, sign-offs record owner | — |
| D1 | 10 parameters | PASS | Code: `DailyParameters` | — |
| D2 | Periods + filters | PASS | C: Today/MTD/Season, program/source/school/owner filters | — |
| D3 | Widgets | PASS | Code: funnel, losses, quality mix, overdue 48 h, owners table, no-shows, seats vs target | — |
| D4 | Send 7 PM report + schedule | PARTIAL | Code: new "Send 7 PM report now"; `vercel.json` 30 13 * * * | pg_cron schedule |
| W1 | Home sections | PARTIAL | C/L: `/` | gallery on home, testimonial text |
| W2 | Results filter | PASS | L: `/results` 200 | — |
| W3 | Course finder + programs | PASS | L: `/course-finder`, 4 program pages | — |
| W4 | BSAT | PASS | L: `/scholarship` (alias `/bsat`); T: hall ticket | — |
| W5 | Fees + calculator | PASS | L: `/fees` | — |
| W6 | Hostel | PASS | L: `/hostel` | — |
| W7 | Visit booking | PASS | T/L: `/visit`, no Sundays | — |
| W8 | Track admission | PASS | L: `/track` | — |
| W9 | Resources, mock test, estimator | PASS | L: `/resources`, `/mock-test`, `/predictor` | — |
| W10 | Faculty, blog, downloads, careers, contact | PASS | L: all 200 | — |
| W11 | Mobile bar, WhatsApp, languages, theme | PASS | Code/C | page bodies translated only in site chrome |
| W12 | Forms → leads with source/UTM | PASS | C: callback → CRM lead "Callback"; T | — |
| E1 | Practice bank + gamification | PASS | T: `lib/practice/practice.test.ts` — 310 generated questions (Maths 80, Physics 80, Chemistry 80, Biology 70), answers computed; XP by difficulty, levels, streaks, badges, class leaderboard; `/app/practice` | — |
| E2 | Weekly program | PASS | T: `service.test.ts` sets per batch/week shown on `/app/practice`; teacher assigns at `/crm/practice` | — |
| E3 | Goals | PASS | T: weekly goal (questions + accuracy) with progress | — |
| E4 | Auto-marking with solutions | PASS | T: `mark()` instant marking, worked solution and the misconception behind a wrong pick | — |
| E5 | Misconception analysis | PASS | T: "students who need help on X" (same wrong-option misconception by 2+ students) at `/crm/practice` | — |
| E6 | Differentiation | PASS | T: one click splits a batch into easy/medium/hard by chapter accuracy; each student sees only their level | — |
| E7 | Teacher analytics, lesson plans | PASS | T: per-student questions, accuracy, XP, streak, weak chapters; lesson plan with % done | — |
| E8 | Curriculum mapping | PASS | T: every question tagged TS Inter / JEE Main / NEET + chapter; mapping table on `/crm/practice` | — |
| E9 | School-wide stats | PASS | T: `schoolStats` — totals, accuracy, active students, by subject, by batch, weakest chapters (principal/management) | — |
| E10 | Parent report one click | PASS | T: "Share with parent" writes a plain-language report the parent sees on `/app/practice` | — |
| G0 | Gurukul modules listed | PASS | C: list above | — |
| G1 | Back office modules | PARTIAL | T: `lib/school/backoffice.test.ts`; routes | SMS |
| G2 | Parent portal | PASS | `/app/*`; homework, events, report card, practice progress, **leave application** (`/app/leave`, decided by class teacher/principal; T: backoffice.test) | — |
| G3 | Gurukul parity | PARTIAL | list above | Branches, punch reconciliation |
| C1 | Public chatbot answers | PASS | T: `assistant.test.ts`; EN/TE/HI, chips, handoff | — |
| C2 | Chatbot actions | PASS | T: save_enquiry, book_visit, check_application | — |
| C3 | No student data in chatbot | PASS | T: private status answer, OTP only | — |
| C4 | Staff assistant protected | PASS | L: `/dashboard/ai-assistant`→307→sign-in; T: front desk refused | — |
| C5 | Full profile by roll | PARTIAL | T: `service.test.ts` profile for BJC-2027-JEE-0001; now also weak chapters (T: `insights.test.ts`), counsellor notes, scholarship/concessions, area | photo, SSC marks, email, full address (not captured by the admission form; shown as "not recorded") |
| C6 | Plain-language queries | PASS | T: `parse.test.ts` all four examples | — |
| C7 | SQL tools + RAG, not found | PARTIAL | T: "not found" for unknown ID | pgvector RAG |
| C8 | Security + audit | PASS | T: masking, faculty scoping, audit rows; DB: `ai_query_audit` table, RLS on, heads-only read policy, no insert for anon/authenticated; server writes it when Supabase is connected | — |
| L1 | Roles + demo accounts | PARTIAL | `/login` 20 types (T: `loginTypes.test.ts`); local sample users | Supabase demo accounts |
| L2 | Role → own dashboard | PASS | C: Admission Manager, Content & Marketing sign-ins; `homeFor` | — |
| L3 | Own data only | PASS | T: scoping tests; DB RLS policies | — |
| L4 | OTP + email/password | PARTIAL | Code | live Supabase Auth, OTP delivery |
| L5 | Role + sibling switcher | PASS | Code: `RoleSwitcher`, app profile switch; T sibling test | — |
| S1 | Tables as migrations | PARTIAL | 19 migrations in `supabase/migrations` | §11 table names |
| S2 | RLS on every table | PASS | DB: 31/31 tables `rowsecurity=true` | — |
| S3 | Triggers | PASS | DB: `admission_stage_events_owner` (owner required), `leads_stage_history` (stage history), `leads/students_college_id_gate` (College ID gate even on direct UPDATE) — verified live in a rolled-back transaction; de-dupe via unique index + `capture_lead` | — |
| S4 | Seed data | PARTIAL | DB: 60 leads, 4 slots, 3 BSAT sessions, 20 roles | 40 students, 300 questions |
| S5 | Generated TS types | PASS | `types/database.ts` from the live schema | — |
| S6 | Build 0 errors | PASS | `npm run build` + `tsc --noEmit` clean | — |
| S7 | GitHub, no secrets | PARTIAL | secret scan clean; only `.env.example` tracked | private visibility unverified |
| S8 | Supabase applied | PARTIAL | DB: all migrations + seed leads | edge functions, full seed |
