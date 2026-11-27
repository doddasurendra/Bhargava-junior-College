import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crest } from '@/components/ui';
import { LangSwitch } from '@/components/HeaderControls';
import { college } from '@/content/college';
import { CONSENT_PURPOSES } from '@/lib/app/service';
import { sDict } from '@/lib/app/signupText';
import { getLang } from '@/lib/i18n-server';
import { ParentRegisterForm } from '../RegisterForms';
import { StudentSignUpForm } from '../StudentSignUp';

export const metadata: Metadata = { title: 'Sign up · Student & Parent app', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Date-of-birth picker limits: students are 14–25 years old. */
function dobRange() {
  const t = new Date();
  const y = (n: number) => new Date(Date.UTC(t.getUTCFullYear() - n, t.getUTCMonth(), t.getUTCDate())).toISOString().slice(0, 10);
  return { minDob: y(26), maxDob: y(14) };
}

export default function RegisterPage({ params }: { params: { kind: string } }) {
  if (params.kind !== 'student' && params.kind !== 'parent') notFound();
  const lang = getLang();
  const student = params.kind === 'student';
  const d = sDict(lang);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="flex justify-end"><LangSwitch current={lang} label="Language" tone="light" /></div>
      <div className="text-center">
        <Crest size={72} className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl text-heading">{student ? d.title : 'Parent registration'}</h1>
        <p className="mt-1 text-sm text-muted">{college.name}</p>
        <p className="mt-2 text-xs text-muted">
          {student ? d.sub : 'For parents and guardians of admitted students.'}{' '}
          <Link href={student ? '/app/login?as=parent' : '/app/register/student'} className="underline">{student ? d.parent : 'I’m a student'}</Link>
        </p>
      </div>
      <div className="card mt-6 p-5">{student ? <StudentSignUpForm d={d} purposes={CONSENT_PURPOSES} {...dobRange()} /> : <ParentRegisterForm />}</div>
      {!student && <p className="mt-6 text-center text-sm">Already registered? <Link href="/app/login" className="underline">Sign in</Link></p>}
    </main>
  );
}
