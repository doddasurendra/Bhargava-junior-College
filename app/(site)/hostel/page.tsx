import type { Metadata } from 'next';
import Link from 'next/link';
import { BPhoto, CampusLifeBlocks, PhotoNote } from '@/components/brochure';
import { Check, PageHero, SampleBadge, Section } from '@/components/ui';
import { ADDRESSES, brochureText, CAMPUSES, media } from '@/content/brochure';
import { getContent } from '@/lib/cms';
import { formatINR } from '@/lib/fees';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Hostel life: Boys (Kuntloor) and Girls (Bairamalguda) residential campuses',
  description: 'A home away from home, where discipline meets care. Boys Residential Campus in Kuntloor and Girls Residential Campus in Bairamalguda, with 24×7 security, CCTV surveillance and a hygienic, nutritious mess.',
  alternates: { canonical: '/hostel' },
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="font-sans text-base font-semibold text-heading">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-6">
            <Check />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function HostelPage() {
  const { fees, hostel } = await getContent();
  const t = brochureText(getLang());
  const life = t.campusLife.blocks[2];
  return (
    <>
      <PageHero eyebrow="Hostel & campus life" title={life.title} intro={`${life.tagline}. ${t.campuses.items[1].name} (${t.campuses.items[1].location}) · ${t.campuses.items[0].name} (${t.campuses.items[0].location}).`}>
        <Link href="/visit" className="btn-gold">See the hostel on a campus visit</Link>
      </PageHero>

      <Section>
        <CampusLifeBlocks t={t} only={[2, 3]} />
      </Section>

      <Section id="locations" eyebrow={t.campuses.eyebrow} title={t.campuses.title} className="bg-surface">
        <ul className="grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => {
            const c = t.campuses.items[i];
            const addr = ADDRESSES[i === 0 ? 2 : 1];
            return (
              <li key={c.name} className="card overflow-hidden">
                <BPhoto p={media.campuses[i]} rounded="rounded-none" className="aspect-[3/2]" sizes="(min-width: 768px) 50vw, 100vw" />
                <div className="p-5">
                  <p className="font-display text-xl text-heading">{c.name} · {c.location}</p>
                  <p className="mt-1 text-sm font-semibold text-maroon dark:text-gold">{c.tagline}</p>
                  <ul className="mt-3 space-y-1.5">{c.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4" />{f}</li>)}</ul>
                  <address className="mt-3 text-sm not-italic text-muted">{addr.address}</address>
                  <a href={CAMPUSES[i].mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-maroon underline dark:text-gold">{t.contact.directions}</a>
                </div>
              </li>
            );
          })}
        </ul>
        <PhotoNote t={t} />
      </Section>

      <Section eyebrow="Hostel details" title={<>Safety, rooms and amenities <SampleBadge show={hostel.sample} /></>}>
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Safety" items={hostel.safety} />
          <List title="Rooms" items={hostel.rooms} />
          <List title="Health" items={hostel.health} />
          <List title="Amenities" items={hostel.amenities} />
        </div>
        <div className="card mt-4 p-6">
          <h3 className="font-sans text-base font-semibold text-heading">Food</h3>
          <p className="mt-2 leading-7 text-muted">{hostel.food}</p>
        </div>
      </Section>

      <Section eyebrow="A day in the hostel" title="Daily schedule" className="bg-surface">
        <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {hostel.schedule.map((s) => (
            <li key={s.time} className="flex items-baseline gap-4 border-b border-line py-3">
              <span className="w-14 font-mono font-semibold text-maroon dark:text-gold">{s.time}</span>
              <span>{s.activity}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Hostel fees" title="Per year, including food">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-6">
            <p className="text-sm text-muted">Non-AC · 4-sharing</p>
            <p className="mt-1 font-mono text-3xl font-semibold text-heading">{formatINR(fees.hostelNonAc)}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-muted">AC · 3-sharing</p>
            <p className="mt-1 font-mono text-3xl font-semibold text-heading">{formatINR(fees.hostelAc)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Photos, the 360° tour and warden contacts are added from the CMS. <Link href="/fees#calculator" className="font-semibold text-maroon underline dark:text-gold">Calculate your total fee</Link>.
        </p>
      </Section>
    </>
  );
}
