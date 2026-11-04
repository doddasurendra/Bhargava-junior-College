'use client';
import { useMemo, useState } from 'react';
import { saveRbacAction } from '@/app/crm/admin-actions';
import { ActionForm, Submit } from './forms';

type RoleCol = { key: string; label: string; custom: boolean };
type PermRow = { key: string; module: string; label: string; locked: string[] };

/** Roles × permissions with checkboxes; custom roles can be added or removed. Saved as one JSON payload. */
export function PermissionMatrix({ roles, perms, grants, defaults, customRoles }: { roles: RoleCol[]; perms: PermRow[]; grants: Record<string, string[]>; defaults: Record<string, string[]>; customRoles: { key: string; label: string; description: string | null }[] }) {
  const [g, setG] = useState<Record<string, string[]>>(grants);
  const [newRole, setNewRole] = useState({ label: '', description: '' });
  const [removeRole, setRemoveRole] = useState<string | null>(null);
  const modules = useMemo(() => [...new Set(perms.map((p) => p.module))], [perms]);
  const toggle = (perm: string, role: string) => setG((cur) => ({ ...cur, [perm]: cur[perm]?.includes(role) ? cur[perm].filter((r) => r !== role) : [...(cur[perm] ?? []), role] }));
  const changed = (perm: string, role: string) => (g[perm] ?? []).includes(role) !== (defaults[perm] ?? []).includes(role);

  return (
    <ActionForm action={saveRbacAction} reset={false}>
      <input type="hidden" name="payload" value={JSON.stringify({ grants: g, customRoles, newRole: newRole.label ? newRole : null, removeRole })} />
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-max min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="sticky left-0 z-20 min-w-[260px] bg-surface px-3 py-2 text-left font-semibold text-muted">Permission</th>
              {roles.map((r) => (
                <th key={r.key} className="h-40 w-9 px-1 align-bottom">
                  <span className={`block origin-bottom-left translate-x-4 -rotate-[60deg] whitespace-nowrap text-left font-medium ${r.custom ? 'text-maroon dark:text-gold' : 'text-ink'}`}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <FragmentRows key={m} module={m} perms={perms.filter((p) => p.module === m)} roles={roles} g={g} toggle={toggle} changed={changed} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Cells with a gold ring differ from the defaults. Locked cells (Super Admin’s administration rights) can’t be removed, so nobody is locked out.</p>

      <div className="grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-heading">Add a custom role</p>
          <input value={newRole.label} onChange={(e) => setNewRole({ ...newRole, label: e.target.value })} placeholder="e.g. Sports coordinator" maxLength={60} className="input mb-2 py-2 text-sm" aria-label="New role name" />
          <input value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} placeholder="What they do (optional)" maxLength={200} className="input py-2 text-sm" aria-label="New role description" />
          <p className="mt-1 text-xs text-muted">It appears as a new column after saving; tick its permissions and save again.</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-heading">Custom roles</p>
          {customRoles.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {customRoles.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span>{r.label}{r.description ? <span className="text-xs text-muted"> · {r.description}</span> : null}</span>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={removeRole === r.key} onChange={(e) => setRemoveRole(e.target.checked ? r.key : null)} className="accent-maroon" />remove</label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Submit className="btn-primary py-2">Save permissions</Submit>
    </ActionForm>
  );
}

function FragmentRows({ module, perms, roles, g, toggle, changed }: { module: string; perms: PermRow[]; roles: RoleCol[]; g: Record<string, string[]>; toggle: (p: string, r: string) => void; changed: (p: string, r: string) => boolean }) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="sticky left-0 bg-bg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{module}</td>
      </tr>
      {perms.map((p) => (
        <tr key={p.key} className="border-t border-line">
          <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
            <span className="text-ink">{p.label}</span>
            <span className="block font-mono text-[10px] text-muted">{p.key}</span>
          </td>
          {roles.map((r) => {
            const locked = p.locked.includes(r.key);
            const on = locked || (g[p.key] ?? []).includes(r.key);
            return (
              <td key={r.key} className="px-1 text-center">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={() => toggle(p.key, r.key)}
                  aria-label={`${r.label}: ${p.label}`}
                  className={`h-4 w-4 accent-maroon ${changed(p.key, r.key) ? 'rounded ring-2 ring-gold' : ''}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
