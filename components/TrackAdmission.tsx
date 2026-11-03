'use client';
import Link from 'next/link';
import { useState } from 'react';
import { college } from '@/content/college';
import type { TimelineStep } from '@/lib/admission';
import { postJson } from '@/lib/attribution';
import { formatDateTime } from '@/lib/dates';
import { Field, FormError, PhoneInput } from './forms';

type Child = { studentName: string | null; program: string | null; owner: string | null; nextUpdate: string | null; upcomingVisit: string | null; timeline: TimelineStep[] };
type Result = { found: false } | { found: true; children: Child[] };

function ChildStatus({ child }: { child: Child }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-navy p-5 text-white sm:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-gold-300">Admission status</p>
        <p className="mt-1 font-display text-2xl">{child.studentName ?? 'Your application'}</p>
        {child.program && <p className="text-sm text-white/75">{child.program}</p>}
      </div>
      <ol className="relative space-y-0 p-5 sm:p-6">
        {child.timeline.map((s, i) => (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < child.timeline.length - 1 && <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5 ${s.status === 'done' ? 'bg-gold' : 'bg-line'}`} />}
            <span
              aria-hidden
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.status === 'done' ? 'bg-gold text-navy-950' : s.status === 'current' ? 'bg-maroon text-white ring-4 ring-maroon/20' : 'border-2 border-line bg-surface text-muted'
              }`}
            >
              {s.status === 'done' ? '✓' : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`font-semibold ${s.status === 'pending' ? 'text-muted' : 'text-heading'}`}>
                {s.label} {s.status === 'current' && <span className="ml-1 rounded-full bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold text-maroon dark:text-gold">In progress</span>}
              </p>
              <p className="text-xs text-muted">
                {s.owner}
                {s.at && ` · ${formatDateTime(s.at)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 border-t border-line p-5 text-sm sm:grid-cols-3 sm:p-6">
        <p>
          <span className="block text-xs uppercase tracking-wider text-muted">Your contact</span>
          {child.owner ?? 'Admissions office'}
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wider text-muted">Upcoming visit</span>
          {child.upcomingVisit ?? '—'}
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wider text-muted">Next update by</span>
          {child.nextUpdate ? formatDateTime(child.nextUpdate) : '—'}
        </p>
      </div>
    </div>
  );
}

export function TrackAdmission() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'result'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ devCode?: string }>('/api/otp', { phone });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Could not send the code.');
    setDevCode(res.devCode ?? null);
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<Result>('/api/track', { phone, code });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Could not verify the code.');
    setResult(res as unknown as Result);
    setStep('result');
  }

  if (step === 'result' && result) {
    if (!result.found) {
      return (
        <div className="card p-6">
          <p className="font-display text-2xl text-heading">No admission found for this number</p>
          <p className="lead-text mt-2">If you enquired with a different number, try that one. Otherwise, start your admission journey below.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact#enquire" className="btn-primary">Enquire now</Link>
            <Link href="/visit" className="btn-outline">Book a campus visit</Link>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {result.children.length > 1 && <p className="text-sm text-muted">{result.children.length} children are registered with this number.</p>}
        {result.children.map((c, n) => (
          <ChildStatus key={n} child={c} />
        ))}
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      {step === 'phone' ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <Field label="Mobile number used for the enquiry">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <FormError message={error} />
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Sending…' : 'Send verification code'}
          </button>
          <p className="text-xs text-muted">We send a one-time code to this number so that only you can see the admission details.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4" noValidate>
          <Field label={`Code sent to +91 ${phone}`}>
            <input className="input text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          {devCode && <p className="rounded-lg border border-dashed border-gold bg-gold-100 px-3 py-2 font-mono text-xs text-navy">Development mode (no SMS provider): code is {devCode}</p>}
          <FormError message={error} />
          <button className="btn-primary w-full py-3" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'View admission status'}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted underline" onClick={() => { setStep('phone'); setCode(''); setError(null); }}>
              Change number
            </button>
            <button type="button" className="text-muted underline" onClick={() => sendCode()} disabled={busy}>
              Resend code
            </button>
          </div>
        </form>
      )}
      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
        Trouble? Call <a className="font-mono font-semibold" href={`tel:${college.phones[0].tel}`}>{college.phones[0].display}</a>
      </p>
    </div>
  );
}
