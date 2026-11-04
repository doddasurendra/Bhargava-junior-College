import { programShort } from '@/components/crm/ui';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate, todayIST } from '@/lib/dates';
import { studentResults } from '@/lib/school/academics';
import { studentsById } from '@/lib/school/common';
import { sharedNotes, studentSignals } from '@/lib/school/mentoring';

export const metadata = { title: 'Report card' };
export const dynamic = 'force-dynamic';

/** The signed-in child's report card (same content as the staff report card), printable / save as PDF. */
export default async function AppReportCardPage() {
  const { p } = await requireEnrolled();
  const s = (await studentsById()).get(p.studentId);
  if (!s) return <p className="card p-4 text-sm text-muted">Report card not available.</p>;
  const [results, signals, notes] = await Promise.all([studentResults(s.id), studentSignals(s.id), sharedNotes(s.id)]);
  const avg = results.length ? Math.round(results.reduce((t, r) => t + r.pct, 0) / results.length) : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl text-heading">Report card</h1>
        <PrintButton />
      </div>
      <article className="card space-y-4 bg-white p-4 text-sm text-[#151C36] print:border-0 print:shadow-none">
        <header className="flex items-center gap-3 border-b-2 border-[#C9A24A] pb-3">
          <Crest size={40} />
          <div>
            <p className="font-bold uppercase">{college.name}</p>
            <p className="text-[11px] text-gray-600">Progress report as of {formatDate(todayIST())}</p>
          </div>
        </header>
        <p><strong>{s.fullName}</strong> · <span className="font-mono">{s.collegeId}</span> · {programShort(s.program)} · {signals.batch ?? 'batch to be allotted'}</p>
        <section>
          <p className="text-xs font-bold uppercase text-[#7D1F2C]">Attendance (30 days)</p>
          <p>{signals.attendance.pct === null ? 'Not recorded yet.' : `${signals.attendance.pct}% · ${signals.attendance.absent} absent · ${signals.attendance.late} late`}</p>
        </section>
        <section>
          <p className="text-xs font-bold uppercase text-[#7D1F2C]">Tests{avg !== null ? ` · average ${avg}%` : ''}</p>
          {results.length === 0 ? <p>No published results yet.</p> : (
            <ul className="divide-y divide-gray-200">
              {results.map((r) => <li key={r.test.id} className="flex justify-between gap-2 py-1"><span>{r.test.title}</span><span className="font-mono">{r.score}/{r.max} · rank {r.rank}/{r.of}</span></li>)}
            </ul>
          )}
        </section>
        <section>
          <p className="text-xs font-bold uppercase text-[#7D1F2C]">Mentor’s note</p>
          <p className="whitespace-pre-line">{notes[0]?.note ?? 'No note shared this term.'}</p>
        </section>
      </article>
    </div>
  );
}
