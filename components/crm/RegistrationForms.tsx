'use client';
import { approveRegistrationAction, registerStaffAction, rejectRegistrationAction } from '@/app/crm/registration-actions';
import { ActionForm, Submit } from './forms';

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';
type Opt = { value: string; label: string };

export function StaffRegisterForm({ roles, departments, defaultRole }: { roles: Opt[]; departments: string[]; defaultRole?: string }) {
  return (
    <ActionForm action={registerStaffAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={lbl}>Full name</span>
          <input name="fullName" required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </label>
        <label className="block">
          <span className={lbl}>Employee ID</span>
          <input name="employeeId" required minLength={2} maxLength={30} pattern="[A-Za-z0-9/\-]{2,30}" className="input font-mono" />
        </label>
        <label className="block">
          <span className={lbl}>Mobile number</span>
          <input name="phone" type="tel" required inputMode="numeric" maxLength={14} autoComplete="tel" placeholder="98xxxxxxxx" className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className={lbl}>Official email</span>
          <input name="email" type="email" required maxLength={254} autoComplete="username" className="input" />
        </label>
        <label className="block">
          <span className={lbl}>Department</span>
          <select name="department" required className="input py-2" defaultValue="">
            <option value="" disabled>Choose…</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Designation</span>
          <input name="designation" required minLength={2} maxLength={60} placeholder="Senior Lecturer, Physics" className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className={lbl}>Account needed</span>
          <select name="requestedRole" required className="input py-2" defaultValue={defaultRole ?? ''}>
            <option value="" disabled>Choose…</option>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Password</span>
          <input name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="input" />
          <span className="mt-1 block text-xs text-muted">At least 10 characters.</span>
        </label>
        <label className="block">
          <span className={lbl}>Confirm password</span>
          <input name="confirm" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="input" />
        </label>
        <label className="hidden" aria-hidden="true">
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Submit className="btn-primary w-full py-3">Request account</Submit>
    </ActionForm>
  );
}

/** One pending request: confirm (or change) the roles and approve, or decline with a reason. */
export function RegistrationDecision({ id, requested, roles }: { id: string; requested: string; roles: Opt[] }) {
  return (
    <div className="mt-2 grid gap-3 lg:grid-cols-2">
      <ActionForm action={approveRegistrationAction} reset={false} className="space-y-2 rounded-xl border border-line p-3">
        <input type="hidden" name="id" value={id} />
        <p className={lbl}>Approve with role(s)</p>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {roles.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5">
              <input type="checkbox" name="roles" value={r.value} defaultChecked={r.value === requested} className="h-3.5 w-3.5 accent-maroon" />
              {r.label}
            </label>
          ))}
        </div>
        <Submit className="btn-primary py-1.5 text-sm">Approve</Submit>
      </ActionForm>
      <ActionForm action={rejectRegistrationAction} reset={false} className="space-y-2 rounded-xl border border-line p-3">
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className={lbl}>Decline: reason shown to the applicant</span>
          <input name="note" required minLength={3} maxLength={300} className="input py-2 text-sm" placeholder="Employee ID does not match our records" />
        </label>
        <Submit className="btn-outline py-1.5 text-sm">Decline</Submit>
      </ActionForm>
    </div>
  );
}
