# Demo data report

Seeded with `npm run seed:demo` on 9 Nov 2026 (IST) into the **local development store** (`.data/dev-db.json`).
All dates are relative to the day the seed runs, so re-run it each day you demo. `npm run seed:demo:reset` re-creates the data; `npm run seed:demo:clear` removes it.
Every seeded row has an id starting with `demo-` and `seedBatch: "demo-2027"`. Phones are in the range +91 90000 00001–09999. All names and schools are invented.

**Safety:** the script refuses to run when `NODE_ENV=production` or when a Supabase service-role key is set. It never writes to Supabase, so production cannot be touched.

## Verified in the running app

| Check | Result |
|---|---|
| Management dashboard · Today (opened in the browser as Management) | **PASS**: 12 collected · 10 allocated · 26 calls · 8 interested · 5 visits scheduled · 3 actual visits · 3 counselling · 2 confirmed · ₹2,45,000 fees · 1 lost |
| `/app/login` "sign in as" panel → Rahul | **PASS**: signs in and opens the first-login data consent page (consent was not accepted on your behalf) |
| Idempotency | **PASS**: two runs in a row give the same counts (240 leads, 600 calls) |
| `npm run typecheck` | **PASS**: 0 errors |
| `npm run build` | **PASS**: 0 errors (12 Nov, with the student-life screens) |
| `npm test` | **PASS**: 208/208 (12 Nov) |
| Student-life screens in the browser | **NOT CHECKED**: the dev server on :3000 stopped responding after the production build; routes answer 307 (sign-in redirect) on a production server, but no screen was opened signed in |

## Seeded volumes (checked from the data file)

