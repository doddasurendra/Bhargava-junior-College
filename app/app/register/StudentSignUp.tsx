'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { studentResetAction, studentSignUpAction, type FormState } from './student-actions';
import type { SKey } from '@/lib/app/signupText';

type D = Record<SKey, string>;
const ORDER = ['name', 'collegeId', 'dob', 'password', 'confirm', 'consent', 'code'];

function SubmitBtn({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full py-3" disabled={pending} aria-busy={pending}>{pending ? busy : idle}</button>;
}

const FieldErr = ({ id, msg }: { id: string; msg?: string }) => (msg ? <span id={`${id}-err`} className="mt-1 block text-xs font-medium text-red-700 dark:text-red-300">{msg}</span> : null);

/** Moves focus to the first field with an error after the server answers. */
function useFocusFirstError(form: React.RefObject<HTMLFormElement>, s: FormState) {
  useEffect(() => {
    const f = ORDER.find((k) => s.fields?.[k]);
    if (f) (form.current?.querySelector(`[name="${f}"]`) as HTMLElement | null)?.focus();
  }, [s, form]);
}

function strength(pw: string) {
  let n = 0;
  if (pw.length >= 8) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  return pw ? (n <= 2 ? 1 : n <= 3 ? 2 : 3) : 0;
}

function PasswordPair({ d, s, label }: { d: D; s: FormState; label: string }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const lv = strength(pw);
  return (
    <>
      <label className="block">
        <span className="label">{label}</span>
        <span className="relative block">
          <input name="password" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!s.fields?.password} aria-describedby="password-hint password-err" className="input pr-16" />
          <button type="button" onClick={() => setShow((x) => !x)} className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2 text-xs font-semibold text-maroon dark:text-gold" aria-pressed={show}>{show ? d.hide : d.show}</button>
        </span>
        <span id="password-hint" className="mt-1 block text-xs text-muted">{d.pwHint}</span>
        {pw && (
          <span className="mt-1 flex items-center gap-2 text-xs" aria-live="polite">
            <span className="flex flex-1 gap-1" aria-hidden>{[1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= lv ? (lv === 1 ? 'bg-red-500' : lv === 2 ? 'bg-amber-500' : 'bg-emerald-600') : 'bg-line'}`} />)}</span>
            <span className="w-14 text-right text-muted">{lv === 1 ? d.weak : lv === 2 ? d.fair : d.strong}</span>
          </span>
        )}
        <FieldErr id="password" msg={s.fields?.password} />
      </label>
      <label className="block">
        <span className="label">{d.confirm}</span>
        <input name="confirm" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" aria-invalid={!!s.fields?.confirm} aria-describedby="confirm-err" className="input" />
        <FieldErr id="confirm" msg={s.fields?.confirm} />
      </label>
    </>
  );
}

const CollegeIdInput = ({ s }: { s: FormState }) => (
  <input name="collegeId" required maxLength={30} placeholder="BJC-2027-JEE-0001" autoComplete="username" autoCapitalize="characters" spellCheck={false} aria-invalid={!!s.fields?.collegeId} aria-describedby="collegeId-err" className="input font-mono uppercase" onChange={(e) => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); }} />
);

export function StudentSignUpForm({ d, minDob, maxDob, purposes }: { d: D; minDob: string; maxDob: string; purposes: readonly string[] }) {
  const [s, action] = useFormState<FormState, FormData>(studentSignUpAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(ref, s);
  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      {/* honeypot: people never see or fill this */}
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="block">
        <span className="label">{d.name}</span>
        <input name="name" required minLength={2} maxLength={60} autoComplete="name" aria-invalid={!!s.fields?.name} aria-describedby="name-hint name-err" className="input" />
        <span id="name-hint" className="mt-1 block text-xs text-muted">{d.nameHint}</span>
        <FieldErr id="name" msg={s.fields?.name} />
      </label>
      <label className="block">
        <span className="label">{d.cid}</span>
        <CollegeIdInput s={s} />
        <FieldErr id="collegeId" msg={s.fields?.collegeId} />
      </label>
      <label className="block">
        <span className="label">{d.dob}</span>
        {/* empty by default (no 01/01/0001); the browser shows DD/MM/YYYY in Indian locales */}
        <input name="dob" type="date" required min={minDob} max={maxDob} defaultValue="" aria-invalid={!!s.fields?.dob} aria-describedby="dob-err" className="input" />
        <FieldErr id="dob" msg={s.fields?.dob} />
      </label>
      <PasswordPair d={d} s={s} label={d.pw} />
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" required aria-invalid={!!s.fields?.consent} aria-describedby="consent-err" className="mt-1" />
        <span>
          {d.consent}
          <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer underline">{d.terms}</summary><ul className="mt-1 list-disc pl-4">{purposes.map((x) => <li key={x}>{x}</li>)}</ul></details>
          <FieldErr id="consent" msg={s.fields?.consent} />
        </span>
      </label>
      {s.info === 'exists' && (
        <p role="status" data-testid="signup-exists" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100">
          {d.already}
          <span className="mt-1 block"><Link href="/app/login?as=student" className="font-semibold underline">{d.signin}</Link> · <Link href="/app/forgot-password" className="font-semibold underline">{d.forgot}</Link></span>
        </p>
      )}
      {s.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">{s.error}</p>
      )}
      <SubmitBtn idle={d.create} busy={d.creating} />
      <p className="flex flex-wrap justify-between gap-2 text-sm">
        <span>{d.have} <Link href="/app/login?as=student" className="font-semibold underline">{d.signin}</Link></span>
        <Link href="/app/forgot-password" className="underline">{d.forgot}</Link>
      </p>
    </form>
  );
}

export function StudentResetForm({ d }: { d: D }) {
  const [s, action] = useFormState<FormState, FormData>(studentResetAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(ref, s);
  if (s.done) return (
    <div className="space-y-4">
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{d.done}</p>
      <Link href="/app/login?as=student" className="btn-primary block w-full py-3 text-center">{d.signin}</Link>
    </div>
  );
  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <label className="block"><span className="label">{d.cid}</span><CollegeIdInput s={s} /><FieldErr id="collegeId" msg={s.fields?.collegeId} /></label>
      <label className="block">
        <span className="label">{d.code}</span>
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" aria-invalid={!!s.fields?.code} aria-describedby="code-err" className="input text-center font-mono text-2xl tracking-[0.5em]" />
        <FieldErr id="code" msg={s.fields?.code} />
      </label>
      <PasswordPair d={d} s={s} label={d.newPw} />
      {s.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">{s.error}</p>}
      <SubmitBtn idle={d.setPw} busy={d.saving} />
    </form>
  );
}
