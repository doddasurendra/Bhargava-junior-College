import type { Metadata } from 'next';
import Link from 'next/link';
import { CoursesSection, EvolveSection } from '@/components/brochure';
import { PageHero, Section } from '@/components/ui';
import { BROCHURE_PDF, brochureText } from '@/content/brochure';
import { getLang } from '@/lib/i18n-server';
import { college } from '@/content/college';
import { programIncludes, programs } from '@/content/programs';
import { getContent } from '@/lib/cms';
import { formatINR } from '@/lib/fees';

export const metadata: Metadata = {
  title: 'Courses offered: IIT-JEE & NEET two-year integrated programmes',
  description: 'Focused, integrated programmes for JEE Main · JEE Advanced & NEET with a clear academic pathway, the EVOLVE learning model, and one-year Long Term JEE and NEET programs.',
  alternates: { canonical: '/programs' },
};

export default async function ProgramsPage() {
  const { fees } = await getContent();
  const t = brochureText(getLang());
  return (
    <>
      <PageHero eyebrow={t.courses.eyebrow} title="Choose the path that fits your goal" intro={`${t.courses.intro} Plus two one-year Long Term programs for repeat attempts.`}>
        <div className="flex flex-wrap gap-3">
          <Link href="/course-finder" className="btn-gold">Help me choose</Link>
          <a href={BROCHURE_PDF} download className="btn-outline-light">{t.contact.download}</a>
        </div>
      </PageHero>
      <Section>
        <div className="grid gap-5 md:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.slug} href={`/programs/${p.slug}`} className="card group p-6 transition hover:border-gold sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {p.goal} · {p.duration}
              </p>
              <h2 className="mt-2 font-display text-3xl text-heading">{p.name}</h2>
              <p className="mt-3 leading-7 text-muted">{p.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.targets.map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
              <span className="mt-5 inline-block font-semibold text-maroon group-hover:underline dark:text-gold">View details, schedule and fees →</span>
            </Link>
          ))}
        </div>
      </Section>
      <CoursesSection t={t} className="bg-surface" />
      <EvolveSection t={t} />
      <Section eyebrow="Compare" title="At a glance" className="bg-surface" badge={fees.sample}>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="table-base min-w-[640px] bg-surface">
            <thead>
              <tr>
                <th>Program</th>
                <th>Duration</th>
                <th>Prepares for</th>
                <th className="text-right">Tuition / year</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.slug}>
                  <td className="font-semibold text-heading">{p.name}</td>
                  <td>{p.duration}</td>
                  <td className="text-muted">{p.targets.join(', ')}</td>
                  <td className="text-right font-mono">{formatINR(p.track === 'two-year' ? fees.twoYear.tuition : fees.longTerm.tuition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted">
          Included in every program: {programIncludes.join(', ').toLowerCase()}. Maximum {college.maxBatchSize} students per batch.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/fees" className="font-semibold text-maroon underline dark:text-gold">Full fee table and calculator</Link>
        </p>
      </Section>
    </>
  );
}
