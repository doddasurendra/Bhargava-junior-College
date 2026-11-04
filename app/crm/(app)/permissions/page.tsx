import { PermissionMatrix } from '@/components/crm/PermissionMatrix';
import { requireStaff } from '@/lib/crm/auth';
import { DEFAULT_RULES, LOCKED_GRANTS, PERMISSIONS } from '@/lib/crm/permissions';
import { diffFromDefaults, loadRbac, PERMISSION_INFO } from '@/lib/crm/rbac';
import { ROLE_LABELS, ROLES } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';
import { getRecordStore } from '@/lib/records';

export const metadata = { title: 'Permissions' };

export default async function PermissionsPage() {
  await requireStaff('rbac.manage');
  const rbac = await loadRbac(getRecordStore());
  const roles = [...ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r], custom: false })), ...rbac.customRoles.map((r) => ({ key: r.key, label: r.label, custom: true }))];
  const perms = PERMISSIONS.map((p) => ({ key: p, module: PERMISSION_INFO[p].module, label: PERMISSION_INFO[p].label, locked: LOCKED_GRANTS.filter((l) => l.perm === p).map((l) => l.role as string) }));
  const changes = diffFromDefaults(rbac.matrix).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-heading">Roles & permissions</h1>
        <p className="text-sm text-muted">
          What each role can see and do (§9A.4). {changes ? `${changes} permission${changes === 1 ? '' : 's'} changed from the defaults.` : 'Using the defaults.'}
          {rbac.updatedAt && ` Last saved ${formatDateTime(rbac.updatedAt)}.`} Telecallers always see only their own leads; parents only their own children.
        </p>
      </div>
      <PermissionMatrix roles={roles} perms={perms} grants={rbac.matrix as Record<string, string[]>} defaults={DEFAULT_RULES as Record<string, string[]>} customRoles={rbac.customRoles} />
    </div>
  );
}
