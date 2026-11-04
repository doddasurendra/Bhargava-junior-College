import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { homeworkForBatch } from '@/lib/school/backoffice';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'Homework' };
export const dynamic = 'force-dynamic';

export default async function AppHomeworkPage() {
  const { p } = await requireEnrolled();
  const b = await batchOf(p.studentId);
  const { open, past } = await homeworkForBatch(b?.id ?? null);
  const Card = ({ h }: { h: (typeof open)[number] }) => (
    <article className="card p-4 text-sm">
      <p className="font-semibold text-heading">{h.title}</p>
      <p className="text-[11px] text-muted">{h.subject} · due {formatDate(h.dueOn, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      {h.details && <p className="mt-2 whitespace-pre-line">{h.details}</p>}
    </article>
  );
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Homework</h1>
      {!b && <p className="card p-4 text-sm text-muted">Homework appears once a batch is allotted.</p>}
      {b && open.length === 0 && <p className="card p-4 text-sm text-muted">No homework due. Well done.</p>}
      {open.map((h) => <Card key={h.id} h={h} />)}
      {past.length > 0 && (
        <>
          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Earlier</p>
          {past.map((h) => <Card key={h.id} h={h} />)}
        </>
      )}
    </div>
  );
}
