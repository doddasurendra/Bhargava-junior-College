import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Careers', description: 'Teaching and staff openings at Bhargava Junior College, Saroornagar, Hyderabad.', alternates: { canonical: '/careers' } };

const TYPE: Record<string, string> = { 'full-time': 'Full time', 'part-time': 'Part time', visiting: 'Visiting' };

export default async function CareersPage() {
  const { careers } = await getContent();
  const open = careers.openings.filter((o) => o.open);
  return (
    <>
      <PageHero eyebrow="Careers" title="Teach with us" intro="We look for teachers who explain clearly, care about every student in a batch of 40, and want to see them succeed." badge={careers.sample} />
      <Section>
        {open.length === 0 ? (
          <p className="card p-6 text-sm">There are no openings listed right now. Experienced JEE/NEET faculty are welcome to send a CV to <a className="underline" href={`mailto:${careers.applyEmail}`}>{careers.applyEmail}</a>.</p>
        ) : (
          <ul className="space-y-4">
            {open.map((o) => (
              <li key={o.title} className="card p-5">
                <p className="font-display text-xl text-heading">{o.title}</p>
                <p className="text-sm text-muted">{o.department} · {TYPE[o.type]}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{o.description}</p>
                <a className="btn-outline mt-3" href={`mailto:${careers.applyEmail}?subject=${encodeURIComponent(`Application: ${o.title}`)}`}>Apply by email</a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
