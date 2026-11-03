'use client';
import { useFormStatus } from 'react-dom';
import { switchRoleAction } from '@/app/crm/auth-actions';

type Opt = { value: string; label: string };

function Select({ roles, active, className }: { roles: Opt[]; active: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <select name="role" defaultValue={active} disabled={pending} aria-label="Working as" className={className} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {roles.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/** Shown only to staff with more than one role: switches the active role without signing out. */
export function RoleSwitcher({ roles, active, variant = 'sidebar' }: { roles: Opt[]; active: string; variant?: 'sidebar' | 'bar' }) {
  if (variant === 'bar')
    return (
      <form action={switchRoleAction}>
        <Select roles={roles} active={active} className="max-w-[10rem] rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink" />
      </form>
    );
  return (
    <form action={switchRoleAction} className="mt-2">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
        Working as
        <Select
          roles={roles}
          active={active}
          className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium normal-case tracking-normal text-white focus:border-gold-300 focus:outline-none [&>option]:text-ink"
        />
      </label>
      <noscript>
        <button className="mt-1 text-xs underline">Switch</button>
      </noscript>
    </form>
  );
}
