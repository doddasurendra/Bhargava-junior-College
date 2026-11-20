import Link from 'next/link';
import { reviewSubmissionAction } from '@/app/crm/backoffice-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDate, formatDateTime } from '@/lib/dates';
import { submissionsForHomework } from '@/lib/school/backoffice';
import { SchoolError } from '@/lib/school/common';

export const metadata = { title: 'Homework submissions' };
export const dynamic = 'force-dynamic';

export default async function HomeworkSubmissionsPage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  let data: Awaited<ReturnType<typeof submissionsForHomework>>;
  try {
    data = await submissionsForHomework(user, params.id);
  } catch (e) {
    if (e instanceof SchoolError) return <Panel title="Homework submissions"><p className="text-sm text-muted">{e.message}</p></Panel>;
    throw e;
  }
  const { homework: h, batch, roster } = data;
  const done = roster.filter((r) => r.sub).length;
  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/crm/homework" className="text-xs underline">← Homework</Link>
      <h1 className="font-display text-3xl text-heading">{h.title}</h1>
      <p className="text-sm text-muted">{batch?.data.name ?? ''} · {h.subject} · due {formatDate(h.dueOn, { weekday: 'short', day: 'numeric', month: 'short' })} · {done}/{roster.length} submitted</p>
      <Panel title="Students">
        <ul className="divide-y divide-line text-sm">
          {roster.map((r) => (
            <li key={r.studentId} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-heading">{r.student?.fullName ?? 'Student'} <span className="font-mono text-xs text-muted">{r.student?.collegeId}</span></p>
                <span className="text-xs text-muted">{!r.sub ? 'Not submitted' : `${r.sub.status === 'reviewed' ? 'Reviewed' : 'Submitted'}${r.sub.late ? ' (late)' : ''} · ${formatDateTime(r.sub.submittedAt)}`}</span>
              </div>
              {r.sub && (
                <>
                  <p className="whitespace-pre-line rounded-lg bg-bg p-2">{r.sub.answer}</p>
                  {r.sub.linkUrl && <a className="text-xs underline" href={r.sub.linkUrl} target="_blank" rel="noopener noreferrer">Open attached link</a>}
                  <QuickForm action={reviewSubmissionAction} submit={r.sub.status === 'reviewed' ? 'Update review' : 'Mark reviewed'} reset={false} fields={[
                    { name: 'id', type: 'hidden', value: r.sub.id },
                    { name: 'homeworkId', type: 'hidden', value: h.id },
                    { name: 'grade', label: 'Grade / marks', type: 'text', maxLength: 20, defaultValue: r.sub.grade ?? '' },
                    { name: 'feedback', label: 'Feedback', type: 'textarea', rows: 2, maxLength: 1000, defaultValue: r.sub.feedback ?? '', wide: true },
                  ]} />
                </>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
