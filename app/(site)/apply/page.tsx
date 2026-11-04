import type { Metadata } from 'next';
import Link from 'next/link';
import { LeadForm } from '@/components/forms';
import { PageHero, Section } from '@/components/ui';

export const metadata: Metadata = { title: 'Apply online', description: 'Start your admission to Bhargava Junior College: online application, document upload, fee payment and tracking.', alternates: { canonical: '/apply' } };

/** §4.2 row 15: the online application. Families start here; the full form, documents and fee payment live in the app under their mobile number. */
export default function ApplyPage() {
  return (
    <>
      <PageHero eyebrow="Admissions 2027–29" title="Apply online" intro="Three steps: register your mobile number, fill the application and upload documents in the app, then pay the fee. Every step is tracked with the owner and date." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <ol className="space-y-4 text-[15px]">
            {[
              ['Register', 'Give your name and mobile number. An admission counsellor calls you and you can book a campus visit.'],
              ['Fill the application', 'Sign in to the app with the same number (a one-time code arrives on WhatsApp), complete the form and upload the SSC memo, TC, study certificate, Aadhaar and photos.'],
              ['Confirm and pay', 'After counselling and document verification, pay the fee online or at the office. The receipt and then the College ID appear in the app.'],
            ].map(([t, b], i) => (
              <li key={t} className="card flex gap-4 p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon font-semibold text-white">{i + 1}</span><span><span className="block font-semibold text-heading">{t}</span>{b}</span></li>
            ))}
            <li className="text-sm">Already registered? <Link href="/app/login" className="font-semibold underline">Sign in to continue your application</Link>.</li>
          </ol>
          <div className="card p-6">
            <LeadForm source="application" heading="Start your application" submitLabel="Register and continue" showClass successTitle="You’re registered" successText={<>Next: <Link href="/app/login" className="font-semibold underline">sign in to the app</Link> with the same mobile number to fill the application and upload documents.</>} />
          </div>
        </div>
      </Section>
    </>
  );
}
