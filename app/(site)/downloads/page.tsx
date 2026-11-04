import type { Metadata } from 'next';
import { GatedDownloads } from '@/components/SiteTools';
import { PageHero, Section } from '@/components/ui';
import { programs } from '@/content/programs';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Downloads: brochure, prospectus, circulars', description: 'Download the Bhargava Junior College brochure, prospectus and circulars.', alternates: { canonical: '/downloads' } };

export default async function DownloadsPage() {
  const { brochures } = await getContent();
  const items = [
    ...programs.map((p) => ({ title: `${p.name} brochure`, url: brochures.urls[p.slug] ?? null, gated: true, tag: 'Brochure' })),
    ...brochures.downloads.map((d) => ({ title: d.title, url: d.url, gated: d.gated, tag: d.kind[0].toUpperCase() + d.kind.slice(1) })),
  ];
  return (
    <>
      <PageHero eyebrow="Downloads" title="Brochures, prospectus and circulars" badge={brochures.sample} />
      <Section>
        <GatedDownloads source="brochure" items={items} />
      </Section>
    </>
  );
}
