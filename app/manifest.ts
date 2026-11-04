import type { MetadataRoute } from 'next';
import { college } from '@/content/college';

/** Installable Student & Parent app (PWA) — "Add to Home screen" on Android and iOS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${college.name} — Student & Parent`,
    short_name: 'Bhargava JC',
    description: 'College ID, fees and receipts, hostel check-ins and the mess menu, and admission tracking.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F5F9',
    theme_color: '#1D2A5E',
    // TODO(college): replace with 192px and 512px PNG icons of the official crest.
    icons: [
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: college.logoSrc, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
