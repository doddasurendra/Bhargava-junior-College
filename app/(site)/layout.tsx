import type { ReactNode } from 'react';
import { ChatWidget } from '@/components/ChatWidget';
import { VoiceAgent } from '@/components/VoiceAgent';
import { ClientBoot, ExitIntent } from '@/components/ClientWidgets';
import { Footer, Header, MobileBar, WhatsAppButton } from '@/components/SiteChrome';
import { JsonLd } from '@/components/ui';
import { organizationJsonLd } from '@/lib/seo';
import { getContent } from '@/lib/cms';

/** Public website chrome. The staff CRM (/crm) has its own layout. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { fees, bsat, hostel, social } = await getContent();
  return (
    <div className="pb-16 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-navy-950">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer social={social} />
      <MobileBar />
      <WhatsAppButton />
      <ChatWidget facts={{ fees, bsat, hostel }} />
      <VoiceAgent />
      <ExitIntent />
      <ClientBoot />
      <JsonLd data={organizationJsonLd()} />
    </div>
  );
}
