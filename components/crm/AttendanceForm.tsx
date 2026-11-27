'use client';
import { useState } from 'react';
import { markAttendanceAction, sendAttendanceToParentsAction, sendMarksToParentsAction } from '@/app/crm/school-actions';
import { markSubjectAttendanceAction } from '@/app/crm/analytics-actions';
import { ActionForm, Submit } from './forms';

const MARKS = [
  { v: 'present', l: 'P', t: 'Present' },
  { v: 'absent', l: 'A', t: 'Absent' },
  { v: 'late', l: 'L', t: 'Late' },
  { v: 'leave', l: 'Lv', t: 'Leave' },
] as const;

/** One tap per student; everyone starts Present so a normal day is a single Save. */
export function AttendanceForm({ batchId, date, today, students, existing, existingRemarks = {}, subject = null, needsReason = false }: { batchId: string; date: string; today: string; students: { id: string; name: string; collegeId?: string | null }[]; existing: Record<string, string>; existingRemarks?: Record<string, string>; subject?: string | null; needsReason?: boolean }) {
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, existing[s.id] ?? 'present'])));
  const [q, setQ] = useState('');
  const absent = Object.values(marks).filter((m) => m === 'absent').length;
  const shown = q.trim() ? students.filter((s) => `${s.name} ${s.collegeId ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())) : students;
  return (
    <ActionForm action={subject ? markSubjectAttendanceAction : markAttendanceAction} reset={false}>
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="date" value={date} />
      {subject && <input type="hidden" name="subject" value={subject} />}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="input w-48 py-1 text-xs" />
        <button type="button" className="btn-outline py-1 text-xs" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'present'])))}>All present</button>
        <span className="text-muted">{students.length} students · {Object.values(marks).filter((m) => m === 'present').length} P · {absent} A · {Object.values(marks).filter((m) => m === 'late').length} L</span>
      </div>
      <ul className="divide-y divide-line">
        {students.map((s) => (
          <li key={s.id} className={`grid gap-2 py-2 sm:grid-cols-[1fr_auto] sm:items-center ${shown.includes(s) ? '' : 'hidden'}`}>
            <span className="text-sm">
              {s.name} {s.collegeId && <span className="font-mono text-[11px] text-muted">{s.collegeId}</span>}
            </span>
            <input type="hidden" name={`m:${s.id}`} value={marks[s.id]} />
            <span className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
              {MARKS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  role="radio"
                  aria-checked={marks[s.id] === m.v}
                  title={m.t}
                  onClick={() => setMarks({ ...marks, [s.id]: m.v })}
                  className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold ${marks[s.id] === m.v ? (m.v === 'absent' ? 'border-maroon bg-maroon text-white' : 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950') : 'border-line'}`}
                >
                  {m.l}
                </button>
              ))}
              <input name={`r:${s.id}`} defaultValue={existingRemarks[s.id] ?? ''} maxLength={200} placeholder="Remark" aria-label={`Remark for ${s.name}`} className="input ml-1 w-32 py-1 text-xs" />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-sm text-muted">{subject ? `${absent} absent in ${subject}.` : `${absent} absent: their parents get the automatic absence alert once for this date.`}{date !== today ? ' Changes to a saved register are recorded as corrections.' : ''}</span>
        {needsReason && <label className="block w-full text-xs"><span className="label">Reason for the correction (this register is older than 7 days, so an academic head approves it)</span><input name="reason" required minLength={3} maxLength={300} className="input w-full" /></label>}
        <Submit className="btn-primary py-2">Save attendance</Submit>
      </div>
    </ActionForm>
  );
}

/** “Send examination marks to parents on WhatsApp” (published results only; checked again on the server). */
export function SendMarksForm({ testId }: { testId: string }) {
  return (
    <ActionForm action={sendMarksToParentsAction} reset={false}>
      <input type="hidden" name="testId" value={testId} />
      <Submit className="btn-primary py-2">SEND EXAMINATION MARKS TO PARENTS ON WHATSAPP</Submit>
    </ActionForm>
  );
}

/** “Send attendance to parents on WhatsApp” for a saved register: everyone, or ticked students only. */
export function SendAttendanceForm({ batchId, date, students }: { batchId: string; date: string; students: { id: string; name: string; mark: string; status: string | null }[] }) {
  return (
    <ActionForm action={sendAttendanceToParentsAction} reset={false} className="space-y-3">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="date" value={date} />
      <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="studentId" value={s.id} className="h-4 w-4 accent-maroon" />
              <span>{s.name}</span>
              <span className="rounded bg-bg px-1.5 py-0.5 text-[11px] uppercase">{s.mark}</span>
            </label>
            <span className="text-xs text-muted">{s.status ?? 'Not sent'}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Tick students to send only theirs; leave all unticked to send the whole register. Each parent number on record gets that day’s status, any remark, and the month’s attendance %.</p>
      <Submit className="btn-primary w-full py-2">SEND ATTENDANCE TO PARENTS ON WHATSAPP</Submit>
    </ActionForm>
  );
}
