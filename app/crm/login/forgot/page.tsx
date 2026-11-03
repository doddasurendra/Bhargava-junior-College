import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/crm/StaffForms';
import { Crest } from '@/components/ui';
import { getIdentity } from '@/lib/auth/store';

export const metadata: Metadata = { title: 'Forgot password' };
export const dynamic = 'force-dynamic';

export default function ForgotPage() {
  const emails = getIdentity().emails;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Crest size={52} />
          <p className="font-display text-2xl text-heading">Forgot your password?</p>
        </div>
        <div className="card p-6">
          {emails ? (
            <>
              <p className="mb-4 text-sm text-muted">Enter your work email. We’ll send a link to set a new password. Your two-step verification stays as it is.</p>
              <ForgotPasswordForm />
            </>
          ) : (
            <p className="text-sm text-muted">Local development has no passwords: sign in with the staff picker. With Supabase configured, this page emails a reset link.</p>
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/crm/login" className="text-muted underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
