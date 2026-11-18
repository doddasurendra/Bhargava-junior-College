import type { Metadata } from 'next';
import Link from 'next/link';
import { StaffRegisterForm } from '@/components/crm/RegistrationForms';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { ROLE_LABELS } from '@/lib/crm/types';
import { DEPARTMENTS, SELF_REGISTER_ROLES } from '@/lib/records/collections';

export const metadata: Metadata = { title: 'Staff registration' };
export const dynamic = 'force-dynamic';

/** Teachers and staff request an account; a Super Admin verifies and approves it before it can be used. */
export default function RegisterPage({ searchParams }: { searchParams: { as?: string } }) {
  const as = (SELF_REGISTER_ROLES as readonly string[]).includes(searchParams.as ?? '') ? searchParams.as : undefined;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Crest size={52} />
          <div>
            <p className="font-display text-2xl text-heading">Staff registration</p>
            <p className="text-sm text-muted">{college.name} · teachers and staff</p>
          </div>
        </div>
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Your account is checked and approved by the college administrator before you can sign in. Principal, management and administrator accounts are created by the administrator and can’t be requested here.</p>
          <StaffRegisterForm roles={SELF_REGISTER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} departments={[...DEPARTMENTS]} defaultRole={as} />
        </div>
        <p className="mt-4 text-center text-sm">
          Already approved? <Link href="/crm/login" className="underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
