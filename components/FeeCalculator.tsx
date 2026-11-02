'use client';
import { useMemo, useState } from 'react';
import { programs, type ProgramSlug } from '@/content/programs';
import { fees } from '@/content/sample';
import { calculateFee, formatINR, STAY_OPTIONS, type Stay } from '@/lib/fees';
import { LeadForm } from './forms';
import { SampleBadge } from './ui';

export function FeeCalculator({ initialProgram = 'iit-jee' }: { initialProgram?: ProgramSlug }) {
  const [slug, setSlug] = useState<ProgramSlug>(initialProgram);
  const [stay, setStay] = useState<Stay>('hostel-nonac');
  const [score, setScore] = useState('');
  const [gpa, setGpa] = useState(false);
  const [instalments, setInstalments] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const program = programs.find((p) => p.slug === slug)!;
  const scoreNum = score === '' ? null : Math.min(100, Math.max(0, Number(score)));
  const r = useMemo(() => calculateFee({ track: program.track, stay, bsatScore: scoreNum, ssc10Gpa: gpa, instalments }), [program.track, stay, scoreNum, gpa, instalments]);

  const summary = `${program.name}, ${STAY_OPTIONS.find((s) => s.value === stay)?.label}, BSAT ${scoreNum ?? 'not taken'}${gpa ? ', SSC 10 GPA' : ''}, ${r.instalments} instalment(s): year 1 ${formatINR(r.yearOne)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="card space-y-6 p-5 sm:p-6">
        <fieldset>
          <legend className="label">Program</legend>
          <div className="grid grid-cols-2 gap-2">
            {programs.map((p) => (
              <button key={p.slug} type="button" aria-pressed={slug === p.slug} onClick={() => setSlug(p.slug)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${slug === p.slug ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line hover:border-gold'}`}>
                <span className="block font-semibold">{p.short}</span>
                <span className="block text-xs opacity-75">{p.duration}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Stay</legend>
          <div className="grid grid-cols-2 gap-2">
            {STAY_OPTIONS.map((s) => (
              <button key={s.value} type="button" aria-pressed={stay === s.value} onClick={() => setStay(s.value)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${stay === s.value ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line hover:border-gold'}`}>
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-xs opacity-75">{s.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">BSAT score (%)</span>
            <input className="input font-mono" type="number" inputMode="numeric" min={0} max={100} placeholder="Not taken yet" value={score} onChange={(e) => setScore(e.target.value)} />
          </label>
          <label className="flex items-end gap-2.5 pb-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-maroon" checked={gpa} onChange={(e) => setGpa(e.target.checked)} />
            10 GPA in SSC (+10%)
          </label>
        </div>

        <fieldset>
          <legend className="label">Pay in</legend>
          <div className="inline-flex rounded-full border border-line p-1">
            {fees.instalmentOptions.map((n) => (
              <button key={n} type="button" aria-pressed={instalments === n} onClick={() => setInstalments(n)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${instalments === n ? 'bg-maroon text-white' : 'text-muted hover:text-ink'}`}>
                {n === 1 ? 'Full' : `${n} instalments`}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="card overflow-hidden" aria-live="polite">
        <div className="flex items-center justify-between gap-3 bg-navy px-5 py-4 text-white sm:px-6">
          <p className="font-display text-lg">
            Year 1 estimate <SampleBadge show={fees.sample} />
          </p>
          {r.scholarshipPct > 0 && <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy-950">{r.scholarshipPct}% scholarship</span>}
        </div>
        <table className="table-base">
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.label}>
                <td className="text-ink/85">{l.label}</td>
                <td className={`text-right font-mono ${l.kind === 'discount' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : ''}`}>{formatINR(l.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="font-semibold text-heading">Year 1 total</td>
              <td className="text-right font-mono text-lg font-semibold text-heading">{formatINR(r.yearOne)}</td>
            </tr>
          </tbody>
        </table>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <div className="rounded-xl bg-bg p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{r.instalments === 1 ? 'Pay once' : `Each of ${r.instalments} instalments`}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-maroon dark:text-gold">{formatINR(r.perInstalment)}</p>
          </div>
          {r.yearTwo !== null ? (
            <div className="rounded-xl bg-bg p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Year 2 (no admission fee)</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-heading">{formatINR(r.yearTwo)}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-bg p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Program length</p>
              <p className="mt-1 text-lg font-semibold text-heading">1 year</p>
            </div>
          )}
        </div>
        <div className="border-t border-line p-5 sm:p-6">
          {showForm ? (
            <LeadForm source="fee_calculator" program={slug} note={summary} submitLabel="Send me this quote" successTitle="Quote saved" successText="Our admissions team will share this fee quote with you and answer any questions." showProgram={false} />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted">Estimate only. Year 2 assumes the same yearly fee. The final fee is confirmed in your admission letter.</p>
              <button type="button" className="btn-gold shrink-0" onClick={() => setShowForm(true)}>
                Get this quote on WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
