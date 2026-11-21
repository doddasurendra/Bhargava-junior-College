import type { Metadata } from 'next';
import Link from 'next/link';
import { DifferentSection } from '@/components/brochure';
import { ModuleButtons } from '@/components/ModuleButtons';
import { brochureText } from '@/content/brochure';
import { getLang } from '@/lib/i18n-server';
import { Check, PageHero, Section } from '@/components/ui';
import { OPERATING_PRINCIPLE } from '@/content/admissionSystem';
import { college } from '@/content/college';
import { MODULE_BUTTONS } from '@/content/platform';

export const metadata: Metadata = {
  title: 'Why Bhargava: what makes us different',
  description: `More than a classroom. Expert faculty & mentorship, classes capped at ${college.maxBatchSize}, a structured academic system, safe campus life, Board + IIT-JEE / NEET preparation and modern infrastructure.`,
  alternates: { canonical: '/why-bhargava' },
};

const REASONS: { title: string; body: string; href: string }[] = [
  { title: 'Fees published, no form needed', body: 'The full fee table and a fee & scholarship calculator are open to everyone. You see what you will pay before you call.', href: '/fees' },
  { title: `Batches of at most ${college.maxBatchSize}`, body: 'The cap is enforced by the system, so every student is seen and heard in class.', href: '/about' },
  { title: `A mentor for every ${college.mentorRatio} students`, body: 'A weekly one-to-one, a monthly wellbeing check-in and a private call with parents when something slips.', href: '/about' },
  { title: 'Track your admission like a parcel', body: 'Every step from enquiry to College ID, with the person responsible and the date.', href: '/track' },
  { title: 'A hostel parents can see into', body: 'Biometric check-in and check-out with a WhatsApp alert to parents, and the mess menu in the app.', href: '/hostel' },
  { title: 'Practice that adapts', body: 'Auto-marked practice with worked solutions, weekly goals, streaks and a teacher who sees exactly where each student needs help.', href: '/app/login' },
  { title: 'Weekly parent report', body: 'Every Sunday on WhatsApp: attendance, test trend and the mentor’s note.', href: '/parents' },
  { title: 'Results you can verify', body: 'Each topper card links to the official scorecard. We never promise ranks or seats.', href: '/results' },
  { title: 'Answers any time', body: 'The AI admission assistant answers in English, తెలుగు or हिंदी, by text or voice, and hands you to a counsellor when needed.', href: '/contact' },
];

export default function WhyBhargavaPage() {
  const t = brochureText(getLang());
  return (
    <>
      <PageHero eyebrow="Why Bhargava" title={t.different.eyebrow} intro={`${college.name}: IIT-JEE and NEET with the TS Intermediate Board, run by ${college.society}. ${t.different.difference}`} />
      <DifferentSection t={t} />
      <Section eyebrow="And on top of that" title="What we do that most coaching colleges don’t" className="bg-surface">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((r) => (
            <li key={r.title}>
              <Link href={r.href} className="card flex h-full gap-3 p-5 transition hover:border-gold">
                <Check className="mt-0.5" />
                <span>
                  <span className="block font-semibold text-heading">{r.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-muted">{r.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section eyebrow="Our promise" title="How we run admissions">
        <blockquote className="max-w-3xl rounded-2xl border-l-4 border-gold bg-bg p-6 font-display text-xl leading-8 text-heading">{OPERATING_PRINCIPLE}</blockquote>
        <p className="mt-4 text-sm"><Link href="/admission-system" className="underline">See the ten-stage admission system</Link></p>
      </Section>
      <Section eyebrow="Explore" title="See it for yourself">
        <ModuleButtons items={MODULE_BUTTONS.filter((m) => m.href !== '/why-bhargava')} compact />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/visit" className="btn-primary">Book a campus visit</Link>
          <Link href="/contact#enquire" className="btn-outline">Talk to a counsellor</Link>
        </div>
      </Section>
    </>
  );
}
