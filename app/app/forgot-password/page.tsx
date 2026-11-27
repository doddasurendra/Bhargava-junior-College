import type { Metadata } from 'next';
import Link from 'next/link';
import { Crest } from '@/components/ui';
import { LangSwitch } from '@/components/HeaderControls';
import { college } from '@/content/college';
import { sDict } from '@/lib/app/signupText';
import { getLang } from '@/lib/i18n-server';
import { StudentResetForm } from '../register/StudentSignUp';

export const metadata: Metadata = { title: 'Forgot password · Student app', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Students have no email or mobile on their account: a parent or the admin office gives a one-time code. */
export default function ForgotPasswordPage() {
  const lang = getLang();
  const d = sDict(lang);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="flex justify-end"><LangSwitch current={lang} label="Language" tone="light" /></div>
      <div className="text-center">
        <Crest size={72} className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl text-heading">{d.fTitle}</h1>
        <p className="mt-1 text-sm text-muted">{college.name}</p>
      </div>
      <section className="card mt-6 space-y-2 p-5 text-sm">
        <p>{d.fIntro}</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{d.fA}</li>
          <li>{d.fB} <a className="font-mono underline" href={`tel:${college.phones[0].tel}`}>{college.phones[0].display}</a></li>
        </ol>
      </section>
      <div className="card mt-4 p-5"><StudentResetForm d={d} /></div>
      <p className="mt-6 text-center text-sm"><Link href="/app/login?as=student" className="underline">{d.signin}</Link></p>
    </main>
  );
}
