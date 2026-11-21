import type { Metadata } from 'next';
import { AddressCards, BrochureDownload, CampusPinsMap, ClosingBanner } from '@/components/brochure';
import { LeadForm } from '@/components/forms';
import { PageHero, Section } from '@/components/ui';
import { brochureText, WEBSITE } from '@/content/brochure';
import { college, fullAddress, whatsappLink } from '@/content/college';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Contact, addresses & directions',
  description: `Call ${college.phones.map((p) => p.display).join(' / ')}, email ${college.email}, or visit the Central Administration Office (${fullAddress}), the Boys Residential campus (Kuntloor) or the Girls Residential campus (Bairamalguda).`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const t = brochureText(getLang());
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to the admissions office" intro={t.contact.discover} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {college.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="card p-5 transition hover:border-gold">
                  <span className="label">{t.contact.call}</span>
                  <span className="font-mono text-lg font-semibold text-heading">{p.display}</span>
                </a>
              ))}
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="card p-5 transition hover:border-gold">
                <span className="label">WhatsApp</span>
                <span className="font-semibold text-heading">Chat with admissions</span>
              </a>
              <a href={`mailto:${college.email}`} className="card p-5 transition hover:border-gold">
                <span className="label">{t.contact.email}</span>
                <span className="break-all font-semibold text-heading">{college.email}</span>
              </a>
              <a href={`https://${WEBSITE}`} target="_blank" rel="noopener noreferrer" className="card p-5 transition hover:border-gold sm:col-span-2">
                <span className="label">{t.contact.website}</span>
                <span className="break-all font-semibold text-heading">{WEBSITE}</span>
              </a>
            </div>
            <div className="card p-5">
              <span className="label">Office hours</span>
              <ul className="space-y-1 text-sm">
                {college.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-4">
                    <span>{h.days}</span>
                    <span className="font-mono text-muted">{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <BrochureDownload t={t} />
          </div>
          <div id="enquire" className="lg:sticky lg:top-28 lg:self-start">
            <div className="card p-5 sm:p-7">
              <LeadForm source="enquiry" heading="Enquire now" sub="We’ll call you back during office hours." submitLabel="Send enquiry" showClass showNote />
            </div>
          </div>
        </div>
      </Section>
      <Section className="bg-surface">
        <AddressCards t={t} />
        <div className="mt-10"><CampusPinsMap t={t} /></div>
      </Section>
      <ClosingBanner t={t} />
    </>
  );
}
