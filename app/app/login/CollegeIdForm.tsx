'use client';
import { useState } from 'react';
import { collegeIdLoginAction } from '@/app/app/portal-actions';
import { ActionForm, Submit } from '@/components/crm/forms';

/** §9A.2: students may sign in with College ID + password (set once from the app after an OTP sign-in). */
export function CollegeIdForm() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-center text-sm font-semibold text-maroon underline dark:text-gold">
        Student? Sign in with College ID and password
      </button>
    );
  return (
    <ActionForm action={collegeIdLoginAction} reset={false} className="mt-4 space-y-3 border-t border-line pt-4">
      <label className="block">
        <span className="label">College ID</span>
        <input name="collegeId" required autoComplete="username" placeholder="BJC-2027-JEE-0001" className="input font-mono uppercase" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      <Submit className="btn-primary w-full py-3">Sign in</Submit>
    </ActionForm>
  );
}
