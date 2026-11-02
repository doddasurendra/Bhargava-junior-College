import type { Metadata } from 'next';
import { LeadForm } from '@/components/forms';
import { PageHero, Section } from '@/components/ui';
import { college, fullAddress, mapsEmbedUrl, mapsLinkUrl, whatsappLink } from '@/content/college';

export const metadata: Metadata = {
  title: 'Contact & directions',
  description: `Call ${college.phones[0].display}, WhatsApp, or visit us at ${fullAddress}.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to the admissions office" intro="Call, WhatsApp, or leave your number and a counsellor will call you back." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {college.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="card p-5 transition hover:border-gold">
                  <span className="label">Call</span>
                  <span className="font-mono text-lg font-semibold text-heading">{p.display}</span>
                </a>
              ))}
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="card p-5 transition hover:border-gold">
                <span className="label">WhatsApp</span>
                <span className="font-semibold text-heading">Chat with admissions</span>
              </a>
              <a href={`mailto:${college.email}`} className="card p-5 transition hover:border-gold">
                <span className="label">Email</span>
                <span className="break-all font-semibold text-heading">{college.email}</span>
              </a>
            </div>
            <div className="card p-5">
              <span className="label">Address</span>
              <address className="not-italic leading-7">{fullAddress}</address>
              <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-maroon underline dark:text-gold">
                Get directions
              </a>
              <span className="label mt-4">Office hours</span>
              <ul className="space-y-1 text-sm">
                {college.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-4">
                    <span>{h.days}</span>
                    <span className="font-mono text-muted">{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <iframe title="Bhargava Junior College on Google Maps" src={mapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full rounded-2xl border border-line" />
          </div>
          <div id="enquire" className="lg:sticky lg:top-28 lg:self-start">
            <div className="card p-5 sm:p-7">
              <LeadForm source="enquiry" heading="Enquire now" sub="We’ll call you back during office hours." submitLabel="Send enquiry" showClass showNote />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
