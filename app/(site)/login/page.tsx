import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section } from '@/components/ui';

export const metadata: Metadata = { title: 'Log in', description: 'One login for students, parents, applicants, alumni and staff of Bhargava Junior College.', alternates: { canonical: '/login' } };

const ROLES = [
  { title: 'Parent', body: 'Attendance, hostel alerts, results, fees and receipts, PTM booking and messages to the class teacher.', href: '/app/login', how: 'Mobile number + one-time code' },
  { title: 'Student', body: 'Timetable, study material, online tests and analytics, doubts, notices and your digital ID card.', href: '/app/login', how: 'Mobile number + code, or College ID + password' },
  { title: 'Applicant', body: 'Track your admission, online application, document upload, BSAT hall ticket and visit booking.', href: '/app/login', how: 'The mobile number you enquired with' },
  { title: 'Alumni', body: 'Your alumni profile, mentoring current students and referring families.', href: '/app/login', how: 'Mobile number + one-time code' },
  { title: 'Staff & faculty', body: 'Admissions CRM, academics, hostel, transport, accounts and the admin office.', href: '/crm/login', how: 'Work email + password (+ authenticator code)' },
  { title: 'Management', body: 'Executive dashboard, the 7 PM report, approvals and staff performance.', href: '/crm/login', how: 'Work email + password + authenticator code' },
];

/** §9A.1: one login page with a role picker; the account decides which dashboard opens. */
export default function LoginHub() {
  return (
    <>
      <PageHero eyebrow="Log in" title="Who is signing in?" intro="Pick your role. If one account has several roles or children, you switch between them inside without signing out." />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r.title}>
              <Link href={r.href} className="card block h-full p-5 transition hover:border-gold">
                <p className="font-display text-xl text-heading">{r.title}</p>
                <p className="mt-2 text-sm text-ink">{r.body}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">{r.how}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
