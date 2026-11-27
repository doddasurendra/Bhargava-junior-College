'use client';
import Link from 'next/link';
import { collegeIdLoginAction } from '@/app/app/portal-actions';
import { ActionForm, Submit } from '@/components/crm/forms';

/**
 * Student sign-in: College ID (registration number) or the email given at registration, and a password.
 * Students never sign in with a phone number.
 */
export function CollegeIdForm() {
  return (
    <ActionForm action={collegeIdLoginAction} reset={false} className="space-y-3">
      <label className="block">
        <span className="label">College ID / Registration number</span>
        <input name="collegeId" required autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="BJC-2027-JEE-0001" className="input font-mono" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      <Submit className="btn-primary w-full py-3">Sign in</Submit>
      <p className="flex justify-between text-xs">
        <Link href="/app/register/student" className="underline">New student? Sign up</Link>
        <Link href="/app/forgot-password" className="underline">Forgot password?</Link>
      </p>
    </ActionForm>
  );
}
