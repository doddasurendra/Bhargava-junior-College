import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CrmTranslator } from '@/components/crm/CrmTranslator';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: { default: 'Admissions CRM', template: '%s · Admissions CRM' },
  robots: { index: false, follow: false },
};

// While the Telugu / Hindi dictionary loads, the CRM body is hidden for at most 1.5 s so staff don't see English flash first.
const HOLD_CSS = `html[data-tr] .crm-root{visibility:hidden;animation:crm-tr-show 0s 1.5s forwards}@keyframes crm-tr-show{to{visibility:visible}}`;

export default function CrmRootLayout({ children }: { children: ReactNode }) {
  const lang = getLang();
  return (
    <>
      {lang !== 'en' && (
        <>
          <style dangerouslySetInnerHTML={{ __html: HOLD_CSS }} />
          <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute('data-tr','1')` }} />
        </>
      )}
      <div className="crm-root min-h-screen bg-bg">{children}</div>
      <CrmTranslator lang={lang} />
    </>
  );
}
