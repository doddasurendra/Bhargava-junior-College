import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Crest, PageHero, Section } from '@/components/ui';
import { college } from '@/content/college';

export const metadata: Metadata = {
  title: 'About the college',
  description: `${college.name}, run by ${college.society}, led by ${college.leader.name}. Motto: ${college.motto}.`,
  alternates: { canonical: '/about' },
};

const commitments = [
  `At most ${college.maxBatchSize} students per batch, enforced by the system.`,
  `One mentor for every ${college.mentorRatio} students, with a weekly one-to-one.`,
  'A monthly stress check-in and an on-campus counsellor. Low scores lead to a private call with parents, never public rank shaming.',
  'A weekly report to parents on WhatsApp every Sunday: attendance, test trend and the mentor’s note.',
  'Parents can book PTMs and message the class teacher from the app.',
  'We never promise ranks or seats.',
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title={college.name} intro={`Run by ${college.society}. A single campus in Saroornagar, Hyderabad, focused on IIT-JEE and NEET alongside the TS Intermediate Board.`} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center">
          <Crest size={200} className="mx-auto h-40 w-40 sm:h-52 sm:w-52" />
          <div>
            <p className="eyebrow">Our motto</p>
            <p className="mt-2 font-display text-4xl text-heading">{college.motto}</p>
            <p className="lead-text mt-3">Growth through knowledge.</p>
          </div>
        </div>
      </Section>
      <Section eyebrow="Leadership" title={college.leader.name} className="bg-surface">
        <p className="lead-text">{college.leader.credentials}</p>
        <p className="mt-4 max-w-3xl text-sm italic text-muted">The leadership message, vision and mission will be added from the CMS.</p>
      </Section>
      <Section eyebrow="Our commitments" title="Personal attention on a single campus">
        <ul className="grid gap-4 md:grid-cols-2">
          {commitments.map((c) => (
            <li key={c} className="card flex gap-3 p-5">
              <Check className="mt-0.5" />
              <span className="leading-7">{c}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/visit" className="btn-primary">Book a campus visit</Link>
          <Link href="/admissions" className="btn-outline">Admission process</Link>
        </div>
      </Section>
    </>
  );
}
