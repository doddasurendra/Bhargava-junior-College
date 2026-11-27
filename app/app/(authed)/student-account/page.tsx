import { redirect } from 'next/navigation';
import { college } from '@/content/college';
import { requireAppUser } from '@/lib/app/service';
import { accountSummary } from '@/lib/app/studentAccount';
import { formatDate } from '@/lib/dates';
import { BlockAccount, ResetCode } from './Client';

export const metadata = { title: 'My child · Student account' };
export const dynamic = 'force-dynamic';

/** Parent: the child's student app account — when it was created, block it, or give a password-reset code. */
export default async function StudentAccountPage() {
  const u = await requireAppUser();
  const p = u.active;
  if (p?.kind !== 'parent') redirect('/app');
  const a = await accountSummary(p.studentId);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">My child · Student account</h1>
      <section className="card p-4 text-sm">
        <p className="font-semibold text-heading">{p.name} · <span className="font-mono">{p.collegeId}</span></p>
        {!a.exists ? (
          <p className="mt-1 text-muted">No student account yet. Your child can sign up in the app with their name, College ID, date of birth and a password. You’ll get a message when they do.</p>
        ) : (
          <p className="mt-1">
            Status: <b>{a.status === 'active' ? 'Active' : a.status === 'blocked' ? 'Blocked' : 'Disabled by the admin office'}</b>
            {a.createdAt && <> · created {formatDate(a.createdAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</>}
          </p>
        )}
      </section>
      {a.exists && a.status === 'active' && (
        <>
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold text-heading">Reset student password</h2>
            <p className="text-muted">If your child forgot their password, make a one-time code here and give it to them.</p>
            <ResetCode />
          </section>
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold text-heading">Not your child?</h2>
            <p className="text-muted">If you didn’t expect this account, block it. Your child (or whoever made it) is signed out at once. Call the admin office at {college.phones[0].display} to unblock.</p>
            <BlockAccount />
          </section>
        </>
      )}
      {a.exists && a.status !== 'active' && <p className="text-sm text-muted">Only the admin office can unblock it: {college.phones[0].display}.</p>}
    </div>
  );
}
