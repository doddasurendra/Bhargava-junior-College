'use client';
import { useState } from 'react';
import { createStaffAction, forgotPasswordAction, resetPasswordAction, sendResetAction, updateStaffAction } from '@/app/crm/auth-actions';
import { ActionForm, Submit } from './forms';

export type RoleOpt = { value: string; label: string; mfa: boolean };

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

function RoleChecks({ roles, selected = [] }: { roles: RoleOpt[]; selected?: string[] }) {
  return (
    <fieldset>
      <legend className={lbl}>Roles</legend>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="roles" value={r.value} defaultChecked={selected.includes(r.value)} className="h-4 w-4 accent-maroon" />
            {r.label}
            {r.mfa && <span className="rounded bg-navy/10 px-1 text-[10px] font-semibold uppercase tracking-wider text-navy dark:bg-white/10 dark:text-white">2FA</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddStaffForm({ roles, emails }: { roles: RoleOpt[]; emails: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn-primary py-2" onClick={() => setOpen(true)}>
        Add staff member
      </button>
    );
  return (
    <div className="card p-5">
      <p className="mb-1 font-semibold text-heading">New staff member</p>
      <p className="mb-4 text-sm text-muted">
        {emails ? 'They get an email invitation to set their own password. Roles marked 2FA set up an authenticator at first sign-in.' : 'Local development: no email is sent; they appear in the sign-in picker.'}
      </p>
      <ActionForm action={createStaffAction}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={lbl}>Full name</span>
            <input name="fullName" required minLength={2} maxLength={80} className="input py-2" autoComplete="off" />
          </label>
          <label className="block">
            <span className={lbl}>Work email (sign-in)</span>
            <input name="email" type="email" required maxLength={254} className="input py-2" autoComplete="off" />
          </label>
          <label className="block">
            <span className={lbl}>Mobile (optional)</span>
            <input name="phone" inputMode="tel" maxLength={20} className="input py-2" autoComplete="off" />
          </label>
        </div>
        <RoleChecks roles={roles} />
        <div className="flex gap-2">
          <Submit className="btn-primary py-2">{emails ? 'Add and send invitation' : 'Add'}</Submit>
          <button type="button" className="btn-outline py-2" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </ActionForm>
    </div>
  );
}

export function EditStaffForm({ staff, roles, isSelf, emails }: { staff: { id: string; fullName: string; phone: string | null; roles: string[]; active: boolean; email: string | null }; roles: RoleOpt[]; isSelf: boolean; emails: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="text-xs font-semibold text-maroon underline dark:text-gold" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-bg p-4">
      <ActionForm action={updateStaffAction} reset={false}>
        <input type="hidden" name="staffId" value={staff.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Full name</span>
            <input name="fullName" required minLength={2} maxLength={80} defaultValue={staff.fullName} className="input py-2" />
          </label>
          <label className="block">
            <span className={lbl}>Mobile (optional)</span>
            <input name="phone" inputMode="tel" maxLength={20} defaultValue={staff.phone ?? ''} className="input py-2" />
          </label>
        </div>
        <RoleChecks roles={roles} selected={staff.roles} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={staff.active} disabled={isSelf} className="h-4 w-4 accent-maroon" />
          Active (can sign in)
          {isSelf && <input type="hidden" name="active" value="on" />}
        </label>
        <p className="text-xs text-muted">Deactivating, or removing a role, signs them out at once. History stays: their calls, visits and sign-offs remain under their name.</p>
        <div className="flex gap-2">
          <Submit className="btn-primary py-2">Save</Submit>
          <button type="button" className="btn-outline py-2" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </ActionForm>
      {staff.email && staff.active && (
        <ActionForm action={sendResetAction} reset={false} className="border-t border-line pt-3">
          <input type="hidden" name="staffId" value={staff.id} />
          <Submit className="btn-outline py-1.5 text-xs">{emails ? `Email a password reset link to ${staff.email}` : 'Send password reset (no email locally)'}</Submit>
        </ActionForm>
      )}
    </div>
  );
}

export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction} reset>
      <label className="block">
        <span className={lbl}>Work email</span>
        <input name="email" type="email" autoComplete="username" required maxLength={254} className="input" />
      </label>
      <Submit className="btn-primary w-full py-3">Email me a link</Submit>
    </ActionForm>
  );
}

export function ResetPasswordForm({ token, type }: { token: string; type: 'recovery' | 'invite' }) {
  return (
    <ActionForm action={resetPasswordAction} reset={false}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="type" value={type} />
      <label className="block">
        <span className={lbl}>New password</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="input" />
        <span className="mt-1 block text-xs text-muted">At least 10 characters. A short sentence you’ll remember works well.</span>
      </label>
      <label className="block">
        <span className={lbl}>Type it again</span>
        <input name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="input" />
      </label>
      <Submit className="btn-primary w-full py-3">{type === 'invite' ? 'Set password' : 'Change password'}</Submit>
    </ActionForm>
  );
}
