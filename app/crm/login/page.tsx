import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DevLoginForm, PasswordLoginForm } from '@/components/crm/forms';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { devLoginEnabled, getStaffSession } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { ROLE_LABELS } from '@/lib/crm/types';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getStaffSession()) redirect('/crm');
  const dev = devLoginEnabled();
  const staff = dev ? await getCrmRepo().listStaff() : [];
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
        <div className="card p-6">
          {dev ? (
            <>
              <p className="mb-1 font-semibold text-heading">Local development: sign in as</p>
              <p className="mb-4 text-xs text-muted">Sample staff from the brief. In production, staff sign in with email and password (Supabase Auth).</p>
              <DevLoginForm staff={staff.map((s) => ({ id: s.id, name: s.fullName, role: s.roles.map((r) => ROLE_LABELS[r]).join(', ') }))} />
            </>
          ) : (
            <PasswordLoginForm />
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Every sign-in is recorded. Lost access? Contact the admin office.</p>
      </div>
    </main>
  );
}
