import Link from 'next/link';
import { addDays, formatDate, todayIST, weekday } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { batchRegisters, batchTimetable, noticesFor, studentResults } from '@/lib/school/academics';
import { duesForStudent } from '@/lib/school/accounts';
import { batchOf } from '@/lib/school/common';
import { attendanceSummary } from '@/lib/school/logic';
import { sharedNotes } from '@/lib/school/mentoring';

/** Live summary on the app home: today, attendance, latest result, mentor note, dues, notices. */
export async function HomeTiles({ studentId, parent }: { studentId: string; parent: boolean }) {
  const today = todayIST();
  const b = await batchOf(studentId);
  const [tt, regs, results, notes, dues, notices] = await Promise.all([
    b ? batchTimetable(b.id) : Promise.resolve([]),
    b ? batchRegisters(b.id, addDays(today, -30), today) : Promise.resolve([]),
    studentResults(studentId),
    parent ? sharedNotes(studentId) : Promise.resolve([]),
    duesForStudent(studentId),
    noticesFor(parent ? 'parents' : 'students', b?.id ?? null),
  ]);
  const att = attendanceSummary(regs, studentId);
  const todayMark = regs.find((r) => r.date === today)?.marks[studentId];
  const periods = tt.filter((p) => p.day === weekday(today));
  const last = results[results.length - 1];
  const next = dues?.rows.find((r) => r.outstanding > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/attendance" className="card p-3">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Attendance (30 days)</span>
          <span className="font-mono text-xl font-semibold text-heading">{att.pct === null ? '–' : `${att.pct}%`}</span>
          <span className="block text-[11px] text-muted">Today: {todayMark ?? 'not marked yet'}</span>
        </Link>
        <Link href="/app/results" className="card p-3">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Latest test</span>
          <span className="font-mono text-xl font-semibold text-heading">{last ? `${last.score}/${last.max}` : '–'}</span>
          <span className="block truncate text-[11px] text-muted">{last ? `${last.test.title} · rank ${last.rank}/${last.of}` : 'No results yet'}</span>
        </Link>
      </div>
      {!parent && (
        <Link href="/app/timetable" className="card block p-3 text-sm">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Today’s classes</span>
          {periods.length === 0 ? <span className="text-muted">No classes today.</span> : periods.map((p) => <span key={p.id} className="block"><span className="font-mono">{p.start}</span> {p.subject}</span>)}
        </Link>
      )}
      {parent && notes[0] && (
        <Link href="/app/results" className="card block p-3 text-sm">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Mentor’s note · {formatDate(notes[0].date, { day: 'numeric', month: 'short' })}</span>
          <span className="text-ink">{notes[0].note}</span>
        </Link>
      )}
      {next && (
        <Link href="/app/fees" className="card block p-3 text-sm">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Next fee instalment</span>
          <span className={next.overdue ? 'font-semibold text-red-700 dark:text-red-300' : 'text-heading'}>{formatINR(next.outstanding)} due {formatDate(next.due, { day: 'numeric', month: 'short' })}{next.overdue ? ' · overdue' : ''}</span>
        </Link>
      )}
      <Link href="/app/notices" className="card flex items-center justify-between p-3 text-sm">
        <span><span className="block text-[11px] uppercase tracking-wider text-muted">Notices</span>{notices[0]?.title ?? 'No notices'}</span>
        <span aria-hidden>→</span>
      </Link>
      <Link href="/app/more" className="block text-center text-sm font-semibold text-maroon underline dark:text-gold">Everything in the app →</Link>
    </div>
  );
}
