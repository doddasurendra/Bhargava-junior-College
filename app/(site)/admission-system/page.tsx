import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { PageHero, Section } from '@/components/ui';
import { ADDITIONS, ADMISSION_STAGES, FLOW, OPERATING_PRINCIPLE, STAGE_GROUPS, type StageGroup } from '@/content/admissionSystem';

export const metadata: Metadata = {
  title: 'Our admission system',
  description: 'How Bhargava Junior College handles every enquiry: ten tracked stages from school data to College ID, with an owner, a follow-up date and a verified outcome at every step.',
  alternates: { canonical: '/admission-system' },
};

function Key() {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted" aria-label="Colour key">
      {(Object.keys(STAGE_GROUPS) as StageGroup[]).map((g) => (
        <li key={g} className="flex items-center gap-2">
          <span aria-hidden className={`h-3.5 w-3.5 rounded border border-black/10 ${STAGE_GROUPS[g].swatch}`} />
          {STAGE_GROUPS[g].label}
        </li>
      ))}
    </ul>
  );
}

export default function AdmissionSystemPage() {
  return (
    <>
      <PageHero
        eyebrow="Admission system"
        title="Ten stages. Every family accounted for."
        intro="From the first school list to the College ID, every enquiry moves through the same tracked stages, each with an owner, a date and a recorded outcome."
      />

      <Section eyebrow="Operating principle" title="What we hold ourselves to">
        <blockquote className="max-w-3xl rounded-2xl border-l-4 border-gold bg-surface p-6 font-display text-xl leading-8 text-heading sm:text-2xl sm:leading-9">
          {OPERATING_PRINCIPLE}
        </blockquote>
      </Section>

      <Section eyebrow="Flowchart" title="From school data to College ID" className="bg-surface">
        <Key />
        <ol className="mt-6 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {FLOW.map((f, i) => (
            <Fragment key={f.label}>
              <li className={`flex-1 rounded-xl border p-4 ${STAGE_GROUPS[f.group].card}`}>
                <p className="font-semibold text-heading">{f.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{f.note}</p>
              </li>
              {i < FLOW.length - 1 && (
                <li aria-hidden className="self-center text-xl text-muted lg:px-0.5">
                  <span className="lg:hidden">↓</span>
                  <span className="hidden lg:inline">→</span>
                </li>
              )}
            </Fragment>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          After classification, families who need more time go to <strong className="text-heading">5A Follow-up</strong>; interested families go to{' '}
          <strong className="text-heading">5B Campus visit</strong>. Follow-ups rejoin at the visit once the family is ready.
        </p>
      </Section>

      <Section eyebrow="The 10 stages" title="Who does what, at each step">
        <Key />
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMISSION_STAGES.map((s) => (
            <li key={s.no} className={`rounded-2xl border p-5 ${STAGE_GROUPS[s.group].card}`}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-maroon dark:text-gold">{s.no}</span>
                <h3 className="font-sans text-base font-semibold text-heading">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/85">
                <span className="sr-only">{s.title}: </span>
                {s.description.charAt(0).toUpperCase() + s.description.slice(1)}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">{STAGE_GROUPS[s.group].label}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Built into our CRM" title="Five rules the system enforces" className="bg-surface">
        <ul className="grid gap-4 md:grid-cols-2">
          {ADDITIONS.map((a) => (
            <li key={a.key} className="card flex gap-4 p-6">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-100 font-display text-navy">{a.key}</span>
              <div>
                <h3 className="font-sans text-base font-semibold text-heading">{a.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{a.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/track" className="btn-primary">Track your admission</Link>
          <Link href="/visit" className="btn-outline">Book a campus visit</Link>
        </div>
      </Section>
    </>
  );
}
