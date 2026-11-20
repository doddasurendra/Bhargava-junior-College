import Link from 'next/link';
import { Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { ROLE_LABELS } from '@/lib/crm/types';

export const metadata = { title: 'No access' };
export const dynamic = 'force-dynamic';

export default async function ForbiddenPage() {
  const user = await requireStaff();
  const role = user.roles[0];
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-3xl text-heading">No access</h1>
      <Panel title="This page is not part of your role">
        <p className="text-sm">
          You are signed in as <b>{user.fullName}</b> ({role ? ROLE_LABELS[role] : 'staff'}). This page belongs to another role or department, so it is not shown to you.
        </p>
        <p className="mt-2 text-sm text-muted">If you need it for your work, ask the Super Admin to change your role or permissions. Every access attempt is checked on the server.</p>
        <Link href="/crm" className="btn-outline mt-3 inline-block text-xs">Back to my dashboard</Link>
      </Panel>
    </div>
  );
}
