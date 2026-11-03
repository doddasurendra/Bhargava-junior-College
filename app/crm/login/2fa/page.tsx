import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cancelMfaAction } from '@/app/crm/auth-actions';
import { MfaCodeForm } from '@/components/crm/AuthForms';
import { TotpSetup } from '@/components/crm/TotpSetup';
import { Crest } from '@/components/ui';
import { requiresMfa } from '@/lib/auth/service';
import { getAuthService, getAuthStore } from '@/lib/auth/store';
import { getPendingMfa } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';

export const metadata: Metadata = { title: 'Two-step verification' };
export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  const staffId = getPendingMfa();
  if (!staffId) redirect('/crm/login');
  const staff = await getCrmRepo().getStaff(staffId);
  if (!staff) redirect('/crm/login');
  const auth = await getAuthStore().get(staffId);
  const setup = auth.totpEnabledAt ? null : await getAuthService().enrolment(staffId);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <Crest size={52} />
          <div>
            <p className="font-display text-2xl text-heading">Two-step verification</p>
            <p className="text-sm text-muted">Signing in as {staff.fullName}</p>
          </div>
        </div>
        <div className="card p-6">
          {setup ? (
            <>
              <p className="mb-1 font-semibold text-heading">Set up your authenticator</p>
              <p className="mb-5 text-sm text-muted">
                {requiresMfa(staff)
                  ? 'Your role can see fees, reports or every account, so sign-in needs a code from your phone as well as your password. You only set this up once.'
                  : 'You turned on two-step verification. Finish setting it up to continue.'}
              </p>
              <TotpSetup secret={setup.secret} uri={setup.uri} />
            </>
          ) : (
            <>
              <p className="mb-1 font-semibold text-heading">Enter your code</p>
              <p className="mb-5 text-sm text-muted">Open your authenticator app and enter the 6-digit code for Bhargava CRM.</p>
              <MfaCodeForm />
            </>
          )}
        </div>
        <form action={cancelMfaAction} className="mt-4 text-center">
          <button className="text-xs text-muted underline">Cancel and sign in as someone else</button>
        </form>
      </div>
    </main>
  );
}
