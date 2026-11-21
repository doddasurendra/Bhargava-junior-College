import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BPhoto, CampusesSection, CampusLifeSection, PhotoNote } from '@/components/brochure';
import { Check, PageHero, SampleBadge, Section } from '@/components/ui';
import { brochureText, media } from '@/content/brochure';
import { getContent } from '@/lib/cms';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Campus life & our three campuses',
  description: 'Laboratories, smart classrooms (max 40 per class), hostel life, a hygienic mess, sports and a 1.5-acre green campus. Girls Residential (Bairamalguda), Boys Residential (Kuntloor) and Day Scholar (LB Nagar) campuses.',
  alternates: { canonical: '/campus' },
};

const AREAS: Record<string, string> = { classrooms: 'Classrooms', labs: 'Laboratories', library: 'Library', hostel: 'Hostel', sports: 'Sports & yoga', events: 'Events', other: 'Campus' };

export default async function CampusPage() {
  const { gallery, hostel, parentCorner } = await getContent();
  const t = brochureText(getLang());
  return (
    <>
      <PageHero eyebrow={t.campusLife.motto} title={t.campusLife.title} intro={t.campusLife.intro}>
        <div className="flex flex-wrap gap-3">
          <Link href="#campuses" className="btn-gold">{t.campuses.eyebrow}</Link>
          <Link href="/visit" className="btn-outline-light">{t.contact.visit}</Link>
        </div>
      </PageHero>
      <section className="container-x pt-10">
        <BPhoto p={media.campusBuilding} priority sizes="100vw" className="max-h-[420px] border border-line" />
      </section>
      <CampusLifeSection t={t} />
      <CampusesSection t={t} className="bg-surface" />
      <Section id="gallery" eyebrow="Gallery" title={<>See the campus <SampleBadge show={gallery.sample} /></>}>
        {gallery.items.length === 0 ? (
          <p className="card p-6 text-sm text-muted">Photos of the classrooms, labs, library and hostel will be added here by the college. The best way to see it is in person: <Link href="/visit" className="underline">book a campus visit</Link>.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {gallery.items.map((g, i) => (
              <li key={`${g.imageUrl}-${i}`} className="card overflow-hidden">
                {g.imageUrl && (g.imageUrl.startsWith('/')
                  ? <Image src={g.imageUrl} alt={g.title} width={600} height={450} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={g.imageUrl} alt={g.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />)}
                <p className="p-3 text-sm"><span className="font-medium text-heading">{g.title}</span> <span className="text-xs text-muted">· {AREAS[g.area]}</span></p>
              </li>
            ))}
          </ul>
        )}
        {!gallery.sample && <PhotoNote t={t} />}
        {gallery.tourUrl && <a href={gallery.tourUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4">Take the 360° tour</a>}
      </Section>
      <Section eyebrow="A day at Bhargava" title={<>Daily schedule (hostel) <SampleBadge show={hostel.sample} /></>} className="bg-surface">
        <ul className="grid gap-2 sm:grid-cols-3">{hostel.schedule.map((s) => <li key={s.time} className="card flex gap-3 p-3 text-sm"><span className="font-mono text-maroon dark:text-gold">{s.time}</span>{s.activity}</li>)}</ul>
      </Section>
      <Section eyebrow="Safety" title={<>Safety and care <SampleBadge show={hostel.sample} /></>}>
        <ul className="grid gap-2 sm:grid-cols-2">{[...hostel.safety, ...hostel.health].map((x) => <li key={x} className="flex gap-3 text-[15px]"><Check />{x}</li>)}</ul>
        <p className="mt-4 text-sm"><Link href="/hostel" className="underline">Hostel details and fees</Link>{parentCorner.routes.length ? <> · <Link href="/parents#transport" className="underline">Transport routes</Link></> : null}</p>
      </Section>
    </>
  );
}
