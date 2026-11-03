import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/crm/StaffForms';
import { Crest } from '@/components/ui';

export const metadata: Metadata = { title: 'Set a new password', referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/**
 * Landing page for the emailed invite / reset link (?token_hash=…&type=recovery|invite). The token is spent
 * only when the form is submitted, so mail scanners that open links can't use it up.
 */
export default function ResetPage({ searchParams }: { searchParams: SP }) {
  const token = typeof searchParams.token_hash === 'string' ? searchParams.token_hash : '';
  const type = searchParams.type === 'invite' ? 'invite' : 'recovery';
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Crest size={52} />
          <p className="font-display text-2xl text-heading">{type === 'invite' ? 'Welcome: set your password' : 'Set a new password'}</p>
        </div>
        <div className="card p-6">
          {token ? (
            <ResetPasswordForm token={token} type={type} />
          ) : (
            <p className="text-sm text-muted">
              This link is incomplete. Open it straight from the email, or{' '}
              <Link href="/crm/login/forgot" className="underline">
                ask for a new one
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
