'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { blockStudentAccountAction, parentResetCodeAction, type AcctState } from './actions';

function Btn({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? 'Please wait…' : children}</button>;
}
const Msg = ({ s }: { s: AcctState }) => (
  <>
    {s.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{s.error}</p>}
    {s.message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{s.message}</p>}
  </>
);

export function ResetCode() {
  const [s, action] = useFormState<AcctState>(parentResetCodeAction, {});
  return (
    <form action={action} className="space-y-3">
      <Msg s={s} />
      {s.code && (
        <div role="status" className="rounded-lg border border-dashed border-gold bg-gold-100 p-3 text-center text-navy">
          <p className="text-xs">Give this code to your child. They enter it on <b>Forgot password?</b> with their College ID.</p>
          <p className="mt-1 font-mono text-3xl tracking-[0.3em]" data-testid="reset-code">{s.code}</p>
          <p className="text-[11px]">Valid for 30 minutes, once.</p>
        </div>
      )}
      <Btn className="btn-outline w-full py-2">{s.code ? 'Make a new code' : 'Reset student password'}</Btn>
    </form>
  );
}

export function BlockAccount() {
  const [s, action] = useFormState<AcctState, FormData>(blockStudentAccountAction, {});
  if (s.message) return <Msg s={s} />;
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1" /> This account was not created by my child. Block it.</label>
      <Msg s={s} />
      <Btn className="w-full rounded-full bg-red-700 py-2 text-sm font-semibold text-white">Block student account</Btn>
    </form>
  );
}
