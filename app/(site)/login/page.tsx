import type { Metadata } from 'next';
import Link from 'next/link';
import { Crest, PageHero, Section } from '@/components/ui';
import { LOGIN_GROUPS } from '@/content/loginTypes';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to Bhargava Junior College as a student, parent, applicant, alumnus, teacher, principal, management or any staff member.',
  alternates: { canonical: '/login' },
};

/** §9 multiple logins: every account type has its own entry; the account decides which dashboard opens. */
export default function LoginHub() {
  return (
    <>
      <PageHero eyebrow="Log in" title="Who is signing in?" intro="Choose your role. If you have several roles, or more than one child at the college, you switch between them inside without signing out." />
      {LOGIN_GROUPS.map((g, i) => (
        <Section key={g.title} title={g.title} intro={g.intro} className={i % 2 ? 'bg-surface' : ''}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-gold">
                  <span className="flex items-center gap-3">
                    <Crest size={32} className="h-8 w-8 rounded-full" />
                    <span className="font-display text-xl text-heading">{r.title}</span>
                  </span>
                  <span className="mt-3 flex-1 text-sm leading-6 text-ink">{r.body}</span>
                  <span className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{r.how}</span>
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-maroon group-hover:underline dark:text-gold">Log in →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      <Section>
        <p className="text-sm text-muted">
          New teacher or staff member? <Link href="/crm/login/register" className="underline">Request an account</Link>; the college administrator approves it before you can sign in. Principal, management, Super Admin and Developer accounts are created by the administrator only. Forgot your password? Use <Link href="/crm/login/forgot" className="underline">Forgot password</Link>. Admitted students and their parents can <Link href="/app/register/student" className="underline">register as a student</Link> or <Link href="/app/register/parent" className="underline">register as a parent</Link>, then sign in.
        </p>
      </Section>
    </>
  );
}
