# Test report: 2026-11-25

Target: the live production site https://bhargava-junior-college.vercel.app (code at f510e4a) and Supabase project
nkhpah… (the only project; it holds demo data plus the QA accounts). The new code in this release (test OTP numbers,
student-mobile editing, E2E suite) has unit and build results only, because it is not deployed yet.

## Results (actually executed)

| Suite | Where | Passed | Failed | Notes |
|---|---|---|---|---|
| Unit tests (vitest) | local | 271 | 0 | 43 files, including new `lib/testOtp.test.ts` and the student-mobile test in `lib/app/app.test.ts` |
| Typecheck (`tsc --noEmit`) | local | ✓ | – | |
| Production build (`next build`) | local | ✓ | – | 146 pages |
| E2E staff roles (`tests/e2e/staff-roles.spec.ts`) | live | 21 | 0 | 19 roles: login → correct dashboard → every menu link (up to 45/role) → sign out. Plus wrong password and signed-out redirects. First run: 18/21 (3 hit a too-short test time limit, test fixed); the rerun of those 3 passed |
| E2E permissions (`tests/e2e/permissions.spec.ts`) | live | 11 | 0 | 11 roles refused on 1–5 restricted pages each |
| E2E admission workflow (`tests/e2e/admission-workflow.spec.ts`) | live | 8 | 1 | Steps 1–8 (enquiry → College ID) pass. Step 9 failed only on wording: a second save the same day says "Register corrected" (audited correction, correct behaviour). The test now accepts it; not re-run yet |
| Manual-scripted workflow (Playwright steps, verified in Supabase) | live | all | 0 | Enquiry, qualify, assign, call, visit, counselling, decision, 6 sign-offs, receipt BJC/2027-28/00001, College ID BJC-2027-JEE-0001, batch, mentor, timetable, attendance + remark, marks 78/100, exam cell publish, alumni |
| E2E family app (`tests/e2e/family.spec.ts`) | – | – | – | **Not run**: needs the test-OTP numbers deployed. On live, OTP sign-in returns "Sign-in codes are not available right now" (verified) |
| RLS probe (anon key + 4 staff tokens straight to Supabase REST) | live DB | ✓ | – | anon: 0 rows on 13 tables, insert refused (42501). Telecaller/Faculty: own profile only. No role can add itself to user_roles (42501) |

## Bugs and gaps found

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Supabase had **no login accounts at all**, so no one could sign in to the live CRM | Critical | **FIXED**: 19 QA staff accounts (one per role) created and verified |
| 2 | No staff UI to add or change a student's own mobile after admission: a student whose number wasn't on the enquiry can never OTP-sign-in | High | **FIXED in code** (Student page → "Student's own mobile", Admin Office only, parent numbers refused, audited); deploy pending |
| 3 | Family OTP sign-in impossible on live (no WhatsApp provider), so student, parent, applicant and alumni logins are all blocked | High | **Workaround in code**: developer test numbers (`lib/testOtp.ts`). Real fix: WhatsApp credentials |
| 4 | Student self-registration can't be finished on live: email verification needs SMTP (none configured) | High | **BLOCKED**: needs SMTP credentials |
| 5 | Sign-off buttons (application, documents, fee, receipt, student record, College ID) save correctly but show no confirmation message | Low (UX) | PENDING |
| 6 | Accounts / leadership roles can read all leads directly via the Supabase REST API with their own Supabase token (RLS `can_see_all_leads`). The app never uses those tokens and the anon key isn't exposed to browsers, so this is defense-in-depth only | Low | PENDING (hardening) |
| 7 | Supabase advisor: leaked-password protection is off; `has_any_role` SECURITY DEFINER is callable by signed-in users (returns only the caller's own role check) | Low | PENDING (dashboard setting) |
| 8 | Vercel Preview deployments have no environment variables (all 9 are Production-only), so a Preview can't reach Supabase | Medium | BLOCKED: needs the service-role key for Preview |

## Supabase verification

- 34 public tables, **RLS enabled on all 34**. 9 have no client policy, which makes them service-only (deny-all for anon/authenticated).
- 23 roles in `public.roles`. 19 QA profiles, each with exactly one role.
- Storage: buckets `applicant-docs` and `kb-files` are both private, with no client policies (server-only).
- Workflow data verified with SQL after each step: lead status/stage, `admission_stage_events` (6 stages), `lead_documents` (5 verified + 1 N/A),
  `payments` (approved, receipt BJC/2027-28/00001), `students` (College ID BJC-2027-JEE-0001), `student_guardians` (parent linked), alumni record.
- No migrations needed for this release (the new student-mobile feature uses the existing `students.login_phone`).
