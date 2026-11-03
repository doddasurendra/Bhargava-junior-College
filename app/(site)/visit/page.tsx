import type { Metadata } from 'next';
import { VisitBooking } from '@/components/VisitBooking';
import { Check, PageHero, Section } from '@/components/ui';
import { college, fullAddress, mapsLinkUrl } from '@/content/college';
import { bookableDates } from '@/lib/visits';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = {
  title: 'Book a campus visit',
  description: 'Pick a date and time slot to visit Bhargava Junior College in Saroornagar, Hyderabad. WhatsApp confirmation and reminders.',
  alternates: { canonical: '/visit' },
};

export const dynamic = 'force-dynamic';

export default async function VisitPage() {
  const { visitSlots } = await getContent();
  return (
    <>
      <PageHero eyebrow="Campus visit" title="See the campus before you decide" intro="Choose a slot from Monday to Saturday. A counsellor will show you the classrooms, labs, library and hostel, and answer your questions on programs, fees and scholarships." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="card p-5 sm:p-8">
            <VisitBooking dates={bookableDates(visitSlots)} />
          </div>
          <aside className="space-y-4">
            <div className="card p-6">
              <p className="font-semibold text-heading">What happens on the visit</p>
              <ul className="mt-3 space-y-2.5 text-[15px]">
                {['Campus tour: classrooms, labs, library, hostel', 'Meet an admission counsellor', 'Academic plan, fees and scholarship options explained', 'No obligation to decide on the day'].map((i) => (
                  <li key={i} className="flex gap-3">
                    <Check />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6 text-sm">
              <p className="font-semibold text-heading">Address</p>
              <p className="mt-2 leading-6 text-muted">{fullAddress}</p>
              <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-maroon underline dark:text-gold">
                Directions on Google Maps
              </a>
              <p className="mt-4 text-muted">
                Prefer to call? <a href={`tel:${college.phones[0].tel}`} className="font-mono font-semibold text-ink">{college.phones[0].display}</a>
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
