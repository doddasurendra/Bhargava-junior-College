import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeadForm } from '@/components/forms';
import { Check, initials, JsonLd, PageHero, SampleBadge, Section } from '@/components/ui';
import { college } from '@/content/college';
import { getProgram, programIncludes, programs } from '@/content/programs';
import { faculty, fees } from '@/content/sample';
import { formatINR } from '@/lib/fees';
import { courseJsonLd } from '@/lib/seo';

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getProgram(params.slug);
  if (!p) return {};
  return {
    title: `${p.name} (${p.duration}) in Saroornagar, Hyderabad`,
    description: p.summary,
    alternates: { canonical: `/programs/${p.slug}` },
  };
}

export default function ProgramPage({ params }: { params: { slug: string } }) {
  const p = getProgram(params.slug);
  if (!p) notFound();
  const base = p.track === 'two-year' ? fees.twoYear : fees.longTerm;
  const subjectFaculty = faculty.items.filter((f) => p.subjects.some((s) => s === f.subject || (f.subject === 'Biology' && (s === 'Botany' || s === 'Zoology'))));

  return (
    <>
      <PageHero eyebrow={`${p.goal} · ${p.duration}`} title={p.name} intro={p.summary}>
        <div className="flex flex-wrap gap-3">
          <Link href="#brochure" className="btn-primary">Download brochure</Link>
          <Link href="/visit" className="btn-gold">Book a campus visit</Link>
        </div>
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            <div>
              <h2 className="h2 text-2xl sm:text-3xl">Prepares you for</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.targets.map((t) => (
                  <span key={t} className="chip px-4 py-1.5 text-sm">{t}</span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="card p-5">
                <p className="label">Eligibility <SampleBadge /></p>
                <p className="leading-7">{p.eligibility}</p>
              </div>
              <div className="card p-5">
                <p className="label">Batch timings <SampleBadge /></p>
                <p className="leading-7">{p.batchTimings}</p>
              </div>
              <div className="card p-5">
                <p className="label">Subjects</p>
                <p className="leading-7">{p.subjects.join(' · ')}</p>
              </div>
              <div className="card p-5">
                <p className="label">Batch size</p>
                <p className="leading-7">At most {college.maxBatchSize} students, with one mentor for every {college.mentorRatio}.</p>
              </div>
            </div>

            <div>
              <h2 className="h2 text-2xl sm:text-3xl">What’s included</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {programIncludes.map((i) => (
                  <li key={i} className="flex gap-3">
                    <Check />
                    {i}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">The detailed syllabus coverage and test calendar will be published here once the college finalises them for 2027–28.</p>
            </div>

            {subjectFaculty.length > 0 && (
              <div>
                <h2 className="h2 text-2xl sm:text-3xl">
                  Faculty <SampleBadge show={faculty.sample} />
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {subjectFaculty.map((f) => (
                    <li key={f.name} className="card flex items-center gap-3 p-4">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-gold-100 font-display text-navy">{initials(f.name)}</span>
                      <span>
                        <span className="block font-semibold text-heading">{f.name}</span>
                        <span className="text-sm text-muted">
                          {f.subject} · {f.years} yrs
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
                <p className="font-display text-lg">Fees per year</p>
                <SampleBadge show={fees.sample} />
              </div>
              <table className="table-base">
                <tbody>
                  <tr><td>Tuition</td><td className="text-right font-mono">{formatINR(base.tuition)}</td></tr>
                  <tr><td>Study material & tests</td><td className="text-right font-mono">{formatINR(base.material)}</td></tr>
                  <tr><td>Admission (one time)</td><td className="text-right font-mono">{formatINR(base.admission)}</td></tr>
                  <tr><td>Hostel (optional)</td><td className="text-right font-mono">from {formatINR(fees.hostelNonAc)}</td></tr>
                </tbody>
              </table>
              <div className="p-5">
                <Link href="/fees" className="btn-outline w-full">Calculate with scholarship</Link>
              </div>
            </div>
            <div id="brochure" className="card p-5 sm:p-6">
              <LeadForm
                source="brochure"
                program={p.slug}
                heading="Get the brochure"
                sub="We’ll send the program brochure to your WhatsApp."
                submitLabel="Send me the brochure"
                successTitle="Brochure on its way"
                successText="The brochure will arrive on your WhatsApp shortly, and a counsellor may call to answer questions."
                showClass
              />
            </div>
          </aside>
        </div>
      </Section>
      <JsonLd data={courseJsonLd(p)} />
    </>
  );
}
