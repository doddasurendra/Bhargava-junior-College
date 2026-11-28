import Link from 'next/link';
import { Empty, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { allBatches, allStudents, readableStudentIds, visibleStudentIds } from '@/lib/school/common';
import { PROGRAM_SLUGS } from '@/content/programs';
import { canManageSignups, testStudentIds } from '@/lib/app/pendingAdmin';
import { SignupTools } from './SignupTools';

export const metadata = { title: 'Students' };

type SP = { q?: string; batch?: string; section?: string; program?: string; mine?: string; view?: string };

/**
 * Student search (master prompt §4.B). Teachers read every student (Student 360); "My students" narrows to
 * the batches they teach. Search by name, College ID / admission number, student id, class, section, program.
 */
export default async function StudentsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff('students.view');
  const [students, readable, mine, list] = await Promise.all([allStudents(), readableStudentIds(user), visibleStudentIds(user), allBatches()]);
  const batchOf = new Map(list.flatMap((b) => b.data.studentIds.map((s) => [s, b] as const)));
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 60);
  const onlyMine = searchParams.mine === '1' && typeof mine !== 'string';
  const sections = [...new Set(list.map((b) => b.data.section))].sort();
  const rows = students.filter((s) => {
    if (readable !== 'all' && !readable.has(s.id)) return false;
    if (onlyMine && mine instanceof Set && !mine.has(s.id)) return false;
    const b = batchOf.get(s.id);
    if (searchParams.batch && b?.id !== searchParams.batch) return false;
    if (searchParams.section && b?.data.section !== searchParams.section) return false;
    if (searchParams.program && s.program !== searchParams.program) return false;
    if (!q) return true;
    return [s.fullName, s.collegeId ?? '', s.id, s.leadId, b?.data.name ?? ''].some((v) => v.toLowerCase().includes(q));
  });
  const sel = 'input py-2 text-sm';
  const office = canManageSignups(user);
  const testIds = office ? await testStudentIds() : new Set<string>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-heading">{readable === 'all' && mine !== 'all' ? 'Student 360' : 'Students'}</h1>
        <p className="text-sm text-muted">{rows.length} of {readable === 'all' ? students.length : readable.size} students{readable === 'all' && mine !== 'all' ? ' · you can read every student’s academic record; you edit only your own classes' : ''}</p>
      </div>
      {office && <SignupTools user={user} view={searchParams.view ?? 'pending'} />}
      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Name, College ID or student ID" aria-label="Search students" className="input w-64 py-2 text-sm" />
        <select name="batch" defaultValue={searchParams.batch ?? ''} aria-label="Class" className={sel}>
          <option value="">All classes</option>
          {list.map((b) => <option key={b.id} value={b.id}>{b.data.name}</option>)}
        </select>
        <select name="section" defaultValue={searchParams.section ?? ''} aria-label="Section" className={sel}>
          <option value="">All sections</option>
          {sections.map((x) => <option key={x} value={x}>Section {x}</option>)}
        </select>
        <select name="program" defaultValue={searchParams.program ?? ''} aria-label="Program" className={sel}>
          <option value="">All programs</option>
          {PROGRAM_SLUGS.map((p) => <option key={p} value={p}>{programShort(p)}</option>)}
        </select>
        {mine !== 'all' && (
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={onlyMine} className="h-4 w-4 accent-maroon" /> My students only
          </label>
        )}
        <button className="btn-primary py-2 text-sm">Search</button>
        {(q || searchParams.batch || searchParams.section || searchParams.program || onlyMine) && <Link href="/crm/students" className="pb-2 text-sm underline">Clear</Link>}
      </form>
      {rows.length === 0 ? <Empty>No students{q ? ' match' : ' yet'}.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="table-base min-w-[720px] text-[13px]">
            <thead><tr><th>Student</th><th>College ID</th><th>Program</th><th>Class</th><th>Section</th><th>Stay</th><th>Guardian</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const b = batchOf.get(s.id);
                return (
                  <tr key={s.id}>
                    <td><Link href={`/crm/students/${s.id}`} className="font-semibold text-heading hover:underline">{s.fullName}</Link>{mine !== 'all' && mine.has(s.id) && <span className="ml-1.5 rounded bg-bg px-1.5 py-0.5 text-[10px] uppercase text-muted">my class</span>}{testIds.has(s.id) && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">test</span>}</td>
                    <td className="font-mono">{s.collegeId}</td>
                    <td>{programShort(s.program)}</td>
                    <td>{b?.data.name ?? <span className="text-maroon dark:text-gold">Not allotted</span>}</td>
                    <td>{b?.data.section ?? '—'}</td>
                    <td className="capitalize">{s.stay}</td>
                    <td>{s.guardianName} <span className="font-mono text-xs text-muted">{phoneFor(user, s.guardianPhone)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
