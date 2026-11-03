import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';
import { formatINR } from '@/lib/fees';

export const metadata: Metadata = {
  title: 'Hostel & campus life',
  description: 'Separate boys’ and girls’ hostel blocks with wardens, CCTV, biometric entry with WhatsApp alerts to parents, doctor on call and a published mess menu.',
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
  return (
    <>
      <PageHero eyebrow="Hostel & campus life" title="A hostel parents can see into" intro={`${hostel.blocks}. Every check-in and check-out sends a WhatsApp alert to parents.`} badge={hostel.sample}>
        <Link href="/visit" className="btn-gold">See the hostel on a campus visit</Link>
      </PageHero>

      <Section>
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
