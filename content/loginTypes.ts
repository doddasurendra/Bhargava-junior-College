/**
 * Every kind of account that can sign in (§9 multiple logins), grouped for the /login hub. Families use the
 * Student & Parent app (mobile OTP, or College ID + password for students); every staff role uses the CRM
 * (work email + password, with an authenticator code for Super Admin, Management and Accounts).
 */
export type LoginType = { key: string; title: string; body: string; how: string; href: string };
export type LoginGroup = { title: string; intro: string; items: LoginType[] };

export const FAMILY_TYPES = ['student', 'parent', 'applicant', 'alumni'] as const;
export type FamilyType = (typeof FAMILY_TYPES)[number];

const OTP = 'Mobile number + one-time code';
const STAFF = 'Work email + password';
const STAFF_2FA = 'Work email + password + authenticator code';

const app = (key: FamilyType) => `/app/login?as=${key}`;
const crm = (role: string) => `/crm/login?as=${role}`;

export const LOGIN_GROUPS: LoginGroup[] = [
  {
    title: 'Students & families',
    intro: 'The Student & Parent portal. One mobile number can hold several children or a sibling’s application; switch between them inside.',
    items: [
      { key: 'student', title: 'Student', body: 'Timetable, attendance, study material, online tests and results, homework, doubts, notices and your digital ID card.', how: 'Mobile + code, or College ID + password', href: app('student') },
      { key: 'parent', title: 'Parent / guardian', body: 'Attendance, marks and report cards, fee dues and receipts, hostel and bus alerts, PTM booking and messages to the class teacher.', how: OTP, href: app('parent') },
      { key: 'applicant', title: 'Applicant', body: 'Track your admission, fill the application, upload documents, BSAT hall ticket and campus visit booking.', how: 'The mobile number you enquired with', href: app('applicant') },
      { key: 'alumni', title: 'Alumni', body: 'Your alumni profile, mentoring current students and referring families.', how: OTP, href: app('alumni') },
    ],
  },
  {
    title: 'Developer',
    intro: 'Builds and maintains the platform: full access to the website content, the CRM, every role’s screens and the Student & Parent portal.',
    items: [
      { key: 'developer', title: 'Developer', body: 'Every permission, all website content, the developer console, environment status and every page of the website, CRM and portal.', how: STAFF_2FA, href: crm('developer') },
    ],
  },
  {
    title: 'Leadership',
    intro: 'Dashboards, approvals and the 7 PM report.',
    items: [
      { key: 'management', title: 'Management / Chairman', body: 'Executive dashboard with the 10 daily numbers, funnel, seats vs target, the 7 PM report, refunds and big concessions.', how: STAFF_2FA, href: crm('management') },
      { key: 'principal', title: 'Principal', body: 'Academic overview, results publishing, staff leave, notices, discipline and the college assistant.', how: STAFF, href: crm('principal') },
      { key: 'super_admin', title: 'Super Admin', body: 'Staff accounts, roles and permissions, security and login audit, website content.', how: STAFF_2FA, href: crm('super_admin') },
    ],
  },
  {
    title: 'Teaching staff',
    intro: 'Classes, attendance, tests and mentoring.',
    items: [
      { key: 'faculty', title: 'Faculty / teacher', body: 'My classes, attendance, tests and marks, homework, study material and student doubts.', how: STAFF, href: crm('faculty') },
      { key: 'class_teacher', title: 'Class teacher / mentor', body: 'Mentees with early warnings, mentor notes, parent calls, PTMs and parent messages.', how: STAFF, href: crm('class_teacher') },
      { key: 'academic_coordinator', title: 'Academic coordinator / exam cell', body: 'Batches, timetable, tests, results, report cards and the academic dashboard.', how: STAFF, href: crm('academic_coordinator') },
    ],
  },
  {
    title: 'Admissions team',
    intro: 'Leads, calls, follow-ups, visits and verification.',
    items: [
      { key: 'admission_manager', title: 'Admission manager', body: 'Qualify and allocate leads, escalations, decisions, concessions up to the scholarship slab.', how: STAFF, href: crm('admission_manager') },
      { key: 'telecaller', title: 'Telecaller', body: 'My leads, today’s calls and follow-ups, call outcomes and visit booking.', how: STAFF, href: crm('telecaller') },
      { key: 'admission_counsellor', title: 'Admission counsellor', body: 'Campus visits, counselling, admission decisions and post-visit follow-ups.', how: STAFF, href: crm('admission_counsellor') },
      { key: 'front_desk', title: 'Front desk / reception', body: 'Walk-ins, visit check-in, visitor log and gate passes.', how: STAFF, href: crm('front_desk') },
      { key: 'admission_office', title: 'Admission office', body: 'Applications, document verification and the College ID gate.', how: STAFF, href: crm('admission_office') },
    ],
  },
  {
    title: 'Office & operations staff',
    intro: 'Every other employee of the college.',
    items: [
      { key: 'accounts', title: 'Accounts', body: 'Payments, approvals, receipts, dues and reminders, Tally export.', how: STAFF_2FA, href: crm('accounts') },
      { key: 'admin_office', title: 'Admin office', body: 'Student records, ID cards and certificates, library, events calendar and parent app access.', how: STAFF, href: crm('admin_office') },
      { key: 'hostel_warden', title: 'Hostel warden', body: 'Rooms, night attendance, out-passes, sick room and hostel alerts to parents.', how: STAFF, href: crm('hostel_warden') },
      { key: 'transport_incharge', title: 'Transport in-charge', body: 'Buses, routes, bus attendance and live location.', how: STAFF, href: crm('transport_incharge') },
      { key: 'data_executive', title: 'Content & marketing', body: 'Website content, lead imports and marketing spend.', how: STAFF, href: crm('data_executive') },
    ],
  },
];

export const FAMILY_LABELS: Record<FamilyType, string> = { student: 'Student', parent: 'Parent / guardian', applicant: 'Applicant', alumni: 'Alumni' };
