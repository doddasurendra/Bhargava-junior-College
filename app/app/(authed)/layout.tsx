import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { redirect } from 'next/navigation';
import { hasConsent, requireAppUser } from '@/lib/app/service';
import { logoutAction, switchProfileAction } from '../actions';
import { AppNav } from './AppNav';

export const metadata: Metadata = { title: { default: 'Student & Parent app', template: '%s · Bhargava' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppShell({ children }: { children: ReactNode }) {
  const u = await requireAppUser();
  // DPDP Act 2023: notice and consent before showing any personal records (§9A.4)
  if (!(await hasConsent(u.phone))) redirect('/app/consent');
  const p = u.active;
  return (
    <div className="mx-auto min-h-screen max-w-md bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/app" aria-label="Home">
            <Crest size={36} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-heading">{p ? p.name : college.name}</p>
            <p className="truncate text-[11px] text-muted">
              {p?.kind === 'parent' ? `Parent view · ${p.collegeId}` : p?.kind === 'student' ? `Student · ${p.collegeId}` : p?.kind === 'applicant' ? 'Admission in progress' : p?.kind === 'alumni' ? 'Alumni' : 'No linked student'}
            </p>
          </div>
          <form action={logoutAction}>
            <button className="text-xs text-muted underline">Sign out</button>
          </form>
        </div>
        {u.profiles.length > 1 && (
          <nav aria-label="Switch child or profile" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {u.profiles.map((x) => (
              <form key={x.key} action={switchProfileAction}>
                <input type="hidden" name="key" value={x.key} />
                <input type="hidden" name="back" value="/app" />
                <button
                  aria-pressed={x.key === p?.key}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${x.key === p?.key ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line bg-surface text-ink'}`}
                >
                  {x.name.split(' ')[0]}
                  <span className="ml-1 opacity-70">{x.kind === 'parent' ? 'child' : x.kind === 'student' ? 'me' : x.kind === 'alumni' ? 'alumni' : 'application'}</span>
                </button>
              </form>
            ))}
          </nav>
        )}
      </header>
      <main className="px-4 py-4">{children}</main>
      <AppNav kind={p?.kind ?? null} />
    </div>
  );
}
