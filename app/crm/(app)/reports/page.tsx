import Link from 'next/link';
import { previewReportAction } from '@/app/crm/report-actions';
import { Empty } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { listReports } from '@/lib/crm/reports';
import { formatDate, formatDateTime } from '@/lib/dates';
import { siteUrl } from '@/lib/seo';

export const metadata = { title: '7 PM reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await requireStaff('dashboard.view');
  const reports = await listReports(user);
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">7 PM reports</h1>
          <p className="mt-1 text-sm text-muted">A snapshot is saved every evening at 7 PM and sent on WhatsApp to management users with a mobile number.</p>
        </div>
        <form action={previewReportAction}>
          <button className="btn-primary py-2">Preview today’s report</button>
        </form>
      </div>
      {reports.length === 0 ? (
        <Empty>No reports yet. The first one is generated tonight at 7 PM, or preview one now.</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {reports.map((r) => (
            <li key={r.date}>
              <Link href={`/crm/reports/${r.date}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-bg">
                <span className="font-medium text-heading">{formatDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="text-xs text-muted">
                  generated {formatDateTime(r.generatedAt)} · sent to {r.recipients}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Scheduling: call <span className="font-mono">{siteUrl}/api/cron/daily-report</span> daily at 13:30 UTC (19:00 IST) with <span className="font-mono">Authorization: Bearer $CRON_SECRET</span>. WhatsApp template{' '}
        <span className="font-mono">bjc_daily_report</span> must be approved (see WhatsApp setup).
      </p>
    </div>
  );
}
