import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Admissions CRM', template: '%s · Admissions CRM' },
  robots: { index: false, follow: false },
};

export default function CrmRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-bg">{children}</div>;
}
