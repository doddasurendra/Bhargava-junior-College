'use client';
import { useState } from 'react';
import type { Content } from '@/lib/cms/blocks';
import { getAttribution, postJson } from '@/lib/attribution';
import { formatDate } from '@/lib/dates';
import { Consent, Field, FormError, Honeypot, PhoneInput, Success } from './forms';

export function BsatForm({ upcomingIds, bsat }: { upcomingIds: string[]; bsat: Pick<Content['bsat'], 'sessions' | 'resultsWithin'> }) {
  const sessions = bsat.sessions.filter((s) => upcomingIds.includes(s.id));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stream, setStream] = useState<'MPC' | 'BiPC'>('MPC');
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hallTicket: string; alreadyRegistered: boolean; date: string; mode: string } | null>(null);

  if (sessions.length === 0) {
    return <p className="card p-6 text-muted">There are no upcoming BSAT dates right now. New dates will be announced here.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ hallTicket: string; alreadyRegistered: boolean; date: string; mode: string }>('/api/bsat', { name, phone, stream, sessionId, consent, website, attribution: getAttribution() });
    setBusy(false);
    if (!res.ok || !res.hallTicket) return setError(res.error ?? 'Something went wrong.');
    setDone({ hallTicket: res.hallTicket, alreadyRegistered: Boolean(res.alreadyRegistered), date: res.date ?? '', mode: res.mode ?? '' });
  }

  if (done) {
    return (
      <Success title={done.alreadyRegistered ? 'You are already registered' : 'You are registered for BSAT'}>
        <p>
          Hall ticket number: <span className="font-mono text-lg font-semibold text-maroon dark:text-gold">{done.hallTicket}</span>
        </p>
        {!done.alreadyRegistered && (
          <p className="mt-1">
            Test on {done.date} ({done.mode === 'online' ? 'online' : 'at the campus'}). Your hall ticket and instructions will be sent on WhatsApp. Results are out within {bsat.resultsWithin}.
          </p>
        )}
      </Success>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </Field>
        <Field label="Parent mobile (WhatsApp)">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
      </div>
      <fieldset>
        <legend className="label">Stream</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['MPC', 'Engineering (Maths)'],
              ['BiPC', 'Medical (Biology)'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={stream === v} onClick={() => setStream(v)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${stream === v ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line hover:border-gold'}`}>
              <span className="block font-semibold">{v}</span>
              <span className="block text-xs opacity-75">{l}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Test date</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {sessions.map((s) => (
            <button key={s.id} type="button" aria-pressed={sessionId === s.id} onClick={() => setSessionId(s.id)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${sessionId === s.id ? 'border-maroon bg-maroon text-white' : 'border-line hover:border-gold'}`}>
              <span className="block font-semibold">{formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="block text-xs opacity-75">{s.mode === 'online' ? 'Online' : 'At campus'}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Honeypot value={website} onChange={setWebsite} />
      <Consent checked={consent} onChange={setConsent} />
      <FormError message={error} />
      <button className="btn-primary w-full py-3" disabled={busy}>
        {busy ? 'Registering…' : 'Register for BSAT'}
      </button>
    </form>
  );
}
