'use client';
import { useState } from 'react';
import { markAttendanceAction } from '@/app/crm/school-actions';
import { ActionForm, Submit } from './forms';

const MARKS = [
  { v: 'present', l: 'P', t: 'Present' },
  { v: 'absent', l: 'A', t: 'Absent' },
  { v: 'late', l: 'L', t: 'Late' },
  { v: 'leave', l: 'Lv', t: 'Leave' },
] as const;

/** One tap per student; everyone starts Present so a normal day is a single Save. */
export function AttendanceForm({ batchId, date, students, existing }: { batchId: string; date: string; students: { id: string; name: string }[]; existing: Record<string, string> }) {
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, existing[s.id] ?? 'present'])));
  const absent = Object.values(marks).filter((m) => m === 'absent').length;
  return (
    <ActionForm action={markAttendanceAction} reset={false}>
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="date" value={date} />
      <ul className="divide-y divide-line">
        {students.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">{s.name}</span>
            <input type="hidden" name={`m:${s.id}`} value={marks[s.id]} />
            <span className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
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
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-sm text-muted">{absent} absent: their parents get a WhatsApp alert</span>
        <Submit className="btn-primary py-2">Save attendance</Submit>
      </div>
    </ActionForm>
  );
}
