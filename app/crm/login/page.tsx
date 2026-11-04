import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DevLoginForm, PasswordLoginForm } from '@/components/crm/forms';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { requiresMfa } from '@/lib/auth/service';
import { devLoginEnabled, getStaffSession } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { ROLE_LABELS } from '@/lib/crm/types';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (await getStaffSession()) redirect('/crm');
  const dev = devLoginEnabled();
  // ?as=<role> from the /login hub: say who is signing in; in development list matching sample users first.
  const asParam = typeof searchParams.as === 'string' ? searchParams.as : null;
  const as = asParam && ROLE_LABELS[asParam] ? asParam : null;
  const all = dev ? await getCrmRepo().listStaff() : [];
  const staff = as ? [...all.filter((s) => (s.roles as string[]).includes(as)), ...all.filter((s) => !(s.roles as string[]).includes(as))] : all;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <Crest size={52} />
          <div>
            <p className="font-display text-2xl text-heading">Admissions CRM</p>
            <p className="text-sm text-muted">{college.name} · staff only</p>
          </div>
        </div>
        {as && (
          <p className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
            <span>Signing in as <strong className="text-heading">{ROLE_LABELS[as]}</strong></span>
            <Link href="/login" className="text-xs text-muted underline">Not you? Choose another role</Link>
          </p>
        )}
        {searchParams.reset === '1' && (
          <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
            Password saved. Sign in with it now. Any other open sessions were signed out.
          </p>
        )}
        <div className="card p-6">
          {dev ? (
            <>
              <p className="mb-1 font-semibold text-heading">Local development: sign in as</p>
              <p className="mb-4 text-xs text-muted">Sample staff from the brief. This skips the password only: anyone marked 2FA (turned on in My account) still needs a code from their authenticator app. In production, staff sign in with email and password (Supabase Auth).</p>
              <DevLoginForm staff={staff.map((s) => ({ id: s.id, name: s.fullName, role: s.roles.map((r) => ROLE_LABELS[r]).join(', ') + (requiresMfa(s) ? ' · 2FA' : '') }))} />
            </>
          ) : (
            <>
              <PasswordLoginForm />
              <p className="mt-3 text-center text-sm">
                <Link href="/crm/login/forgot" className="text-muted underline">
                  Forgot password?
                </Link>
              </p>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Every sign-in is recorded. Lost access? Contact the admin office.</p>
      </div>
    </main>
  );
}
