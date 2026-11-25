# Manual testing checklist: every role, one by one

Site: https://bhargava-junior-college.vercel.app · Staff login: `/crm/login` · Family login: `/app/login`
Credentials: `.data/DEVELOPER_CREDENTIALS.md` (private). Status values: **PASS · FAIL · FIXED · PENDING · BLOCKED**.
"Auto" means the automated E2E run of 2026-11-25 on the live site (see TEST_REPORT.md). Fill in "Manual" yourself.

## For every staff role (do these first)

1. Open `/crm/login` and enter the role's email and temporary password. **Expected:** you land on the role's dashboard (table below).
2. Click every item in the left menu. **Expected:** no error page and no "No access" page from a menu link.
3. Open `/crm/developer` and `/crm/security` (unless you are Developer or Super Admin). **Expected:** "No access" / "Only the Developer role…".
4. Sign out (bottom of the menu), then open `/crm`. **Expected:** you are sent back to the login page.
5. Wrong password once. **Expected:** "incorrect" message; the account is not locked after a single attempt.

| # | Role | Dashboard | Auto | Manual |
|---|---|---|---|---|
| 1 | Developer | /crm/developer | PASS | |
| 2 | Super Admin | /crm | PASS | |
| 3 | Management / Director / Chairman | /crm/dashboard | PASS | |
| 4 | Principal | /crm/academics/overview | PASS | |
| 5 | Faculty / Teacher | /crm/academics/my-classes | PASS | |
| 6 | Class Teacher / Mentor | /crm/mentor | PASS | |
| 7 | Academic Coordinator / Exam Cell | /crm/academics | PASS | |
| 8 | Admission Manager | /crm | PASS | |
| 9 | Telecaller | /crm | PASS | |
| 10 | Admission Counsellor | /crm | PASS | |
| 11 | Front Desk / Reception | /crm/front-desk | PASS | |
| 12 | Admission Office | /crm/verification | PASS | |
| 13 | Accounts | /crm/accounts | PASS | |
| 14 | Admin Office | /crm/students | PASS | |
| 15 | Hostel Warden | /crm/hostel | PASS | |
| 16 | Transport In-charge | /crm/transport | PASS | |
| 17 | Content & Marketing | /crm/cms | PASS | |
| 18 | Sports Coach | /crm/sports | PASS | |
| 19 | Student Counsellor | /crm/wellbeing | PASS | |

## Role-specific features

### Super Admin
- Staff accounts (`/crm/staff`): create a staff member, edit their roles, deactivate them. **Expected:** the new person gets an invite email *(needs Supabase SMTP; see pending)*. · PENDING
- Permissions (`/crm/permissions`): open the role matrix. **Expected:** it loads and changes are audited. · PASS (opens)
- "View as" (`/crm/view-as`): view as QA Telecaller. **Expected:** read-only banner; nothing can be saved. · PENDING manual
- Security (`/crm/security`): backup status and download. · PASS (opens)

### Developer
- Developer console (`/crm/developer`): system checks, integrations status. **Expected:** shows Supabase connected and WhatsApp "not configured". · PASS (opens)

### Admission Manager → Counsellor → Admission Office → Accounts → Admin Office (cross-role admission)
Do it with a new enquiry from `/contact`, using a QA number of your own such as 90000 93xxx.

| Step | Who | Action | Expected | Auto |
|---|---|---|---|---|
| 1 | Public | /contact "Send enquiry" | "Thank you"; the lead appears in Leads | PASS |
| 2 | Admission Manager | Open lead → Hot → Assign to QA Admission Counsellor | "Saved." then "Assigned 1 lead." Assigning before qualifying is refused | PASS |
| 3 | Counsellor | Log a call: Connected + interest Hot | "Call logged." | PASS |
| 4 | Public | /visit: book a slot for the same mobile | "Visit confirmed"; the lead shows the visit | PASS |
| 5 | Counsellor | Record counselling, then Admission decision = Confirmed | "Counselling recorded." "Decision recorded." The verification checkpoint appears | PASS |
| 6 | Counsellor | Mark application completed | Application step ticked | PASS |
| 7 | Admission Office | Mark 5 documents Verified + caste/income N/A, Sign off documents, Record payment ₹25,000 UPI | "Payment recorded. Accounts must approve it." | PASS |
| 8 | Accounts | Approve, Confirm fee payment, Generate official receipt | Receipt number BJC/2027-28/xxxxx | PASS |
| 9 | Admin Office | Create student record (DOB, guardian mobile), Generate College ID | College ID BJC-2027-JEE-xxxx; lead becomes Admitted; sign-offs can no longer be reversed | PASS |
| 10 | Admin Office | Student page: "Student's own mobile" → save | "Saved…"; a parent's number is refused | NEW: unit-tested; deploy pending |

### Academic Coordinator / Exam Cell
- Create batch, allot student, assign mentor, add timetable period. **Expected:** "Student allotted." "Mentor assigned." "Period added." · PASS
- Publish a test's results. **Expected:** the test shows "published"; only then can faculty send marks to parents. · PASS

### Faculty / Teacher
- My classes → batch → mark A + remark → Save attendance. **Expected:** "Attendance saved. 1 absent. 1 not sent…" A second save the same day is recorded as a correction. · PASS
- Create a test, enter marks, Save. **Expected:** "Marks saved". Private until the exam cell publishes. · PASS
- Try "Send marks to parents" before publishing. **Expected:** blocked with a message. · PASS

### Class Teacher / Mentor
- `/crm/mentor` shows mentees (QA Test Student). Add a mentor note. · PENDING manual

### Principal / Management
- Academics overview and dashboard load with live numbers; hostel and transport are read-only. · PASS (opens)

### Accounts
- `/crm/accounts`: the QA receipt BJC/2027-28/00001 is listed; download the receipt PDF. · PENDING manual (PDF)

### Front Desk
- Walk-in enquiry form creates a lead; the visitor log adds an entry. · PENDING manual

### Hostel Warden · Transport In-charge · Sports Coach · Student Counsellor · Content & Marketing
- Each home page opens and every menu link works. · PASS
- Warden: check-in/out for QA Test Student (hostel stay). Transport: bus alert (honest "not delivered"). Coach: record an event. Counsellor: a private wellbeing note. Marketing: publish a notice and see it on the site. · PENDING manual

## Family app (needs TEST_OTP_NUMBERS / TEST_OTP_CODE on Vercel; otherwise BLOCKED)

| # | Role | Steps | Expected | Status |
|---|---|---|---|---|
| 20 | Student | /app/login → 9000099101 → OTP → More → set password; sign out; College ID BJC-2027-JEE-0001 + password | Sees own College ID, attendance (25 Nov absent "fever"), results 78/100, homework | BLOCKED until env + deploy |
| 21 | Parent | /app/login → 9000099102 → OTP | Sees ONLY QA Test Student: attendance absent + remark, published marks 78/100, fee receipt BJC/2027-28/00001 | BLOCKED until env + deploy |
| 22 | Applicant | /app/login → 9000099103 → OTP | Admission tracker for the open enquiry | BLOCKED until env + deploy |
| 23 | Alumni | /app/login → 9000099104 → OTP → /app/alumni | Alumni network profile | BLOCKED until env + deploy |
| — | Student registration | /app/register/student: BJC-2027-JEE-0001, DOB 15-06-2010, mobile 9000099102 → OTP → email + password | Asks you to confirm by email. **Live: the email is not sent (no SMTP), so registration can't be finished.** | BLOCKED (SMTP) |
| — | Today on live | /app/login with any number | "Sign-in codes are not available right now" (no WhatsApp) | Verified (BLOCKED) |
