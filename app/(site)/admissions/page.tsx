import type { Metadata } from 'next';
import Link from 'next/link';
import { LeadForm } from '@/components/forms';
import { Check, PageHero, Section } from '@/components/ui';
import { college } from '@/content/college';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = {
  title: `Admissions ${college.admissionsOpen}: process and documents`,
  description: 'How admission works at Bhargava Junior College: enquiry, campus visit, counselling, application, document verification, fee payment and College ID.',
  alternates: { canonical: '/admissions' },
};

const steps = [
  { title: 'Enquire or book a visit', body: 'Fill any form on this site, call, or WhatsApp us. You get one named contact person.' },
  { title: 'Campus visit and tour', body: 'See the classrooms, labs, library and hostel.' },
  { title: 'Counselling', body: 'Academic plan, faculty, fees and scholarship options, explained for your child.' },
  { title: 'Application', body: 'Complete the application with the admission counsellor.' },
  { title: 'Document verification', body: 'The admission office checks the documents listed below.' },
  { title: 'Fee payment and receipt', body: 'Pay online or at the office. You get an official receipt on WhatsApp and email.' },
  { title: 'College ID', body: 'Once every step is signed off, the College ID is issued and the student and parent app is unlocked.' },
];

export default async function AdmissionsPage() {
  const admissionDocuments = (await getContent()).documentChecklist.default.map((d) => d.label);
  return (
    <>
      <PageHero eyebrow={`Admissions ${college.admissionsOpen}`} title="How admission works" intro="Seven clear steps. You can track each one online, with the person responsible and the date.">
        <div className="flex flex-wrap gap-3">
          <Link href="/visit" className="btn-gold">Book a campus visit</Link>
          <Link href="/track" className="btn-outline-light">Track your admission</Link>
        </div>
      </PageHero>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="card flex gap-4 p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy font-mono text-sm font-semibold text-gold-300">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-heading">{s.title}</span>
                  <span className="text-[15px] leading-6 text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="card p-6">
              <p className="font-semibold text-heading">Documents required</p>
              <ul className="mt-3 space-y-2.5">
                {admissionDocuments.map((d) => (
                  <li key={d} className="flex gap-3 text-[15px]">
                    <Check />
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">The final checklist depends on the program. DigiLocker fetch will be offered where possible.</p>
            </div>
            <div id="enquire" className="card p-6">
              <LeadForm source="enquiry" heading="Start your admission" submitLabel="Request a callback" showClass />
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
