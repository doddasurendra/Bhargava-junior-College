import { AddStaffForm, EditStaffForm, type RoleOpt } from '@/components/crm/StaffForms';
import { Panel } from '@/components/crm/ui';
import { MFA_ROLES } from '@/lib/auth/service';
import { getAuthStore, getIdentity } from '@/lib/auth/store';
import { requireStaff } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { ROLE_LABELS, ROLES } from '@/lib/crm/types';

export const metadata = { title: 'Staff accounts' };

export default async function StaffPage() {
  const user = await requireStaff('staff.manage');
  const [staff, auths] = await Promise.all([getCrmRepo().listAllStaff(), getAuthStore().listAll()]);
  const mfaOn = new Set(auths.filter((a) => a.totpEnabledAt).map((a) => a.staffId));
  const emails = getIdentity().emails;
  const roles: RoleOpt[] = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], mfa: MFA_ROLES.includes(r) }));
  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  const row = (s: (typeof staff)[number]) => (
    <li key={s.id} className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-heading">
            {s.fullName}
            {s.id === user.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
          </p>
          <p className="text-xs text-muted [overflow-wrap:anywhere]">
            {s.email ?? 'No email'}
            {s.phone ? ` · ${s.phone}` : ''}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {s.roles.map((r) => (
              <span key={r} className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy dark:bg-white/10 dark:text-white">
                {ROLE_LABELS[r]}
              </span>
            ))}
          </p>
        </div>
        <p className="shrink-0 text-xs">
          {!s.active ? <span className="font-semibold text-muted">Deactivated</span> : mfaOn.has(s.id) ? <span className="text-emerald-700 dark:text-emerald-300">2FA on</span> : s.roles.some((r) => MFA_ROLES.includes(r)) ? <span className="text-maroon dark:text-gold">2FA at next sign-in</span> : <span className="text-muted">No 2FA</span>}
        </p>
      </div>
      <EditStaffForm staff={{ id: s.id, fullName: s.fullName, phone: s.phone, roles: s.roles, active: s.active, email: s.email }} roles={roles} isSelf={s.id === user.id} emails={emails} />
    </li>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Staff accounts</h1>
          <p className="text-sm text-muted">{active.length} active · every change is recorded in the Security log</p>
        </div>
        <AddStaffForm roles={roles} emails={emails} />
      </div>
      <Panel title="Active">
        <ul className="-my-3 divide-y divide-line">{active.map(row)}</ul>
      </Panel>
      {inactive.length > 0 && (
        <Panel title={`Deactivated (${inactive.length})`}>
          <ul className="-my-3 divide-y divide-line">{inactive.map(row)}</ul>
        </Panel>
      )}
      <p className="text-xs text-muted">
        Faculty, wardens and transport roles can be given now; their own screens come with the Student &amp; Parent app phases. A sign-in email can’t be changed here. To change one, deactivate the account and add a new one.
      </p>
    </div>
  );
}
