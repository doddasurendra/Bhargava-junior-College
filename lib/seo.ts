import { college, testimonials } from '@/content/college';
import type { Program } from '@/content/programs';
import { bsat } from '@/content/sample';

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'HighSchool'],
    '@id': `${siteUrl}/#org`,
    name: college.name,
    slogan: college.motto,
    url: siteUrl,
    logo: `${siteUrl}${college.logoSrc}`,
    email: college.email,
    telephone: college.phones.map((p) => p.tel),
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${college.address.line1}, ${college.address.line2}`,
      addressLocality: `${college.address.locality}, ${college.address.city}`,
      addressRegion: college.address.region,
      postalCode: college.address.pin,
      addressCountry: college.address.country,
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '17:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '15:00' },
    ],
    founder: { '@type': 'Organization', name: college.society },
    employee: { '@type': 'Person', name: college.leader.name, honorificSuffix: college.leader.credentials },
    review: testimonials.filter((t) => t.quote).map((t) => ({ '@type': 'Review', author: { '@type': 'Person', name: t.name }, reviewBody: t.quote })),
  };
}

export function courseJsonLd(p: Program) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: p.name,
    description: p.summary,
    provider: { '@id': `${siteUrl}/#org`, '@type': 'EducationalOrganization', name: college.name },
    timeRequired: p.track === 'two-year' ? 'P2Y' : 'P1Y',
    educationalCredentialAwarded: p.track === 'two-year' ? 'TS Intermediate Board' : undefined,
    url: `${siteUrl}/programs/${p.slug}`,
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'onsite', location: college.mapsQuery },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function bsatEventsJsonLd() {
  return bsat.sessions.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `BSAT — Bhargava Scholarship & Admission Test (${s.mode === 'online' ? 'Online' : 'Campus'})`,
    startDate: s.date,
    eventAttendanceMode: s.mode === 'online' ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: s.mode === 'online' ? { '@type': 'VirtualLocation', url: `${siteUrl}/scholarship` } : { '@type': 'Place', name: college.name, address: college.mapsQuery },
    organizer: { '@id': `${siteUrl}/#org`, '@type': 'EducationalOrganization', name: college.name },
    url: `${siteUrl}/scholarship`,
  }));
}
