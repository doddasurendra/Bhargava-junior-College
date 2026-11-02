import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, Section } from '@/components/ui';
import { college } from '@/content/college';
import { programIncludes, programs } from '@/content/programs';
import { fees } from '@/content/sample';
import { formatINR } from '@/lib/fees';

export const metadata: Metadata = {
  title: 'Programs: IIT-JEE & NEET with Intermediate, Long Term',
  description: 'IIT-JEE Integrated, NEET UG Integrated (2 years with TS Intermediate Board) and one-year Long Term JEE and NEET repeater programs in Saroornagar, Hyderabad.',
  alternates: { canonical: '/programs' },
};

export default function ProgramsPage() {
  return (
    <>
      <PageHero eyebrow="Programs" title="Choose the path that fits your goal" intro="Two integrated programs alongside the TS Intermediate Board, and two one-year Long Term programs for repeat attempts.">
        <Link href="/course-finder" className="btn-gold">Help me choose</Link>
      </PageHero>
      <Section>
        <div className="grid gap-5 md:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.slug} href={`/programs/${p.slug}`} className="card group p-6 transition hover:border-gold sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {p.goal} · {p.duration}
              </p>
              <h2 className="mt-2 font-display text-3xl text-heading">{p.name}</h2>
              <p className="mt-3 leading-7 text-muted">{p.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.targets.map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
              <span className="mt-5 inline-block font-semibold text-maroon group-hover:underline dark:text-gold">View details, schedule and fees →</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section eyebrow="Compare" title="At a glance" className="bg-surface" badge={fees.sample}>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="table-base min-w-[640px] bg-surface">
            <thead>
              <tr>
                <th>Program</th>
                <th>Duration</th>
                <th>Prepares for</th>
                <th className="text-right">Tuition / year</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.slug}>
                  <td className="font-semibold text-heading">{p.name}</td>
                  <td>{p.duration}</td>
                  <td className="text-muted">{p.targets.join(', ')}</td>
                  <td className="text-right font-mono">{formatINR(p.track === 'two-year' ? fees.twoYear.tuition : fees.longTerm.tuition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted">
          Included in every program: {programIncludes.join(', ').toLowerCase()}. Maximum {college.maxBatchSize} students per batch.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/fees" className="font-semibold text-maroon underline dark:text-gold">Full fee table and calculator</Link>
        </p>
      </Section>
    </>
  );
}
