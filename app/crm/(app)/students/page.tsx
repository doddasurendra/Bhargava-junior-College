import Link from 'next/link';
import { Empty, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { allBatches, allStudents, visibleStudentIds } from '@/lib/school/common';

export const metadata = { title: 'Students' };

export default async function StudentsPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireStaff('students.view');
  const [students, visible, list] = await Promise.all([allStudents(), visibleStudentIds(user), allBatches()]);
  const batchOf = new Map(list.flatMap((b) => b.data.studentIds.map((s) => [s, b.data.name] as const)));
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 60);
  const rows = students.filter((s) => (visible === 'all' || visible.has(s.id)) && (!q || s.fullName.toLowerCase().includes(q) || (s.collegeId ?? '').toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-heading">Students</h1>
        <form method="get"><input name="q" defaultValue={q} placeholder="Name or College ID" className="input w-60 py-2 text-sm" /></form>
      </div>
      {rows.length === 0 ? <Empty>No students{q ? ' match' : ' yet'}.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="table-base min-w-[720px] text-[13px]">
            <thead><tr><th>Student</th><th>College ID</th><th>Program</th><th>Batch</th><th>Stay</th><th>Guardian</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/crm/students/${s.id}`} className="font-semibold text-heading hover:underline">{s.fullName}</Link></td>
                  <td className="font-mono">{s.collegeId}</td>
                  <td>{programShort(s.program)}</td>
                  <td>{batchOf.get(s.id) ?? <span className="text-maroon dark:text-gold">Not allotted</span>}</td>
                  <td className="capitalize">{s.stay}</td>
                  <td>{s.guardianName} <span className="font-mono text-xs text-muted">{phoneFor(user, s.guardianPhone)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
