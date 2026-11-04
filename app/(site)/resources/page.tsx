import type { Metadata } from 'next';
import { GatedDownloads } from '@/components/SiteTools';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Free resources: NCERT solutions, previous papers, DPPs', description: 'Free JEE and NEET study resources from Bhargava Junior College: NCERT solutions, previous-year papers, sample DPPs, formula sheets and the exam calendar.', alternates: { canonical: '/resources' } };

const KIND: Record<string, string> = { ncert: 'NCERT solutions', pyq: 'Previous-year papers', dpp: 'Sample DPPs', formula: 'Formula sheets', calendar: 'Exam calendar' };
const EXAM: Record<string, string> = { jee: 'JEE', neet: 'NEET', board: 'TS Inter', all: 'JEE & NEET' };

export default async function ResourcesPage() {
  const { resources } = await getContent();
  return (
    <>
      <PageHero eyebrow="Free resources" title="Study material, free" intro="NCERT solutions, previous-year JEE and NEET papers, sample daily practice papers and formula sheets. Tell us your name and mobile once to unlock every download." badge={resources.sample} />
      {Object.entries(KIND).map(([k, label]) => {
        const items = resources.items.filter((r) => r.kind === k);
        if (!items.length) return null;
        return (
          <Section key={k} eyebrow={label} title={label}>
            <GatedDownloads source="resource" items={items.map((r) => ({ title: r.title, url: r.url, gated: r.gated, tag: EXAM[r.exam] }))} />
          </Section>
        );
      })}
    </>
  );
}
