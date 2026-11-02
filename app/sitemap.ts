import type { MetadataRoute } from 'next';
import { programs } from '@/content/programs';
import { siteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/results', '/programs', '/fees', '/scholarship', '/hostel', '/visit', '/track', '/admissions', '/course-finder', '/about', '/contact'];
  return [
    ...pages.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8 })),
    ...programs.map((p) => ({ url: `${siteUrl}/programs/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.9 })),
  ];
}
