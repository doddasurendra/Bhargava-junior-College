import { submitHomeworkAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate, formatDateTime } from '@/lib/dates';
import { homeworkForBatch, submissionsForStudent } from '@/lib/school/backoffice';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'Homework' };
export const dynamic = 'force-dynamic';

export default async function AppHomeworkPage() {
  const { p } = await requireEnrolled();
  const isStudent = p.kind === 'student';
  const b = await batchOf(p.studentId);
  const { open, past } = await homeworkForBatch(b?.id ?? null);
  const subs = await submissionsForStudent(p.studentId);
  const Card = ({ h }: { h: (typeof open)[number] }) => {
    const sub = subs.get(h.id) ?? null;
    return (
      <article className="card p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-heading">{h.title}</p>
            <p className="text-[11px] text-muted">{h.subject} · due {formatDate(h.dueOn, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          </div>
          <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
            {!sub ? 'Not submitted' : sub.status === 'reviewed' ? `Reviewed${sub.grade ? ` · ${sub.grade}` : ''}` : sub.late ? 'Submitted late' : 'Submitted'}
          </span>
        </div>
        {h.details && <p className="mt-2 whitespace-pre-line">{h.details}</p>}
        {sub && (
          <div className="mt-3 rounded-lg bg-bg p-2">
            <p className="text-[11px] text-muted">{isStudent ? 'Your' : 'Child’s'} submission · {formatDateTime(sub.submittedAt)}</p>
            <p className="mt-1 whitespace-pre-line">{sub.answer}</p>
            {sub.linkUrl && <a className="mt-1 block text-xs underline" href={sub.linkUrl} target="_blank" rel="noopener noreferrer">Attached link</a>}
            {sub.feedback && <p className="mt-2 text-xs"><span className="font-semibold">Teacher’s feedback:</span> {sub.feedback}</p>}
          </div>
        )}
        {isStudent && sub?.status !== 'reviewed' && (
          <div className="mt-3">
            <QuickForm action={submitHomeworkAction} submit={sub ? 'Update submission' : 'Submit'} cols={1} reset={false} fields={[
              { name: 'homeworkId', type: 'hidden', value: h.id },
              { name: 'answer', label: 'Your answer / note', type: 'textarea', required: true, rows: 3, maxLength: 4000, defaultValue: sub?.answer ?? '' },
              { name: 'linkUrl', label: 'Link to your work (https://, optional)', type: 'url', defaultValue: sub?.linkUrl ?? '' },
            ]} />
          </div>
        )}
      </article>
    );
  };
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Homework & assignments</h1>
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
