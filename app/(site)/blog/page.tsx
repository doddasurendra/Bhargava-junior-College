import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';
import { formatDate } from '@/lib/dates';

export const metadata: Metadata = { title: 'Blog & exam news: JEE, NEET, TS Inter', description: 'Exam updates, study plans and college news from Bhargava Junior College.', alternates: { canonical: '/blog' } };

const TAG: Record<string, string> = { jee: 'JEE', neet: 'NEET', 'ts-inter': 'TS Inter', 'study-tips': 'Study tips', college: 'College news' };

export default async function BlogPage() {
  const { blog } = await getContent();
  const posts = blog.posts.filter((p) => p.published).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHero eyebrow="Blog" title="Exam news and study advice" badge={blog.sample} />
      <Section>
        {posts.length === 0 ? <p className="text-sm text-muted">No posts yet.</p> : (
          <ul className="grid gap-4 md:grid-cols-2">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="card block h-full p-5 transition hover:border-gold">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{TAG[p.tag]} · {formatDate(p.date)}</p>
                  <p className="mt-2 font-display text-xl text-heading">{p.title}</p>
                  <p className="mt-2 text-sm text-ink">{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
