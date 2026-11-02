import type { Metadata } from 'next';
import { BsatForm } from '@/components/BsatForm';
import { JsonLd, PageHero, SampleBadge, Section } from '@/components/ui';
import { bsat } from '@/content/sample';
import { formatDate, todayIST } from '@/lib/dates';
import { bsatEventsJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'BSAT: Bhargava Scholarship & Admission Test',
  description: `Register for BSAT, a ${bsat.durationMin}-minute scholarship test for Class 10 students. Up to ${bsat.cap}% off tuition. Campus and online dates.`,
  alternates: { canonical: '/scholarship' },
};

export default function ScholarshipPage() {
  const today = todayIST();
  const upcoming = bsat.sessions.filter((s) => s.date >= today);
  return (
    <>
      <PageHero eyebrow="BSAT" title="Bhargava Scholarship & Admission Test" intro={`A ${bsat.durationMin}-minute test for ${bsat.eligibility.toLowerCase()}. Your score sets your tuition scholarship, up to ${bsat.cap}%.`} badge={bsat.sample} />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-8">
            <div>
              <h2 className="h2 text-2xl sm:text-3xl">Test format</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <dt className="label">Duration</dt>
                  <dd className="font-mono text-xl">{bsat.durationMin} min</dd>
                </div>
                <div className="card p-4">
                  <dt className="label">Results</dt>
                  <dd className="text-xl">within {bsat.resultsWithin}</dd>
                </div>
                <div className="card col-span-2 p-4">
                  <dt className="label">Sections</dt>
                  <dd>{bsat.sections.join(' · ')}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="h2 text-2xl sm:text-3xl">Scholarship slabs</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>BSAT score</th>
                      <th className="text-right">Tuition scholarship</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bsat.slabs.map((s) => (
                      <tr key={s.min}>
                        <td>{s.label}</td>
                        <td className="text-right font-mono font-semibold text-maroon dark:text-gold">{s.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-muted">
                Extra {bsat.gpaBonus}% for a 10 GPA in SSC. Total scholarship is capped at {bsat.cap}% of tuition.
              </p>
            </div>

            <div>
              <h2 className="h2 text-2xl sm:text-3xl">Dates</h2>
              <ul className="mt-4 space-y-2">
                {bsat.sessions.map((s) => (
                  <li key={s.id} className={`card flex items-center justify-between p-4 ${s.date < today ? 'opacity-50' : ''}`}>
                    <span className="font-semibold">{formatDate(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span className="chip">{s.mode === 'online' ? 'Online' : 'Campus'}{s.date < today ? ' · done' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div id="register" className="lg:sticky lg:top-28 lg:self-start">
            <div className="card p-5 sm:p-7">
              <h2 className="font-display text-2xl text-heading">
                Register now <SampleBadge show={bsat.sample} />
              </h2>
              <p className="mb-5 mt-1 text-sm text-muted">You get a hall ticket number immediately.</p>
              <BsatForm upcomingIds={upcoming.map((s) => s.id)} />
            </div>
          </div>
        </div>
      </Section>
      {bsatEventsJsonLd()
        .filter((e) => e.startDate >= today)
        .map((e) => (
          <JsonLd key={e.startDate} data={e} />
        ))}
    </>
  );
}
