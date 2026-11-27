'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { parentRegisterAction, type RegState } from './actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full py-3" disabled={pending}>
      {pending ? 'Please wait…' : children}
    </button>
  );
}

const Err = ({ s }: { s: RegState }) => (s.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-400/10 dark:text-red-200">{s.error}</p> : null);
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
);
const Steps = ({ at, labels }: { at: number; labels: string[] }) => (
  <ol className="mb-4 flex gap-2 text-[11px] uppercase tracking-wider" aria-label="Steps">
    {labels.map((l, i) => <li key={l} aria-current={i === at ? 'step' : undefined} className={`flex-1 rounded-full px-2 py-1 text-center ${i === at ? 'bg-navy text-white dark:bg-gold dark:text-navy-950' : i < at ? 'bg-bg text-heading' : 'bg-bg text-muted'}`}>{i + 1}. {l}</li>)}
  </ol>
);

function CodeStep({ s, action }: { s: RegState; action: (fd: FormData) => void }) {
  return (
    <form action={action} className="space-y-4">
      <Field label={`Code sent to ${s.to ?? 'WhatsApp'}`}>
        <input name="code" className="input text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
      </Field>
      {s.devCode && <p className="rounded-lg border border-dashed border-gold bg-gold-100 px-3 py-2 font-mono text-xs text-navy">Development mode (WhatsApp not connected): code is {s.devCode}</p>}
      <Err s={s} />
      <Submit>Verify</Submit>
      <Restart action={action} />
    </form>
  );
}

const Restart = ({ action }: { action: (fd: FormData) => void }) => (
  <button formAction={action} name="restart" value="1" formNoValidate className="w-full text-center text-xs text-muted underline">Start again</button>
);

const Done = ({ s }: { s: RegState }) => (
  <div className="space-y-4">
    <p role="status" className={`rounded-lg px-3 py-3 text-sm ${s.result === 'pending' ? 'bg-gold-100 text-navy' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{s.message}</p>
    <Link href="/app/login" className="btn-primary block w-full py-3 text-center">Go to sign in</Link>
  </div>
);

export function ParentRegisterForm() {
  const [s, action] = useFormState<RegState, FormData>(parentRegisterAction, { step: 'details' });
  const at = { details: 0, code: 1, account: 1, done: 2 }[s.step];
  return (
    <>
      <Steps at={at} labels={['Details', 'Mobile', 'Linked']} />
      {s.step === 'done' ? <Done s={s} /> : s.step === 'code' ? <CodeStep s={s} action={action} /> : (
        <form action={action} className="space-y-4">
          <Field label="Your full name"><input name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" /></Field>
          <Field label="You are the student’s">
            <select name="relation" required defaultValue="" className="input py-2">
              <option value="" disabled>Choose…</option>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="other">Other family member</option>
            </select>
          </Field>
          <Field label="Your mobile number (WhatsApp)"><input name="phone" type="tel" inputMode="numeric" required maxLength={14} placeholder="98xxxxxxxx" className="input" autoComplete="tel" /></Field>
          <Field label="Child’s College ID / admission number"><input name="collegeId" required maxLength={40} placeholder="BJC-2027-JEE-0001" className="input font-mono uppercase" /></Field>
          <Field label="Child’s date of birth"><input name="dob" type="date" required className="input" /></Field>
          <Err s={s} />
          <Submit>Send verification code</Submit>
          <p className="text-xs text-muted">More than one child at the college? Register once per child with the same mobile number; you switch between them inside the app.</p>
        </form>
      )}
    </>
  );
}
