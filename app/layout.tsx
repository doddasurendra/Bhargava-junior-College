import type { Metadata, Viewport } from 'next';
import { Figtree, IBM_Plex_Mono, Marcellus } from 'next/font/google';
import type { ReactNode } from 'react';
import { ClientBoot, ExitIntent } from '@/components/ClientWidgets';
import { Footer, Header, MobileBar, WhatsAppButton } from '@/components/SiteChrome';
import { JsonLd } from '@/components/ui';
import { college } from '@/content/college';
import { getLang } from '@/lib/i18n-server';
import { organizationJsonLd, siteUrl } from '@/lib/seo';
import './globals.css';

const display = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Bhargava Junior College, Saroornagar | IIT-JEE & NEET with Intermediate, Hyderabad',
    template: '%s | Bhargava Junior College',
  },
  description:
    'Junior college in Saroornagar, Hyderabad offering IIT-JEE and NEET UG integrated with the TS Intermediate Board, plus Long Term repeater programs. Transparent fees, BSAT scholarships, hostel and campus visits.',
  keywords: [
    'best junior college in Hyderabad',
    'best junior college Saroornagar',
    'IIT JEE coaching Saroornagar',
    'IIT NEET coaching Hyderabad',
    'NEET coaching with intermediate Hyderabad',
    'junior college with hostel LB Nagar',
    'junior college with hostel Dilsukhnagar',
  ],
  openGraph: { type: 'website', siteName: college.name, locale: 'en_IN', images: [{ url: college.logoSrc }] },
  icons: { icon: college.logoSrc },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1D2A5E' },
    { media: '(prefers-color-scheme: dark)', color: '#0C1129' },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('bjc_theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang === 'en' ? 'en-IN' : `${lang}-IN`} className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="pb-16 md:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-navy-950">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MobileBar />
        <WhatsAppButton />
        <ExitIntent />
        <ClientBoot />
        <JsonLd data={organizationJsonLd()} />
      </body>
    </html>
  );
}
