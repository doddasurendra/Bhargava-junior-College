'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { verifyEmailAction } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full py-3" disabled={pending}>{pending ? 'Please wait…' : 'Confirm my email'}</button>;
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [s, action] = useFormState<{ ok?: boolean; error?: string }, FormData>(verifyEmailAction, {});
  if (s.ok)
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">Email confirmed. Your student account is ready.</p>
        <Link href="/app/login?as=student" className="btn-primary block w-full py-3 text-center">Sign in</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {s.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{s.error}</p>}
      <Submit />
    </form>
  );
}
