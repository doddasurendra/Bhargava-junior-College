import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { BacklogTiles, FlaggedCard, FunnelCard, LossesCard, OwnersCard, QualityCard } from '@/components/crm/dashboardSections';
import { requireStaff } from '@/lib/crm/auth';
import { getReport } from '@/lib/crm/reports';
import { formatDate, formatDateTime, isIsoDate } from '@/lib/dates';
import { formatINR } from '@/lib/fees';

export const metadata = { title: '7 PM report' };
export const dynamic = 'force-dynamic';

/** The report exactly as it was generated (a stored snapshot, not recomputed). */
export default async function ReportPage({ params }: { params: { date: string } }) {
  const user = await requireStaff('dashboard.view');
  if (!isIsoDate(params.date)) notFound();
  const r = await getReport(user, params.date);
  if (!r) notFound();
  const v = (k: string, p: typeof r.today) => p.funnel.find((f) => f.key === k)?.value ?? 0;
  // Snapshots from before §8 was implemented have no daily block; they show the older funnel rows.
  const hasDaily = Array.isArray(r.today.daily);
  const d = (k: string, p: typeof r.today) => { const x = p.daily?.find((f) => f.key === k); return x ? (x.money ? formatINR(x.value) : x.value.toLocaleString('en-IN')) : '–'; };

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/crm/reports" className="text-sm text-muted underline print:hidden">← Reports</Link>
          <h1 className="font-display text-3xl text-heading">Admissions report · {formatDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h1>
          <p className="mt-1 text-sm text-muted">
            Snapshot generated {formatDateTime(r.generatedAt)} · sent to {r.recipients} {r.recipients === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {hasDaily && <a href={`/crm/reports/${r.date}/pdf`} className="btn-outline py-1.5">Download PDF</a>}
          <PrintButton />
        </div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-line bg-surface p-4">
        <table className="table-base min-w-[560px] text-sm">
          <thead>
            <tr>
              <th />
              <th className="text-right">Today</th>
              <th className="text-right">Month to date</th>
              <th className="text-right">Season to date</th>
            </tr>
          </thead>
          <tbody>
            {hasDaily && r.today.daily.map((f) => (
              <tr key={f.key}>
                <td title={f.definition}>{f.label}</td>
                <td className="text-right font-semibold tabular-nums text-heading">{d(f.key, r.today)}</td>
                <td className="text-right tabular-nums">{d(f.key, r.mtd)}</td>
                <td className="text-right tabular-nums">{d(f.key, r.season)}</td>
              </tr>
            ))}
            {!hasDaily && r.today.funnel.map((f) => (
              <tr key={f.key}>
                <td title={f.definition}>{f.label}</td>
                <td className="text-right font-semibold tabular-nums text-heading">{f.value}</td>
                <td className="text-right tabular-nums">{v(f.key, r.mtd)}</td>
                <td className="text-right tabular-nums">{v(f.key, r.season)}</td>
              </tr>
            ))}
            {!hasDaily && <tr>
              <td>Admissions lost</td>
              <td className="text-right font-semibold tabular-nums text-heading">{r.today.losses.total}</td>
              <td className="text-right tabular-nums">{r.mtd.losses.total}</td>
              <td className="text-right tabular-nums">{r.season.losses.total}</td>
            </tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">At 7 PM</h2>
        <BacklogTiles m={r.today} links={false} />
      </section>

      <FlaggedCard m={r.today} />
      <OwnersCard m={r.today} />
      <div className="grid gap-5 xl:grid-cols-2">
        <FunnelCard m={r.mtd} />
        <LossesCard m={r.mtd} />
      </div>
      <QualityCard m={r.today} />
    </div>
  );
}
