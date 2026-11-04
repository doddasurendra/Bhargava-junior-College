import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { programShort } from '@/components/crm/ui';
import { Crest } from '@/components/ui';
import { college, fullAddress } from '@/content/college';
import { requireStaff } from '@/lib/crm/auth';
import { formatDate, todayIST } from '@/lib/dates';
import { studentResults } from '@/lib/school/academics';
import { requireSeesStudent, SchoolError, studentsById } from '@/lib/school/common';
import { sharedNotes, studentSignals } from '@/lib/school/mentoring';

export const metadata = { title: 'Report card' };
export const dynamic = 'force-dynamic';

/** Printable report card (Gurukul back office): attendance, every published test with rank, mentor's shared note. Save as PDF from the print dialog. */
export default async function ReportCardPage({ params }: { params: { id: string } }) {
  const user = await requireStaff('students.view');
  try {
    await requireSeesStudent(user, params.id);
  } catch (e) {
    if (e instanceof SchoolError) notFound();
    throw e;
  }
  const s = (await studentsById()).get(params.id);
  if (!s) notFound();
  const [results, signals, notes] = await Promise.all([studentResults(s.id), studentSignals(s.id), sharedNotes(s.id)]);
  const avg = results.length ? Math.round(results.reduce((t, r) => t + r.pct, 0) / results.length) : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 print:hidden">
        <Link href={`/crm/students/${s.id}`} className="btn-outline py-1.5 text-sm">← Student</Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[190mm] rounded-xl border border-line bg-white p-8 text-[#151C36] shadow print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-[#C9A24A] pb-4">
          <Crest size={56} />
          <div>
            <p className="text-lg font-bold uppercase tracking-wide">{college.name}</p>
            <p className="text-xs text-gray-600">{college.society} · {fullAddress}</p>
          </div>
          <p className="ml-auto text-right text-sm font-semibold">Progress report<br /><span className="text-xs font-normal text-gray-600">as of {formatDate(todayIST())}</span></p>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="text-gray-500">Student:</span> <strong>{s.fullName}</strong></p>
          <p><span className="text-gray-500">College ID:</span> <span className="font-mono font-semibold">{s.collegeId}</span></p>
          <p><span className="text-gray-500">Program:</span> {programShort(s.program)}</p>
          <p><span className="text-gray-500">Batch:</span> {signals.batch ?? '—'}</p>
          <p><span className="text-gray-500">Guardian:</span> {s.guardianName}</p>
          <p><span className="text-gray-500">Stay:</span> {s.stay === 'hostel' ? 'Hostel' : 'Day scholar'}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#7D1F2C]">Attendance (last 30 days)</h2>
          <p className="mt-1 text-sm">{signals.attendance.pct === null ? 'Not recorded yet.' : `${signals.attendance.pct}% · ${signals.attendance.absent} absent · ${signals.attendance.late} late · ${signals.attendance.leave} on leave`}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#7D1F2C]">Tests{avg !== null ? ` · average ${avg}%` : ''}</h2>
          {results.length === 0 ? <p className="mt-1 text-sm">No published results yet.</p> : (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead><tr className="border-b border-gray-300 text-left text-xs text-gray-500"><th className="py-1">Test</th><th>Date</th><th className="text-right">Marks</th><th className="text-right">%</th><th className="text-right">Rank</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.test.id} className="border-b border-gray-200">
                    <td className="py-1.5">{r.test.title}</td>
                    <td>{formatDate(r.test.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="text-right font-mono">{r.score}/{r.max}</td>
                    <td className="text-right font-mono">{Math.round(r.pct)}%</td>
                    <td className="text-right font-mono">{r.rank}/{r.of}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#7D1F2C]">Mentor’s note</h2>
          <p className="mt-1 whitespace-pre-line text-sm">{notes[0]?.note ?? 'No note shared this term.'}</p>
        </section>

        <footer className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-gray-600">
          <p className="border-t border-gray-400 pt-1">Class teacher</p>
          <p className="border-t border-gray-400 pt-1">Principal</p>
          <p className="border-t border-gray-400 pt-1">Parent / guardian</p>
        </footer>
      </article>
    </div>
  );
}
