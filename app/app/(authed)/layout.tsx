import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { pendingAllowed } from '@/lib/app/pendingAccess';
import { st as sText } from '@/lib/app/signupText';
import { getLang } from '@/lib/i18n-server';
import { hasConsent, requireAppUser } from '@/lib/app/service';
import { logoutAction, switchProfileAction } from '../actions';
import { AppNav } from './AppNav';
import { LiveRefresh } from '@/components/LiveRefresh';

export const metadata: Metadata = { title: { default: 'Student & Parent app', template: '%s · Bhargava' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppShell({ children }: { children: ReactNode }) {
  const u = await requireAppUser();
  // DPDP Act 2023: notice and consent before showing any personal records (§9A.4)
  if (!(await hasConsent(u.phone))) redirect('/app/consent');
  const p = u.active;
  const pending = p?.kind === 'student' && !!p.pending;
  // server-side gate: a pending sign-up never renders batch-specific or private pages
  const blocked = pending && !pendingAllowed(headers().get('x-bjc-path'));
  const lang = getLang();
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
              {p?.kind === 'parent' ? `Parent view · ${p.collegeId}` : p?.kind === 'student' ? (pending ? 'Student · verification pending' : `Student · ${p.collegeId}`) : p?.kind === 'applicant' ? 'Admission in progress' : p?.kind === 'alumni' ? 'Alumni' : 'No linked student'}
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
      {pending && <p role="status" data-testid="pending-banner" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">{sText(lang, 'pendingBanner')}</p>}
      <main className="px-4 py-4">{blocked ? (
        <section className="card p-5 text-sm" data-testid="pending-blocked">
          <p className="font-semibold text-heading">Available after verification</p>
          <p className="mt-1 text-muted">This page shows class-specific or private records (marks, attendance, fees, hostel, parent details). It opens once the admin office verifies your account. Until then you can use Open Book, practice, flashcards, the daily challenge, the knowledge base and notices.</p>
          <Link href="/app/openbook" className="btn-primary mt-3 inline-block px-4 py-2">Go to Open Book</Link>
        </section>
      ) : children}</main>
      <LiveRefresh seconds={30} />
      <AppNav kind={pending ? 'pending' : p?.kind ?? null} />
    </div>
  );
}
