import type { MetadataRoute } from 'next';
import { programs } from '@/content/programs';
import { siteUrl } from '@/lib/seo';
import { getContent } from '@/lib/cms';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { blog } = await getContent();
  const pages = ['', '/results', '/programs', '/fees', '/scholarship', '/hostel', '/visit', '/track', '/admissions', '/apply', '/course-finder', '/resources', '/mock-test', '/predictor', '/campus', '/faculty', '/blog', '/downloads', '/careers', '/parents', '/about', '/contact', '/login'];
  return [
    ...pages.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8 })),
    ...programs.map((p) => ({ url: `${siteUrl}/programs/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.9 })),
    ...blog.posts.filter((p) => p.published).map((p) => ({ url: `${siteUrl}/blog/${p.slug}`, lastModified: p.date, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