| Area | Seeded |
|---|---|
| Leads | 240 (Hot 50 · Warm 80 · Cold 70 · Invalid 15 · Unqualified 25); sources: School data 120, Website 45, Chat 20, BSAT 25, Walk-in 15, Referral 10, WhatsApp 5 |
| Leads created today | 12 (10 classified and allocated, 2 unqualified) |
| Calls | 600 (26 today), all with outcomes |
| Follow-ups | 14 due today (Priya 7, Ramesh 3, Divya 4); 9 overdue, 3 of them 48h+ including **Vikram S.** (Ramesh); the rest upcoming |
| Visits | 70: 49 held, 7 no-shows, 5 today (3 arrived, 2 expected), 10 upcoming |
| Decisions | 46 confirmed (40 admitted + 6 in verification), 9 pending (owner Anil), 22 lost with reasons (fees 7, distance 5, competitor 4, hostel 3, results 2, other 1) |
| Verification queue | 6 applications at different steps; **Karthik N.** has documents verified and a cash payment awaiting approval, so the fee step is not confirmed and no College ID can be issued |
| Students | 40 with College IDs: BJC-2027-JEE-0001…0020 and NEET-0001…0020; 24 hostellers (16 boys, 8 girls) and 16 day scholars on 3 routes |
| Guardians | 80 (father + mother); **K. Srinivas / K. Lakshmi** are parents of Rahul and Ananya |
| Fees | Instalment schedules for all 40; ₹2,45,000 approved today; 2 offline payments awaiting approval; 6 defaulters; Rahul: ₹2,34,500 total, ₹1,89,500 paid, ₹45,000 due on 10 Dec |
| Scholarships | 18 (BSAT slabs) |
| Academics | Batches JEE-A, JEE-B, NEET-A, NEET-B; 5-period timetable for 6 days with no faculty clashes; attendance for 50 school days (NEET-B not marked today); 5 students below 75%; 7 published tests per batch plus 3 upcoming; 2,500 practice attempts; 3 weekly goals each; syllabus progress; 25 homework assignments; 60 doubts (12 open, 5 Physics including Rahul's, 2 older than 24h) |
| Mentoring | Naresh 20 mentees, Swathi 20 (including Rahul: "Physics down 2 tests"), notes, 4 wellbeing flags, 6 PTM bookings |
| Hostel | 30 rooms (Rahul in **B-204**), 40 gate logs this week, 3 outpasses (Rahul's weekend pass waiting for the warden), 1 sick-room entry, night attendance, weekly mess menu |
| Transport | 3 routes with today's pickup attendance; Ananya on Route 3; Route 3 delay notice today |
| Other | 12 notices, 10 events (BSAT 16 Nov), 8 student + 3 staff leave requests (3 pending), 400 books (35 on loan, 4 overdue), 15 alumni (2 willing to mentor), 2 CSV import batches, 51 counselling records |
| Marketing / chat | Spend for Sept–Nov (Google, Meta, school events); 90 chats (20 linked to leads, 6 visit bookings, 8 handoffs to Anil); 300 WhatsApp messages; 25 college-assistant query log entries |
| Applicant | **Sneha Reddy**: Hot, BSAT hall ticket BSAT-27-1042, application with BSAT 82% → 45% scholarship, arrived today at 11:30 and counselled by Anil |
| Sports (Coach Ravi, `staff-coach`) | 4 houses (Rahul is Godavari captain); 13 fixtures: 8 inter-house played (points Godavari 10 · Krishna 6 · Tungabhadra 4 · Manjeera 3), 2 inter-house upcoming, inter-college cricket in 9 days, Sports Day in 19 days; 20 games-period registers (4 students never attended); 66 sign-ups; 36 fitness checks; 5 achievements (Rahul: silver, inter-college chess) |
| Speaker sessions | 3 sample speakers; 5 sessions: 2 past (motivational for all, alumni talk for JEE-A) with 83 registrations in total and 27 feedback ratings (**Rahul attended but has not rated yet**, so his app shows the feedback form), 3 upcoming (toppers' interaction, parent seminar, NEET-A exam-strategy workshop) on the Events calendar |
| Wellbeing (Ms. Deepa, `staff-counsellor`) | 32 students consented (Rahul shares a summary with parents; **Ananya has not consented**, so her app shows the privacy note); 157 weekly check-ins over 6 weeks; 2 students with high stress 2 weeks running → mentor flag + counsellor notes; 4 counsellor bookings (requested, confirmed, done, cancelled); 4 anonymous questions (2 answered). No safety alerts are seeded |
| Open-book | 9 questions (Physics, Chemistry, Biology) with the 10-mark rubric; 3 assignments: JEE-A Chemistry (closed, all marked; Rahul 17/20), JEE-A Physics (open now; 4 submitted, 2 marked; **Rahul can start it**), NEET-A Biology (open now, 3 submitted); 2 big questions this week, 5 answers, 2 featured |

## New screens (sports, speaker sessions, wellbeing, open-book)

| Login | Screen |
|---|---|
| Sports Coach (`/crm/login?as=sports_coach`) | `/crm/sports`: houses, points table, fixtures and results, attendance, fitness, achievements |
| Student Counsellor (`/crm/login?as=student_counsellor`) | `/crm/wellbeing`: bookings, anonymous questions, high-stress list, flags, student files and notes (every view is written to the access log) |
| Principal / Management | `/crm/wellbeing`: anonymous trends only (cells under 3 check-ins hidden) and safety alerts; Student-life tiles on the summary dashboard |
| Principal, Academic Coordinator, Content & Marketing | `/crm/sessions`: speakers, scheduling, attendance, feedback report |
| Faculty / academic heads | `/crm/open-book`: question bank, assignments, AI-suggested + rubric marking, open- vs closed-book comparison, big question |
| Student (app) | `/app/sports`, `/app/sessions`, `/app/wellbeing` (consent → check-in, counsellor booking, anonymous question, helplines), `/app/open-book` (honesty pledge → attempt at `/app/open-book/[id]`) |
| Parent (app) | `/app/sports` (child's house, results, medals), `/app/sessions` (parent seminars), `/app/wellbeing` (summary only if the student shares it), `/app/open-book` (marks) |

**Supabase (12 Nov 2026):** migration `student_life` applied to the project in `.env.local` (adds the Sports Coach and Student Counsellor roles). `public.records` has RLS on with 0 policies: a request with the anon key for `wellbeing_checkins`, `counsellor_notes` and `anon_questions` returned `[]`. The remote project has no rows yet, so this confirms deny-all but not a blocked read of real data.

## Not done or different from the brief

- **Not clicked through for every login.** Only Management and the app's Rahul button were opened in the browser; the PC ran out of memory and Chrome froze. Every other login is FAIL until checked by hand. Each role's data is in the store, but those screens were not looked at.
- **Confirmed decisions are 46, not 32.** 40 College IDs plus 6 in verification need 46 confirmations; 32 would contradict the rest of the brief.
- **Rank 7/120 is not possible:** there are 10 students per batch, so ranks are out of 10. Rahul's weekly test 6 is exactly 248/300.
- **Attendance uses 50 days, not 30.** 94% is not reachable with 30 days; Rahul is 47/50.
- **Receipt numbers** follow the app's configured format `BJC/2027-28/00001`, not `BJC/RCPT/2027/…`.
- **Not seeded:** testimonial texts (CMS), knowledge-base articles, voice sessions, parent-counselling guide answers, blog posts. Their storage formats were not checked, so writing them risked breaking those pages.
- **No "Re-seed / Clear demo data" buttons** in the Developer screen. Use the npm commands.
- **Supabase:** the demo data stays in the local store (`npm run seed:supabase` is a separate, allow-listed step). The student-life migration was applied through the Supabase connector, since the Supabase CLI is not installed here. There is no test OTP 123456: in local development the code is shown on screen, and the sign-in panel skips the OTP.
- The pre-existing "Test Parent QA" lead adds one to the unqualified, unassigned and overdue counts.
