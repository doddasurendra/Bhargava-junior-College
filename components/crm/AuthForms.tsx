'use client';
import { useState } from 'react';
import { adminReset2faAction, adminUnlockAction, disable2faAction, mfaEnrolAction, mfaVerifyAction, regenerateCodesAction, signOutEverywhereAction } from '@/app/crm/auth-actions';
import { ActionForm, Submit } from './forms';

const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

function CodeInput({ name = 'code' }: { name?: string }) {
  return (
    <input
      name={name}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      required
      placeholder="123 456"
      className="input text-center font-mono text-2xl tracking-[0.3em]"
      aria-label="6-digit code"
      autoFocus
    />
  );
}

/** Sign-in step 2: authenticator code, or a recovery code instead. */
export function MfaCodeForm() {
  const [recovery, setRecovery] = useState(false);
  return (
    <ActionForm action={mfaVerifyAction} reset={false}>
      {recovery ? (
        <label className="block">
          <span className={lbl}>Recovery code</span>
          <input name="code" required autoComplete="off" spellCheck={false} placeholder="xxxxx-xxxxx" maxLength={12} className="input text-center font-mono text-xl tracking-widest" autoFocus />
        </label>
      ) : (
        <label className="block">
          <span className={lbl}>Code from your authenticator app</span>
          <CodeInput />
        </label>
      )}
      <Submit className="btn-primary w-full py-3">Verify</Submit>
      <button type="button" onClick={() => setRecovery(!recovery)} className="block w-full text-center text-sm text-muted underline">
        {recovery ? 'Use the authenticator app instead' : 'Lost your phone? Use a recovery code'}
      </button>
    </ActionForm>
  );
}

export function MfaEnrolForm() {
  return (
    <ActionForm action={mfaEnrolAction} reset={false}>
      <label className="block">
        <span className={lbl}>Enter the 6-digit code the app shows</span>
        <CodeInput />
      </label>
      <Submit className="btn-primary w-full py-3">Turn on two-step verification</Submit>
    </ActionForm>
  );
}

export function RegenerateCodesForm() {
  return (
    <ActionForm action={regenerateCodesAction} className="flex flex-wrap items-end gap-2" reset>
      <label className="block">
        <span className={lbl}>Current code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required placeholder="123 456" className="input w-36 py-2 font-mono" />
      </label>
      <Submit className="btn-outline py-2">Make new recovery codes</Submit>
    </ActionForm>
  );
}

export function Disable2faForm() {
  return (
    <ActionForm action={disable2faAction} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className={lbl}>Current code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required placeholder="123 456" className="input w-36 py-2 font-mono" />
      </label>
      <Submit className="btn-outline py-2">Turn off</Submit>
    </ActionForm>
  );
}

export function SignOutEverywhereForm() {
  return (
    <ActionForm action={signOutEverywhereAction} reset={false}>
      <Submit className="btn-outline py-2">Sign out everywhere else</Submit>
    </ActionForm>
  );
}

export function ResetMfaForm({ staffId, name }: { staffId: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-maroon underline dark:text-gold">
        Reset 2FA
      </button>
    );
  return (
    <ActionForm action={adminReset2faAction} className="flex min-w-[220px] flex-col gap-1.5" reset={false}>
      <input type="hidden" name="staffId" value={staffId} />
      <input name="reason" required minLength={5} maxLength={200} placeholder={`Why reset ${name}'s 2FA?`} className="input py-1.5 text-xs" autoFocus />
      <div className="flex gap-1.5">
        <Submit className="btn-primary px-3 py-1 text-xs">Reset and sign out</Submit>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline px-3 py-1 text-xs">
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}

export function UnlockForm({ staffId }: { staffId: string }) {
  return (
    <ActionForm action={adminUnlockAction} reset={false} quiet>
      <input type="hidden" name="staffId" value={staffId} />
      <Submit className="text-xs font-semibold text-maroon underline dark:text-gold">Unlock</Submit>
    </ActionForm>
  );
}

export function RecoveryCodeTools({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = `Bhargava CRM recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-outline py-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a className="btn-outline py-2" download="bhargava-crm-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>
        Download .txt
      </a>
      <button type="button" className="btn-outline py-2" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
