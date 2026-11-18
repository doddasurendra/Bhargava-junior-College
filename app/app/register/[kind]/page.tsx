import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { ParentRegisterForm, StudentRegisterForm } from '../RegisterForms';

export const metadata: Metadata = { title: 'Register · Student & Parent app', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function RegisterPage({ params }: { params: { kind: string } }) {
  if (params.kind !== 'student' && params.kind !== 'parent') notFound();
  const student = params.kind === 'student';
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <Crest size={72} className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl text-heading">{student ? 'Student registration' : 'Parent registration'}</h1>
        <p className="mt-1 text-sm text-muted">{college.name}</p>
        <p className="mt-2 text-xs text-muted">
          {student ? 'For admitted students with a College ID.' : 'For parents and guardians of admitted students.'} <Link href={`/app/register/${student ? 'parent' : 'student'}`} className="underline">{student ? 'I’m a parent' : 'I’m a student'}</Link>
        </p>
      </div>
      <div className="card mt-6 p-5">{student ? <StudentRegisterForm /> : <ParentRegisterForm />}</div>
      <p className="mt-6 text-center text-sm">Already registered? <Link href="/app/login" className="underline">Sign in</Link></p>
    </main>
  );
}
