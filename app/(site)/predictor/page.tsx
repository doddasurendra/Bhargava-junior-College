import type { Metadata } from 'next';
import Link from 'next/link';
import { Predictor } from '@/components/SiteTools';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'JEE rank & NEET college predictor', description: 'Estimate your JEE Main rank from your percentile, or your NEET rank band and likely colleges from your score.', alternates: { canonical: '/predictor' } };

export default async function PredictorPage() {
  const { predictor } = await getContent();
  return (
    <>
      <PageHero eyebrow="Rank & college predictor" title="Where could your score take you?" intro="Enter a JEE Main percentile or a NEET score to see an estimated rank band and the kinds of colleges that admitted similar ranks." badge={predictor.sample} />
      <Section>
        <div className="mx-auto max-w-2xl space-y-4">
          <Predictor cfg={predictor} />
          <p className="text-center text-sm text-muted">Want to improve that rank? <Link href="/mock-test" className="underline">Take the free mock test</Link> or <Link href="/visit" className="underline">book a campus visit</Link>.</p>
        </div>
      </Section>
    </>
  );
}
