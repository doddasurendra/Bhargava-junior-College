import type { Metadata } from 'next';
import Link from 'next/link';
import { Crest } from '@/components/ui';
import { VerifyEmailForm } from './VerifyEmailForm';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

/** The token is spent only when the button is pressed, so mail scanners that open links can't use it up. */
export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 text-center">
      <Crest size={72} className="mx-auto" />
      <h1 className="mt-4 font-display text-2xl text-heading">Confirm your email</h1>
      <div className="card mt-6 p-5 text-left">
        {token ? <VerifyEmailForm token={token} /> : <p className="text-sm text-muted">This link is incomplete. Open it straight from the email.</p>}
      </div>
      <p className="mt-6 text-sm"><Link href="/app/login" className="underline">Sign in</Link></p>
    </main>
  );
}
