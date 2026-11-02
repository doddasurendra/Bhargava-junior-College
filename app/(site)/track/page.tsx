import type { Metadata } from 'next';
import { TrackAdmission } from '@/components/TrackAdmission';
import { PageHero, Section } from '@/components/ui';
import { STAGES } from '@/lib/admission';

export const metadata: Metadata = {
  title: 'Track your admission',
  description: 'Enter your mobile number to see every step of your admission at Bhargava Junior College, who owns it, and when you will hear next.',
  alternates: { canonical: '/track' },
  robots: { index: true, follow: true },
};

export default function TrackPage() {
  return (
    <>
      <PageHero eyebrow="Track your admission" title="Know exactly where your admission stands" intro="From enquiry to College ID, see each step, who is responsible for it, and when you will hear from us next." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <TrackAdmission />
          <div>
            <p className="eyebrow">The steps</p>
            <ol className="mt-4 space-y-3">
              {STAGES.map((s, i) => (
                <li key={s.key} className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-muted">{i + 1}</span>
                  <span>
                    <span className="block font-medium text-heading">{s.label}</span>
                    <span className="text-sm text-muted">{s.owner}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>
    </>
  );
}
