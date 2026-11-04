import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { noticesFor } from '@/lib/school/academics';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'Notices' };

export default async function AppNoticesPage() {
  const { p } = await requireEnrolled();
  const b = await batchOf(p.studentId);
  const list = await noticesFor(p.kind === 'parent' ? 'parents' : 'students', b?.id ?? null);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Notices & circulars</h1>
      {list.length === 0 ? <p className="card p-4 text-sm text-muted">No notices.</p> : list.map((n) => (
        <article key={n.id} className="card p-4 text-sm">
          <p className="font-semibold text-heading">{n.title}</p>
          <p className="text-[11px] text-muted">{formatDate(n.date)}</p>
          <p className="mt-2 whitespace-pre-line">{n.body}</p>
          {n.attachmentUrl && <a href={n.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">Attachment</a>}
        </article>
      ))}
    </div>
  );
}
