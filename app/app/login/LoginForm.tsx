'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { PhoneInput } from '@/components/forms';
import { useState } from 'react';
import { loginAction, type LoginState } from '../actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full py-3" disabled={pending}>
      {pending ? 'Please wait…' : children}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState<LoginState, FormData>(loginAction, { step: 'phone' });
  const [phone, setPhone] = useState('');

  if (state.step === 'code') {
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="phone" value={state.phone} />
        <label className="block">
          <span className="label">Code sent on WhatsApp to {state.phone?.replace(/^\+91/, '+91 ')}</span>
          <input name="code" className="input text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
        </label>
        <p className="text-xs text-muted">If this number is registered with the college, you will receive a 6-digit code.</p>
        {state.devCode && <p className="rounded-lg border border-dashed border-gold bg-gold-100 px-3 py-2 font-mono text-xs text-navy">Development mode: code is {state.devCode}</p>}
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>}
        <Submit>Sign in</Submit>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Mobile number</span>
        <PhoneInput value={phone} onChange={setPhone} />
      </label>
      <input type="hidden" name="phone" value={phone} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>}
      <Submit>Send sign-in code</Submit>
    </form>
  );
}
