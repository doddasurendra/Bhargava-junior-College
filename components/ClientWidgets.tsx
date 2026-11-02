'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { programs, type ProgramSlug } from '@/content/programs';
import { results, type ResultType } from '@/content/sample';
import { captureFirstTouch } from '@/lib/attribution';
import { LeadForm } from './forms';
import { initials, SampleBadge } from './ui';

/** Captures first-touch UTM/referrer once per session. */
export function ClientBoot() {
  useEffect(() => captureFirstTouch(), []);
  return null;
}

/** Desktop exit-intent enquiry pop-up, shown once per visitor (brief §4.1). */
export function ExitIntent() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);
  const skip = ['/track', '/visit', '/contact', '/scholarship'].some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skip || window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (localStorage.getItem('bjc_exit_seen')) return;
    } catch {
      return;
    }
    const start = Date.now();
    const onOut = (e: MouseEvent) => {
      if (e.clientY > 0 || e.relatedTarget || Date.now() - start < 8000) return;
      setOpen(true);
      try {
        localStorage.setItem('bjc_exit_seen', '1');
      } catch {
        /* ignore */
      }
      document.removeEventListener('mouseout', onOut);
    };
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, [skip]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exit-title" className="card relative w-full max-w-md animate-rise p-6" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg">
          ✕
        </button>
        <p className="eyebrow">Before you go</p>
        <h2 id="exit-title" className="mt-1 font-display text-2xl text-heading">
          Get the 2027–28 fee sheet and BSAT dates on WhatsApp
        </h2>
        <div className="mt-5">
          <LeadForm source="exit_popup" submitLabel="Send them to me" successTitle="On its way" successText="Our admissions team will share the fee sheet and BSAT dates with you on WhatsApp." />
        </div>
      </div>
    </div>
  );
}

export function ResultsGrid() {
  const [filter, setFilter] = useState<'all' | ResultType>('all');
  const years = Array.from(new Set(results.items.map((r) => r.year))).sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const items = results.items.filter((r) => (filter === 'all' || r.type === filter) && r.year === year);
  const filters: [typeof filter, string][] = [
    ['all', 'All'],
    ['jee', 'JEE'],
    ['neet', 'NEET'],
    ['board', 'Board'],
  ];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={`chip px-4 py-1.5 text-sm ${filter === v ? 'chip-active' : ''}`}>
            {l}
          </button>
        ))}
        <select aria-label="Year" className="input ml-auto w-auto py-1.5" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.name + r.exam} className="card flex items-center gap-4 p-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-navy font-display text-lg text-gold-300">{initials(r.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-heading">{r.name}</p>
              <p className="text-xs text-muted">
                {r.exam} {r.year}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-maroon dark:text-gold">{r.score}</p>
            </div>
            {r.verifyUrl ? (
              <a href={r.verifyUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-navy underline dark:text-gold">
                Verify scorecard
              </a>
            ) : (
              <span className="shrink-0 text-right text-[11px] leading-4 text-muted">
                Scorecard
                <br />
                pending
              </span>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-muted">No results for this filter.</li>}
      </ul>
      <p className="mt-4 text-xs text-muted">
        <SampleBadge show={results.sample} /> Every topper card links to the official scorecard once the college has verified it.
      </p>
    </div>
  );
}

type Stage = 'class-10' | 'inter-done' | 'class-9';
type Goal = 'Engineering' | 'Medical' | 'unsure';

export function CourseFinder() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  let recs: ProgramSlug[] = [];
  if (stage && goal) {
    const track = stage === 'inter-done' ? 'long-term' : 'two-year';
    recs = programs.filter((p) => p.track === track && (goal === 'unsure' || p.goal === goal)).map((p) => p.slug);
  }

  const Opt = <T extends string>({ value, current, set, label, hint }: { value: T; current: T | null; set: (v: T) => void; label: string; hint: string }) => (
    <button type="button" aria-pressed={current === value} onClick={() => set(value)} className={`rounded-2xl border p-4 text-left transition ${current === value ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line bg-surface hover:border-gold'}`}>
      <span className="block font-semibold">{label}</span>
      <span className="block text-sm opacity-75">{hint}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="font-display text-2xl text-heading">1. Which class is the student in?</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Opt value="class-10" current={stage} set={setStage} label="Class 10" hint="Studying or just completed" />
          <Opt value="inter-done" current={stage} set={setStage} label="Completed Inter / Class 12" hint="Planning a repeat attempt" />
          <Opt value="class-9" current={stage} set={setStage} label="Class 9 or below" hint="Planning ahead" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-display text-2xl text-heading">2. What is the goal?</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Opt value="Engineering" current={goal} set={setGoal} label="Engineering" hint="IITs, NITs, JEE" />
          <Opt value="Medical" current={goal} set={setGoal} label="Medical" hint="MBBS, BDS, NEET" />
          <Opt value="unsure" current={goal} set={setGoal} label="Not sure yet" hint="Help us decide" />
        </div>
      </fieldset>

      {stage && goal && (
        <div className="animate-rise space-y-4" aria-live="polite">
          {stage === 'class-9' ? (
            <div className="card p-6">
              <p className="font-display text-2xl text-heading">Start planning early</p>
              <p className="lead-text mt-2">Our programs begin after Class 10. Visit the campus with your child, see the classrooms and hostel, and talk to a counsellor about preparing for JEE or NEET.</p>
              <Link href="/visit" className="btn-primary mt-4">Book a campus visit</Link>
            </div>
          ) : (
            <>
              <p className="eyebrow">Recommended for you</p>
              <div className="grid gap-4 md:grid-cols-2">
                {recs.map((slug) => {
                  const p = programs.find((x) => x.slug === slug)!;
                  return (
                    <Link key={slug} href={`/programs/${slug}`} className="card group p-6 transition hover:border-gold">
                      <p className="text-xs uppercase tracking-wider text-muted">
                        {p.goal} · {p.duration}
                      </p>
                      <p className="mt-1 font-display text-2xl text-heading">{p.name}</p>
                      <p className="mt-2 text-sm leading-6 text-muted">{p.summary}</p>
                      <span className="mt-3 inline-block text-sm font-semibold text-maroon group-hover:underline dark:text-gold">View program →</span>
                    </Link>
                  );
                })}
              </div>
              <div className="card p-6">
                <LeadForm source="course_finder" program={recs.length === 1 ? recs[0] : undefined} heading="Talk to a counsellor about this" submitLabel="Request a callback" showProgram={recs.length !== 1} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
