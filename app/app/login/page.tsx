import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FAMILY_LABELS, FAMILY_TYPES, type FamilyType } from '@/content/loginTypes';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { getAppUser } from '@/lib/app/service';
import { LoginForm } from './LoginForm';
import { CollegeIdForm } from './CollegeIdForm';

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
            {as === 'student' ? 'Use your mobile number, or your College ID and password below.' : as === 'applicant' ? 'Use the mobile number you enquired with.' : 'Use the mobile number registered with the college.'}{' '}
            <Link href="/login" className="underline">Choose another role</Link>
          </p>
        )}
      </div>
      <div className="card mt-8 p-5">
        <LoginForm />
        <CollegeIdForm />
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Use the mobile number registered with the college. Applicants can sign in to follow their admission. Trouble signing in? Call{' '}
        <a className="font-mono" href={`tel:${college.phones[0].tel}`}>
          {college.phones[0].display}
        </a>
        .
      </p>
    </main>
  );
}
