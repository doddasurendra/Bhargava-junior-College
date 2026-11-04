import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Crest, PageHero, Section } from '@/components/ui';
import { college, fullAddress } from '@/content/college';
import { programs } from '@/content/programs';
import { getContent } from '@/lib/cms';

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

export default async function AboutPage() {
  const { faculty } = await getContent();
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
      <Section eyebrow="Who we are" title={college.tagline} className="bg-surface">
        <p className="lead-text max-w-3xl">{college.apart}</p>
        <div id="vision" className="mt-8 grid scroll-mt-24 gap-4 md:grid-cols-2">
          <div className="card p-6">
            <p className="eyebrow">Vision</p>
            <p className="mt-2 font-display text-xl leading-8 text-heading">{college.vision}.</p>
          </div>
          <div className="card p-6">
            <p className="eyebrow">Mission</p>
            <p className="mt-2 leading-7 text-ink">{college.mission}</p>
          </div>
        </div>
      </Section>
      <Section eyebrow="Programs" title="Four on-campus programs">
        <ul className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <li key={p.slug}>
              <Link href={`/programs/${p.slug}`} className="card flex h-full flex-col p-5 transition hover:border-gold">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">{p.goal} · {p.duration}</span>
                <span className="mt-2 font-semibold text-heading">{p.name}</span>
                <span className="mt-1 text-sm text-muted">{p.targets.join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">Every program includes daily practice papers, weekly tests and a full-length mock test series built on NCERT resources.</p>
      </Section>
      <Section eyebrow="Leadership" title={college.leader.name} className="bg-surface">
        <p className="lead-text">{college.leaderCredentialsFull}</p>
        {faculty.leadershipMessage ? (
          <blockquote className="mt-4 max-w-3xl border-l-4 border-gold pl-4 text-[15px] italic text-ink">{faculty.leadershipMessage}</blockquote>
        ) : (
          <p className="mt-4 max-w-3xl text-sm italic text-muted">The leadership message will appear here once it is added in Website content › Faculty & leadership.</p>
        )}
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
          <Link href="/admission-system" className="btn-outline">Our admission system</Link>
        </div>
      </Section>
      <Section eyebrow="Contact" title="Visit or call us" className="bg-surface">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="font-semibold text-heading">Address</p>
            <p className="mt-2 text-sm leading-6 text-muted">{fullAddress}</p>
          </div>
          <div className="card p-5">
            <p className="font-semibold text-heading">Phone & email</p>
            <ul className="mt-2 space-y-1 text-sm">
              {college.phones.map((p) => (
                <li key={p.tel}><a href={`tel:${p.tel}`} className="font-mono text-maroon underline dark:text-gold">{p.display}</a></li>
              ))}
              <li><a href={`mailto:${college.email}`} className="text-maroon underline dark:text-gold">{college.email}</a></li>
            </ul>
          </div>
          <div className="card p-5">
            <p className="font-semibold text-heading">Office hours</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {college.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-3"><span>{h.days}</span><span className="font-mono">{h.time}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
