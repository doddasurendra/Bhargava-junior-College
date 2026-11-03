import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/crm/actions';
import { ThemeToggle } from '@/components/HeaderControls';
import { Crest } from '@/components/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { ROLE_LABELS } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';

export default async function CrmShell({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const nav = [
    { href: '/crm', label: 'My tasks' },
    { href: '/crm/leads', label: can(user, 'lead.viewAll') ? 'All leads' : 'My leads' },
    ...(can(user, 'visit.view') ? [{ href: '/crm/visits', label: 'Campus visits' }] : []),
    ...(can(user, 'verify.view') ? [{ href: '/crm/verification', label: 'Verification' }] : []),
    ...(can(user, 'lead.import') ? [{ href: '/crm/import', label: 'Import leads' }] : []),
    ...(can(user, 'whatsapp.setup') ? [{ href: '/crm/whatsapp', label: 'WhatsApp setup' }] : []),
  ];
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-navy-950 text-white/80 lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/crm" className="flex items-center gap-2.5">
            <Crest size={36} />
            <span className="leading-tight">
              <span className="block font-display text-white">Bhargava CRM</span>
              <span className="block text-[11px] uppercase tracking-[0.14em] text-gold-300">Admissions</span>
            </span>
          </Link>
          <nav aria-label="CRM" className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="text-sm font-semibold text-white">{user.fullName}</p>
          <p className="text-xs text-white/60">{user.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</p>
          <form action={logoutAction} className="mt-3">
            <button className="text-xs text-white/70 underline hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 lg:px-8">
          <p className="truncate text-xs text-muted">
            Every lead tracked · every parent followed up on time · every visit with an outcome · every admission verified
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-muted lg:hidden">{user.fullName}</span>
            <form action={logoutAction} className="lg:hidden">
              <button className="text-xs underline">Sign out</button>
            </form>
            <ThemeToggle />
          </div>
        </div>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
