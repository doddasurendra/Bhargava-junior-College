import type { Metadata } from 'next';
import { MockTest } from '@/components/SiteTools';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Free JEE / NEET mock test with instant score', description: 'Take a short JEE/NEET-pattern sample test online and get your score and chapter analysis instantly.', alternates: { canonical: '/mock-test' } };

export default async function MockTestPage() {
  const { mockTest } = await getContent();
  return (
    <>
      <PageHero eyebrow="Free mock test" title="Try a JEE / NEET pattern test" intro="A short timed test with negative marking, like the real exams. Your score and the chapters to revise appear as soon as you submit." badge={mockTest.sample} />
      <Section>
        <div className="mx-auto max-w-3xl"><MockTest test={mockTest} /></div>
      </Section>
    </>
  );
}
