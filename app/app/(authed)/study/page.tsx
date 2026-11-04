import { requireEnrolled } from '@/lib/app/portal';
import { formatDate, todayIST } from '@/lib/dates';
import { batchMaterials } from '@/lib/school/academics';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'Study material' };
const LABEL: Record<string, string> = { notes: 'Notes', dpp: 'DPPs', assignment: 'Assignments', recording: 'Recorded classes', live: 'Live classes' };

/** Notes, DPPs, assignments, recorded and live classes for the student's batch, plus a simple planner of what's due. */
export default async function StudyPage() {
  const { p } = await requireEnrolled();
  const b = await batchOf(p.studentId);
  const mats = b ? await batchMaterials(b.id) : [];
  const today = todayIST();
  const due = mats.filter((m) => m.dueDate && m.dueDate >= today).sort((a, c) => a.dueDate!.localeCompare(c.dueDate!));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Study</h1>
      {due.length > 0 && (
        <section className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Planner: due next</p>
          <ul className="mt-1 text-sm">{due.slice(0, 6).map((m) => <li key={m.id}><span className="font-mono">{formatDate(m.dueDate!, { day: 'numeric', month: 'short' })}</span> {m.title} · {m.subject}</li>)}</ul>
        </section>
      )}
      {mats.length === 0 ? <p className="card p-4 text-sm text-muted">Your teachers haven’t shared anything yet.</p> : Object.keys(LABEL).map((k) => {
        const list = mats.filter((m) => m.kind === k);
        if (!list.length) return null;
        return (
          <section key={k} className="card p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{LABEL[k]}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {list.map((m) => <li key={m.id}>{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-heading underline">{m.title}</a> : <span className="font-medium text-heading">{m.title}</span>} <span className="text-xs text-muted">· {m.subject}</span></li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
