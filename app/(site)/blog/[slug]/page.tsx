import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd, PageHero, Section } from '@/components/ui';
import { college } from '@/content/college';
import { getContent } from '@/lib/cms';
import { formatDate } from '@/lib/dates';
import { siteUrl } from '@/lib/seo';

async function post(slug: string) {
  const { blog } = await getContent();
  return blog.posts.find((p) => p.slug === slug && p.published) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await post(params.slug);
  return p ? { title: p.title, description: p.summary, alternates: { canonical: `/blog/${p.slug}` } } : { title: 'Not found' };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const p = await post(params.slug);
  if (!p) notFound();
  return (
    <>
      <PageHero eyebrow={formatDate(p.date)} title={p.title} intro={p.summary} />
      <Section>
        <article className="mx-auto max-w-2xl space-y-4 text-[16px] leading-7 text-ink">
          {p.body.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
          <p className="pt-4 text-sm"><Link href="/blog" className="underline">← All posts</Link></p>
        </article>
      </Section>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.date, description: p.summary, publisher: { '@type': 'EducationalOrganization', name: college.name }, mainEntityOfPage: `${siteUrl}/blog/${p.slug}` }} />
    </>
  );
}
