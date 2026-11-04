import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Campus, facilities & campus life', description: 'Classrooms, labs, library, hostel, safety, daily schedule, transport and the photo gallery of Bhargava Junior College, Saroornagar.', alternates: { canonical: '/campus' } };

const AREAS: Record<string, string> = { classrooms: 'Classrooms', labs: 'Laboratories', library: 'Library', hostel: 'Hostel', sports: 'Sports & yoga', events: 'Events', other: 'Campus' };

export default async function CampusPage() {
  const { gallery, hostel, parentCorner } = await getContent();
  return (
    <>
      <PageHero eyebrow="Campus & campus life" title="One campus, built for focus" intro="Small batches of at most 40, labs for physics, chemistry and biology, a library and supervised study, with hostel and transport for students who need them." badge={gallery.sample} />
      <Section eyebrow="Gallery" title="See the campus">
        {gallery.items.length === 0 ? (
          <p className="card p-6 text-sm text-muted">Photos of the classrooms, labs, library and hostel will be added here by the college. The best way to see it is in person: <Link href="/visit" className="underline">book a campus visit</Link>.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.items.map((g) => (
              <li key={g.title} className="card overflow-hidden">
                {g.imageUrl && <img src={g.imageUrl} alt={g.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                <p className="p-3 text-sm"><span className="font-medium text-heading">{g.title}</span> <span className="text-xs text-muted">· {AREAS[g.area]}</span></p>
              </li>
            ))}
          </ul>
        )}
        {gallery.tourUrl && <a href={gallery.tourUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4">Take the 360° tour</a>}
      </Section>
      <Section eyebrow="A day at Bhargava" title="Daily schedule (hostel)">
        <ul className="grid gap-2 sm:grid-cols-3">{hostel.schedule.map((s) => <li key={s.time} className="card flex gap-3 p-3 text-sm"><span className="font-mono text-maroon dark:text-gold">{s.time}</span>{s.activity}</li>)}</ul>
      </Section>
      <Section eyebrow="Safety" title="Safety and care">
        <ul className="grid gap-2 sm:grid-cols-2">{[...hostel.safety, ...hostel.health].map((x) => <li key={x} className="flex gap-3 text-[15px]"><Check />{x}</li>)}</ul>
        <p className="mt-4 text-sm"><Link href="/hostel" className="underline">Hostel details and fees</Link>{parentCorner.routes.length ? <> · <Link href="/parents#transport" className="underline">Transport routes</Link></> : null}</p>
      </Section>
    </>
  );
}
