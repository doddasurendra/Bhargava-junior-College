'use client';
import { useId, useState, type ReactNode } from 'react';
import { college } from '@/content/college';
import { programs, type ProgramSlug } from '@/content/programs';
import { getAttribution, postJson } from '@/lib/attribution';
import { CLASS_OPTIONS, type LeadSource } from '@/lib/validation';

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-maroon dark:text-red-300">{error}</span>}
    </label>
  );
}

export function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-xs leading-5 text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-maroon" required />
      <span>
        I agree that {college.name} may contact me by call, SMS and WhatsApp about admissions, and store these details for that purpose (DPDP Act 2023).
      </span>
    </label>
  );
}

/** Hidden honeypot field; bots fill it, people don't. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-maroon/10 px-3 py-2 text-sm font-medium text-maroon dark:bg-red-400/10 dark:text-red-300">
      {message}
    </p>
  );
}

export function Success({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="animate-rise rounded-2xl border border-gold/40 bg-gold-100/60 p-5 text-navy dark:bg-gold/10 dark:text-white">
      <p className="flex items-center gap-2 font-display text-xl">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-sm text-navy-950">✓</span>
        {title}
      </p>
      {children && <div className="mt-2 text-sm leading-6 text-ink/80 dark:text-white/80">{children}</div>}
    </div>
  );
}

export function PhoneInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="flex">
      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-bg px-3 font-mono text-sm text-muted">+91</span>
      <input
        id={id}
        className="input rounded-l-none font-mono"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        maxLength={14}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ''))}
        required
      />
    </div>
  );
}

export interface LeadFormProps {
  source: LeadSource;
  program?: ProgramSlug;
  heading?: string;
  sub?: string;
  submitLabel?: string;
  showProgram?: boolean;
  showClass?: boolean;
  showNote?: boolean;
  note?: string;
  successTitle?: string;
  successText?: ReactNode;
  onSuccess?: () => void;
}

/** Every lead form on the site posts here → one CRM lead, deduplicated by mobile (brief §4.4). */
export function LeadForm({
  source,
  program: fixedProgram,
  heading,
  sub,
  submitLabel = 'Request a callback',
  showProgram = true,
  showClass = false,
  showNote = false,
  note: presetNote,
  successTitle = 'Thank you!',
  successText,
  onSuccess,
}: LeadFormProps) {
  const uid = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [program, setProgram] = useState<string>(fixedProgram ?? '');
  const [studentClass, setStudentClass] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    const res = await postJson('/api/leads', {
      name,
      phone,
      source,
      program: program || undefined,
      studentClass: studentClass || undefined,
      note: [presetNote, note].filter(Boolean).join(' · ') || undefined,
      consent,
      website,
      attribution: getAttribution(),
    });
    if (!res.ok) {
      setStatus('idle');
      setError(res.error ?? 'Something went wrong.');
      return;
    }
    setStatus('done');
    onSuccess?.();
  }

  if (status === 'done') {
    return (
      <Success title={successTitle}>
        {successText ?? (
          <>
            Our admissions team will call you back during office hours ({college.hoursShort}). Need us sooner? Call{' '}
            <a className="font-mono font-semibold underline" href={`tel:${college.phones[0].tel}`}>
              {college.phones[0].display}
            </a>
            .
          </>
        )}
      </Success>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-4" noValidate>
      {heading && (
        <div>
          <h3 className="font-display text-2xl text-heading">{heading}</h3>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
      )}
      <Field label="Your name">
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Parent or student name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Mobile number">
        <PhoneInput id={`${uid}-phone`} value={phone} onChange={setPhone} />
      </Field>
      {(showProgram && !fixedProgram) || showClass ? (
        <div className={`grid gap-4 ${showProgram && !fixedProgram && showClass ? 'sm:grid-cols-2' : ''}`}>
          {showProgram && !fixedProgram && (
            <Field label="Interested in">
              <select className="input" value={program} onChange={(e) => setProgram(e.target.value)}>
                <option value="">Not sure yet</option>
                {programs.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {showClass && (
            <Field label="Student is in">
              <select className="input" value={studentClass} onChange={(e) => setStudentClass(e.target.value)}>
                <option value="">Select</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      ) : null}
      {showNote && (
        <Field label="Your question (optional)">
          <textarea className="input min-h-[88px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      )}
      <Honeypot value={website} onChange={setWebsite} />
      <Consent checked={consent} onChange={setConsent} />
      <FormError message={error} />
      <button type="submit" className="btn-primary w-full py-3" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
