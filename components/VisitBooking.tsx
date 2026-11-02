'use client';
import { useEffect, useState } from 'react';
import { fullAddress, mapsLinkUrl } from '@/content/college';
import { programs } from '@/content/programs';
import { getAttribution, postJson } from '@/lib/attribution';
import { formatDate } from '@/lib/dates';
import { Consent, Field, FormError, Honeypot, PhoneInput, Success } from './forms';

type Slot = { slot: string; label: string; available: number };

export function VisitBooking({ dates }: { dates: string[] }) {
  const [date, setDate] = useState(dates[0] ?? '');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [program, setProgram] = useState('');
  const [familySize, setFamilySize] = useState(2);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlots(null);
    setSlot('');
    setSlotError(null);
    fetch(`/api/visits?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setSlots(d.slots);
        else setSlotError(d.error ?? 'Could not load slots.');
      })
      .catch(() => !cancelled && setSlotError('Could not load slots. Please check your connection.'));
    return () => {
      cancelled = true;
    };
  }, [date, reload]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return setError('Please choose a time slot.');
    setError(null);
    setSending(true);
    const res = await postJson<{ when: string }>('/api/visits', { name, phone, program: program || undefined, date, slot, familySize, consent, website, attribution: getAttribution() });
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong.');
      if (res.error?.includes('filled up')) setReload((n) => n + 1);
      return;
    }
    setBooked(res.when ?? `${formatDate(date)}`);
  }

  if (booked) {
    return (
      <Success title="Your campus visit is booked">
        <p>
          <strong>{booked}</strong>
        </p>
        <p className="mt-1">
          {fullAddress}.{' '}
          <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open in Google Maps
          </a>
        </p>
        <p className="mt-2">You’ll get a WhatsApp confirmation now and reminders 1 day and 2 hours before your visit.</p>
      </Success>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-6" noValidate>
      <fieldset>
        <legend className="label">1 · Choose a day</legend>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {dates.map((d) => {
            const [wd, day, mon] = [formatDate(d, { weekday: 'short' }), formatDate(d, { day: 'numeric' }), formatDate(d, { month: 'short' })];
            const active = d === date;
            return (
              <button key={d} type="button" aria-pressed={active} onClick={() => setDate(d)} className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-xl border py-2 transition ${active ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line bg-surface hover:border-gold'}`}>
                <span className="text-[11px] uppercase tracking-wider opacity-75">{wd}</span>
                <span className="font-mono text-xl font-semibold">{day}</span>
                <span className="text-[11px] opacity-75">{mon}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">2 · Choose a time</legend>
        {slotError && <FormError message={slotError} />}
        {!slots && !slotError && <p className="text-sm text-muted">Loading available slots…</p>}
        {slots && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const full = s.available <= 0;
              const active = slot === s.slot;
              return (
                <button key={s.slot} type="button" disabled={full} aria-pressed={active} onClick={() => setSlot(s.slot)} className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-maroon bg-maroon text-white' : 'border-line bg-surface hover:border-gold'}`}>
                  <span className="block font-mono font-semibold">{s.label}</span>
                  <span className="block text-xs opacity-75">{full ? 'Full' : `${s.available} left`}</span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="label">3 · Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parent / student name">
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Mobile (WhatsApp)">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
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
          <Field label="People visiting">
            <select className="input" value={familySize} onChange={(e) => setFamilySize(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <Honeypot value={website} onChange={setWebsite} />
      <Consent checked={consent} onChange={setConsent} />
      <FormError message={error} />
      <button type="submit" className="btn-primary w-full py-3 sm:w-auto sm:px-10" disabled={sending}>
        {sending ? 'Booking…' : 'Confirm visit'}
      </button>
    </form>
  );
}
