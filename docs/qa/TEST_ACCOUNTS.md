# QA test accounts: provisioning and clean-up

Passwords and the QA OTP code are **never in git**. They live only in the developer's `.data/DEVELOPER_CREDENTIALS.md`
(gitignored). This page says how the accounts are made, what exists, and how to remove them.

## What exists on the live Supabase project

**Staff: 19 accounts, one per staff role.** These are real Supabase Auth users: confirmed email identity, bcrypt password, profile and role rows.

| Role key | Email | Lands on |
|---|---|---|
| developer | qa.developer@bjc.demo | /crm/developer |
| super_admin | qa.super-admin@bjc.demo | /crm |
| management | qa.management@bjc.demo | /crm/dashboard |
| principal | qa.principal@bjc.demo | /crm/academics/overview |
| faculty | qa.faculty@bjc.demo | /crm/academics/my-classes |
| class_teacher | qa.class-teacher@bjc.demo | /crm/mentor |
| academic_coordinator | qa.academic-coordinator@bjc.demo | /crm/academics |
| admission_manager | qa.admission-manager@bjc.demo | /crm |
| telecaller | qa.telecaller@bjc.demo | /crm |
| admission_counsellor | qa.admission-counsellor@bjc.demo | /crm |
| front_desk | qa.front-desk@bjc.demo | /crm/front-desk |
| admission_office | qa.admission-office@bjc.demo | /crm/verification |
| accounts | qa.accounts@bjc.demo | /crm/accounts |
| admin_office | qa.admin-office@bjc.demo | /crm/students |
| hostel_warden | qa.hostel-warden@bjc.demo | /crm/hostel |
| transport_incharge | qa.transport-incharge@bjc.demo | /crm/transport |
| data_executive (Content & Marketing) | qa.data-executive@bjc.demo | /crm/cms |
| sports_coach | qa.sports-coach@bjc.demo | /crm/sports |
| student_counsellor | qa.student-counsellor@bjc.demo | /crm/wellbeing |

**Family app: 4 identities, created through the real workflows.**

| Role | Mobile | How it was created |
|---|---|---|
| Student | +91 90000 99101 | Admitted through the full CRM workflow (College ID BJC-2027-JEE-0001, receipt BJC/2027-28/00001). The student's own mobile was then added; from this release Admin Office can do that on the Student page. |
| Parent | +91 90000 99102 | Guardian number given at admission, so it was linked automatically when the College ID was issued |
| Applicant | +91 90000 99103 | Public enquiry form at /contact |
| Alumni | +91 90000 99104 | Admin Office → Alumni → "Move a passed-out student to alumni" |

QA academics: batch **QA JEE 1A** (class teacher QA Class Teacher, Physics period by QA Faculty, room QA-101); test **QA Physics Unit Test 1** (78/100, published).
Every QA record is named `QA …`, so it is easy to tell apart from real data.

## Family OTP before WhatsApp: developer test numbers

`lib/testOtp.ts` works like Firebase/Supabase test phone numbers. For the numbers in `TEST_OTP_NUMBERS` only, the sign-in code is
the secret `TEST_OTP_CODE`, and nothing is sent. Any other number behaves as before. With either variable missing, it is off.
Trivial codes (123456, 000000…) are refused. To enable it, add both variables in Vercel → Settings → Environment Variables
(values are in the credentials file). Remove them when the QA phase ends.

> Never put a real family's number in `TEST_OTP_NUMBERS`.

## Re-create or rotate the staff accounts

```bash
node scripts/qa-accounts.mjs        # writes .data/qa-accounts.sql, .md, .json with NEW random passwords
# run .data/qa-accounts.sql in the Supabase SQL editor (or via the Supabase MCP)
```

The script is idempotent: the same uuid per role, and the password is reset. E2E tests read `.data/qa-accounts.json`.

## Remove everything QA

The QA staff authored audit history (sign-offs, receipts, call logs), and those foreign keys block a plain delete, so
**switch the accounts off** instead. This keeps the audit trail intact:

```sql
update public.profiles set active = false where email like 'qa.%@bjc.demo';                        -- app refuses sign-in
update auth.users set banned_until = '2999-01-01' where email like 'qa.%@bjc.demo';                -- Supabase refuses too
```

QA family data (leads, students, payments…) is everything named `QA …` with phones `+91 90000 99xxx` / `+91 90000 92xxx`.
Delete it only from a reviewed list.
