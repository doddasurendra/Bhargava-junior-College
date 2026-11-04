import { requireEnrolled } from '@/lib/app/portal';
import { addDays, formatDate, todayIST } from '@/lib/dates';
import { batchRegisters } from '@/lib/school/academics';
import { batchOf } from '@/lib/school/common';
import { attendanceSummary } from '@/lib/school/logic';

export const metadata = { title: 'Attendance' };

export default async function AttendancePage() {
  const { p } = await requireEnrolled();
  const b = await batchOf(p.studentId);
  const today = todayIST();
  const regs = b ? await batchRegisters(b.id, addDays(today, -60), today) : [];
  const s30 = attendanceSummary(regs.filter((r) => r.date >= addDays(today, -30)), p.studentId);
  const days = regs.filter((r) => r.marks[p.studentId]).sort((a, c) => c.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Attendance</h1>
      <section className="card grid grid-cols-4 gap-2 p-4 text-center text-sm">
        <div><p className="font-mono text-xl font-semibold text-heading">{s30.pct === null ? '–' : `${s30.pct}%`}</p><p className="text-[11px] text-muted">30 days</p></div>
        <div><p className="font-mono text-xl">{s30.present}</p><p className="text-[11px] text-muted">present</p></div>
        <div><p className="font-mono text-xl">{s30.absent}</p><p className="text-[11px] text-muted">absent</p></div>
        <div><p className="font-mono text-xl">{s30.late}</p><p className="text-[11px] text-muted">late</p></div>
      </section>
      {days.length === 0 ? <p className="card p-4 text-sm text-muted">No attendance recorded yet.</p> : (
        <ul className="card divide-y divide-line p-0 text-sm">
          {days.map((r) => {
            const m = r.marks[p.studentId];
            return <li key={r.date} className="flex justify-between px-4 py-2"><span>{formatDate(r.date)}</span><span className={`capitalize ${m === 'absent' ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{m}</span></li>;
          })}
        </ul>
      )}
    </div>
  );
}
