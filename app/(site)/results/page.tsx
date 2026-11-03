import type { Metadata } from 'next';
import { ResultsGrid } from '@/components/ClientWidgets';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = {
  title: 'Results & Hall of Fame: JEE, NEET and Intermediate',
  description: 'JEE Advanced, JEE Main, NEET UG and TS Intermediate results of Bhargava Junior College students, with scorecard verification.',
  alternates: { canonical: '/results' },
};

export default async function ResultsPage() {
  const { results } = await getContent();
  return (
    <>
      <PageHero eyebrow="Hall of fame" title="Results, and how to check them" intro="Filter by exam and year. Each topper card links to the official scorecard once it has been verified." badge={results.sample} />
      <section className="border-b border-line bg-surface">
        <div className="container-x grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
          {results.aggregates.map((a) => (
            <div key={a.label}>
              <p className="font-display text-4xl text-heading">{a.value}</p>
              <p className="mt-1 text-sm text-muted">{a.label}</p>
            </div>
          ))}
        </div>
      </section>
      <Section>
        <ResultsGrid results={results} />
      </Section>
    </>
  );
}
