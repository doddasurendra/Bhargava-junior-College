import Link from 'next/link';
import { ResetMfaForm, UnlockForm } from '@/components/crm/AuthForms';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { isLocked, requiresMfa } from '@/lib/auth/service';
import { getAuthStore } from '@/lib/auth/store';
import { emptyAuth } from '@/lib/auth/types';
import { METHOD_LABELS, shortDevice } from '@/lib/auth/ua';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { ROLE_LABELS } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Security' };

type SP = Record<string, string | string[] | undefined>;

export default async function SecurityPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff('security.view');
  const manage = can(user, 'security.manage');
  const failedOnly = searchParams.failed === '1';
  const store = getAuthStore();
  const [staff, auths, events, recentFailed] = await Promise.all([
    getCrmRepo().listStaff(),
    store.listAll(),
    store.listEvents({ limit: 200, failedOnly }),
    store.listEvents({ limit: 500, failedOnly: true }),
  ]);
  const now = new Date();
  const byId = new Map(auths.map((a) => [a.staffId, a]));
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const rows = staff.map((s) => ({ s, a: byId.get(s.id) ?? emptyAuth(s.id), required: requiresMfa(s) }));
  const failed24h = recentFailed.filter((e) => now.getTime() - new Date(e.at).getTime() < 24 * 3600_000).length;
  const locked = rows.filter((r) => isLocked(r.a, now)).length;
  const missing = rows.filter((r) => r.required && !r.a.totpEnabledAt).length;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Security</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Failed sign-ins, 24 h" value={failed24h} tone={failed24h > 10 ? 'alert' : failed24h > 0 ? 'warn' : 'default'} href="/crm/security?failed=1" />
        <Stat label="Locked accounts" value={locked} tone={locked > 0 ? 'alert' : 'default'} />
        <Stat label="2FA required, not set up" value={missing} tone={missing > 0 ? 'warn' : 'good'} />
      </div>

      <Panel title="Staff sign-in">
        <div className="-m-4 overflow-x-auto">
          <table className="table-base min-w-[760px] text-[13px]">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Two-step verification</th>
                <th>Recovery codes</th>
                <th>Status</th>
                {manage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, a, required }) => {
                const lockedNow = isLocked(a, now);
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="font-semibold text-heading">{s.fullName}</span>
                      <span className="block text-xs text-muted">{s.roles.map((r) => ROLE_LABELS[r]).join(', ')}</span>
                    </td>
                    <td>
                      {a.totpEnabledAt ? (
                        <span className="text-emerald-700 dark:text-emerald-300">On · since {formatDateTime(a.totpEnabledAt)}</span>
                      ) : required ? (
                        <span className="font-semibold text-maroon dark:text-gold">Required · not set up yet</span>
                      ) : (
                        <span className="text-muted">Off (optional)</span>
                      )}
                    </td>
                    <td className="font-mono">{a.totpEnabledAt ? a.recoveryHashes.length : '—'}</td>
                    <td>
                      {lockedNow ? (
                        <span className="font-semibold text-red-700 dark:text-red-300">Locked until {formatDateTime(a.lockedUntil!)}</span>
                      ) : a.failedCount > 0 ? (
                        <span className="text-muted">{a.failedCount} recent failed {a.failedCount === 1 ? 'attempt' : 'attempts'}</span>
                      ) : (
                        <span className="text-muted">OK</span>
                      )}
                    </td>
                    {manage && (
                      <td>
                        <div className="flex flex-wrap items-start gap-3">
                          {lockedNow && <UnlockForm staffId={s.id} />}
                          {(a.totpEnabledAt || a.totpPendingEnc) && s.id !== user.id && <ResetMfaForm staffId={s.id} name={s.fullName} />}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={failedOnly ? 'Failed sign-in attempts' : 'Sign-in audit'}
        actions={
          <Link href={failedOnly ? '/crm/security' : '/crm/security?failed=1'} className="text-xs font-semibold text-maroon underline dark:text-gold">
            {failedOnly ? 'Show everything' : 'Failures only'}
          </Link>
        }
      >
        {events.length === 0 ? (
          <Empty>No sign-in activity recorded yet.</Empty>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="table-base min-w-[860px] text-[13px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Step</th>
                  <th>Result</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{formatDateTime(e.at)}</td>
                    <td>
                      <span className="text-heading">{(e.staffId && names.get(e.staffId)) || e.email || 'Unknown'}</span>
                      {e.staffId && e.email && <span className="block text-xs text-muted [overflow-wrap:anywhere]">{e.email}</span>}
                      {e.actorId && <span className="block text-xs text-muted">by {names.get(e.actorId) ?? e.actorId}</span>}
                    </td>
                    <td>{METHOD_LABELS[e.method] ?? e.method}</td>
                    <td>
                      <span className={e.success ? 'text-emerald-700 dark:text-emerald-300' : 'font-semibold text-red-700 dark:text-red-300'}>{e.success ? 'OK' : 'Failed'}</span>
                      <span className="block text-xs text-muted">{e.reason}</span>
                    </td>
                    <td className="text-xs text-muted">
                      {shortDevice(e.userAgent)}
                      {e.ip && <span className="block font-mono">{e.ip}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="text-xs text-muted">Showing the latest 200. Records are kept permanently in the database; the local development store keeps the last 5,000.</p>
    </div>
  );
}
