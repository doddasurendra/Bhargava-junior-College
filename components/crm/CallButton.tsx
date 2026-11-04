'use client';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { callLeadAction, type CallState } from '@/app/crm/admin-actions';

function Btn({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? 'Calling…' : 'Call'}
    </button>
  );
}

/**
 * Click-to-call. The number is not in the page for masked roles: the server either bridges the call through
 * cloud telephony or returns the number once (audited) and the phone's dialler opens.
 */
export function CallButton({ leadId, className = 'btn-primary py-2' }: { leadId: string; className?: string }) {
  const [state, action] = useFormState<CallState, FormData>(callLeadAction, {});
  useEffect(() => {
    if (state.tel) window.location.href = `tel:${state.tel}`;
  }, [state]);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="leadId" value={leadId} />
      <Btn className={className} />
      {state.error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.error}
        </span>
      )}
      {state.message && (
        <span role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
          {state.message}
        </span>
      )}
    </form>
  );
}
