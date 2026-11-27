import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FAMILY_LABELS, FAMILY_TYPES, type FamilyType } from '@/content/loginTypes';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { getAppUser } from '@/lib/app/service';
import { LoginForm } from './LoginForm';
import { CollegeIdForm } from './CollegeIdForm';
import { DevSignIn } from './DevSignIn';
import { devLoginEnabled } from '@/lib/crm/auth';

export const metadata: Metadata = { title: 'Sign in · Student & Parent app', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppLoginPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (await getAppUser()) redirect('/app');
  const asParam = typeof searchParams.as === 'string' ? searchParams.as : null;
  const as = (FAMILY_TYPES as readonly string[]).includes(asParam ?? '') ? (asParam as FamilyType) : null;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <Crest size={84} className="mx-auto" />
        <h1 className="mt-4 font-display text-3xl text-heading">{college.name}</h1>
        <p className="mt-1 text-sm text-muted">{as ? `${FAMILY_LABELS[as]} sign-in` : 'Student & parent portal'}</p>
        {as && (
          <p className="mt-2 text-xs text-muted">
            {as === 'student' ? 'Sign in with your College ID (registration number) and password.' : as === 'applicant' ? 'Use the mobile number you enquired with.' : 'Use the mobile number registered with the college.'}{' '}
            <Link href="/login" className="underline">Choose another role</Link>
          </p>
        )}
      </div>
      {/* Students: College ID / registration number + password only (never a phone number) */}
      {as !== 'parent' && as !== 'applicant' && (
        <section className="card mt-8 p-5" aria-labelledby="student-signin">
          <h2 id="student-signin" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Students</h2>
          <CollegeIdForm />
        </section>
      )}
      {/* Parents, guardians and applicant families: mobile number + WhatsApp code */}
      {as !== 'student' && (
        <section className="card mt-4 p-5" aria-labelledby="family-signin">
          <h2 id="family-signin" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Parents &amp; applicants</h2>
          <LoginForm />
        </section>
      )}
      <p className="mt-4 text-center text-sm">
        New here? Register as a <Link href="/app/register/student" className="font-semibold underline">student</Link> or a <Link href="/app/register/parent" className="font-semibold underline">parent</Link>
      </p>
      {devLoginEnabled() && <DevSignIn />}
      <p className="mt-6 text-center text-xs text-muted">
        Students sign in with their College ID and password. Parents and applicants use the mobile number registered with the college. Trouble signing in? Call{' '}
        <a className="font-mono" href={`tel:${college.phones[0].tel}`}>
          {college.phones[0].display}
        </a>
        .
      </p>
    </main>
  );
}
