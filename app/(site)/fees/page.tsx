import type { Metadata } from 'next';
import Link from 'next/link';
import { FeeCalculator } from '@/components/FeeCalculator';
import { PageHero, Section } from '@/components/ui';
import { getContent, type Content } from '@/lib/cms';
import { formatINR } from '@/lib/fees';

export async function generateMetadata(): Promise<Metadata> {
  const { fees } = await getContent();
  return {
  title: `Fee structure ${fees.academicYear} & scholarship calculator`,
  description: 'Full fee table for IIT-JEE and NEET programs with hostel and transport, plus a calculator for BSAT scholarships and instalments. No form required.',
  alternates: { canonical: '/fees' },
  };
}

const feeRows = (fees: Content['fees']):  { label: string; two: number; long: number; note?: string }[] => [
  { label: 'Tuition', two: fees.twoYear.tuition, long: fees.longTerm.tuition },
  { label: 'Study material & test series', two: fees.twoYear.material, long: fees.longTerm.material },
  { label: 'Admission fee', two: fees.twoYear.admission, long: fees.longTerm.admission, note: 'one time' },
  { label: 'Hostel non-AC (incl. food)', two: fees.hostelNonAc, long: fees.hostelNonAc, note: 'optional' },
  { label: 'Hostel AC (incl. food)', two: fees.hostelAc, long: fees.hostelAc, note: 'optional' },
  { label: 'Transport (day scholars)', two: fees.transport, long: fees.transport, note: 'optional' },
];

export default async function FeesPage() {
  const { bsat, fees } = await getContent();
  const rows = feeRows(fees);
  return (
    <>
      <PageHero eyebrow={`Fees ${fees.academicYear}`} title="Every fee, in the open" intro="No form to fill and no call needed to see what you will pay. Use the calculator to include your BSAT scholarship and choose instalments." badge={fees.sample} />

      <Section eyebrow="Fee table" title="Per year">
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="table-base min-w-[560px]">
            <thead>
              <tr>
                <th>Component</th>
                <th className="text-right">JEE / NEET (2-year)</th>
                <th className="text-right">Long Term</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>
                    {r.label} {r.note && <span className="text-xs text-muted">({r.note})</span>}
                  </td>
                  <td className="text-right font-mono">{formatINR(r.two)}</td>
                  <td className="text-right font-mono">{formatINR(r.long)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="label">Payment options</p>
            <p>Pay in full, in 3 instalments, or in 10 instalments.</p>
            <p className="mt-2 text-sm text-muted">{fees.paymentModes.join(' · ')}</p>
          </div>
          <div className="card p-5">
            <p className="label">Scholarships</p>
            <p>
              BSAT score gives up to {bsat.cap}% off tuition, plus {bsat.gpaBonus}% extra for a 10 GPA in SSC (capped at {bsat.cap}%).
            </p>
            <Link href="/scholarship" className="mt-2 inline-block text-sm font-semibold text-maroon underline dark:text-gold">See the slab table →</Link>
          </div>
        </div>
      </Section>

      <Section id="calculator" eyebrow="Calculator" title="Work out your fee" intro="Choose a program, stay option, BSAT score and payment plan." className="bg-surface">
        <FeeCalculator fees={fees} bsat={bsat} />
      </Section>
    </>
  );
}
