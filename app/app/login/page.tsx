import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { getAppUser } from '@/lib/app/service';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in · Parent app', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppLoginPage() {
  if (await getAppUser()) redirect('/app');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <Crest size={84} className="mx-auto" />
        <h1 className="mt-4 font-display text-3xl text-heading">{college.name}</h1>
        <p className="mt-1 text-sm text-muted">Student & parent app</p>
      </div>
      <div className="card mt-8 p-5">
        <LoginForm />
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
