import Link from 'next/link';
import { Disable2faForm, RegenerateCodesForm, SignOutEverywhereForm } from '@/components/crm/AuthForms';
import { TotpSetup } from '@/components/crm/TotpSetup';
import { Panel } from '@/components/crm/ui';
import { requiresMfa } from '@/lib/auth/service';
import { getAuthService, getAuthStore } from '@/lib/auth/store';
import { METHOD_LABELS, shortDevice } from '@/lib/auth/ua';
import { requireStaff } from '@/lib/crm/auth';
import { ROLE_LABELS } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'My account' };

type SP = Record<string, string | string[] | undefined>;

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff();
  const store = getAuthStore();
  const [auth, events] = await Promise.all([store.get(user.id), store.listEvents({ limit: 12, staffId: user.id })]);
  const allRoles = user.allRoles ?? user.roles;
  const required = requiresMfa({ roles: allRoles });
  const setup = !auth.totpEnabledAt && searchParams.setup === '1' ? await getAuthService().enrolment(user.id) : null;
  const recoveryLeft = typeof searchParams.recovery === 'string' ? Number(searchParams.recovery) : null;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="font-display text-3xl text-heading">My account</h1>

      {recoveryLeft !== null && Number.isFinite(recoveryLeft) && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${recoveryLeft <= 2 ? 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200' : 'bg-gold-100/70 text-ink dark:bg-gold/10'}`}>
          You signed in with a recovery code. {recoveryLeft} {recoveryLeft === 1 ? 'code is' : 'codes are'} left.
          {recoveryLeft <= 2 ? ' Make new codes below before you run out.' : ''} If you lost your phone, ask {allRoles.includes('super_admin') ? 'another' : 'the'} Super Admin to reset two-step verification so you can set up a new one.
        </p>
      )}

      <Panel title="Profile">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Name</dt>
            <dd className="font-medium text-heading">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Email</dt>
            <dd className="font-medium text-heading [overflow-wrap:anywhere]">{user.email ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted">Roles</dt>
            <dd className="font-medium text-heading">
              {allRoles.map((r) => ROLE_LABELS[r]).join(' · ')}
              {allRoles.length > 1 && <span className="block text-xs font-normal text-muted">Working as {ROLE_LABELS[user.roles[0]]}. Switch roles from the menu.</span>}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title="Two-step verification"
        actions={
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${auth.totpEnabledAt ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-bg text-muted'}`}>
            {auth.totpEnabledAt ? 'On' : 'Off'}
          </span>
        }
      >
        {auth.totpEnabledAt ? (
          <div className="space-y-5 text-sm">
            <p>
              On since {formatDateTime(auth.totpEnabledAt)}. Sign-in asks for a code from your authenticator app.{' '}
              {required && <span className="text-muted">Required for your role.</span>}
            </p>
            <div>
              <p className="font-semibold text-heading">Recovery codes: {auth.recoveryHashes.length} left</p>
              <p className="mb-2 text-muted">Each one gets you in once without your phone. Making new codes cancels the old ones.</p>
              <RegenerateCodesForm />
            </div>
            {!required && (
              <div>
                <p className="mb-2 font-semibold text-heading">Turn off two-step verification</p>
                <Disable2faForm />
              </div>
            )}
          </div>
        ) : setup ? (
          <TotpSetup secret={setup.secret} uri={setup.uri} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted">Add a code from your phone to every sign-in, so a stolen password alone isn’t enough.</p>
            <Link href="/crm/account?setup=1" className="btn-primary py-2">
              Set up
            </Link>
          </div>
        )}
      </Panel>

      <Panel title="Sessions">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">Left the CRM signed in on a shared computer? This signs out every browser except this one.</p>
          <SignOutEverywhereForm />
        </div>
      </Panel>

      <Panel title="Recent sign-in activity">
        {events.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span>
                  <span className={e.success ? 'text-ink' : 'font-semibold text-red-700 dark:text-red-300'}>{e.success ? METHOD_LABELS[e.method] ?? e.method : `Failed · ${METHOD_LABELS[e.method] ?? e.method}`}</span>
                  <span className="text-muted"> · {e.reason}</span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {formatDateTime(e.at)} · {shortDevice(e.userAgent)}
                  {e.ip ? ` · ${e.ip}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
