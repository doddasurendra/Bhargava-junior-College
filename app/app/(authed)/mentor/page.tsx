import { requestMeetingAction } from '@/app/app/mentor-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { studentMeetings } from '@/lib/school/mentorMeetings';

export const metadata = { title: 'Mentor meetings' };
export const dynamic = 'force-dynamic';

const when = (d: string | null, t: string | null) => (d ? `${formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}${t ? ` · ${t}` : ''}` : 'Time not set yet');
const mode = (m: string) => ({ in_person: 'In person', online: 'Online', phone: 'Phone call' })[m] ?? m;

export default async function MentorPage() {
  const { p } = await requireEnrolled();
  const m = await studentMeetings(p.studentId);
  const student = p.kind === 'student';
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Mentor meetings</h1>
      <p className="text-sm text-muted">{student ? 'One-to-one time with your mentor about studies, goals or anything that worries you.' : 'Your child’s one-to-one meetings with their mentor. Notes appear here only when the mentor shares them.'}</p>
      {!m.hasMentor && <p className="card p-3 text-sm text-muted">No mentor is assigned yet. The academic coordinator assigns mentors.</p>}
      {m.hasMentor && student && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold text-heading">Ask for a meeting</p>
          <QuickForm action={requestMeetingAction} submit="Send request" cols={1} fields={[{ name: 'reason', label: 'What would you like to talk about?', type: 'textarea', required: true, rows: 2, maxLength: 300 }]} />
        </section>
      )}
      <section className="space-y-2">
        <p className="font-semibold text-heading">Coming up</p>
        {m.open.length === 0 && <p className="card p-3 text-sm text-muted">Nothing scheduled.</p>}
        {m.open.map((x) => <article key={x.id} className="card p-4 text-sm"><p className="font-medium text-heading">{when(x.date, x.time)}</p><p className="text-muted">{x.status === 'requested' ? 'Requested: waiting for your mentor to set a time' : mode(x.mode)}{x.agenda ? ` · ${x.agenda}` : ''}</p></article>)}
      </section>
      {m.past.length > 0 && (
        <section className="space-y-2">
          <p className="font-semibold text-heading">Earlier</p>
          {m.past.map((x) => <article key={x.id} className="card p-4 text-sm"><p className="font-medium">{when(x.date, x.time)} · <span className="capitalize">{x.status}</span></p>{x.outcome && <p className="mt-1 whitespace-pre-line text-muted">{x.outcome}</p>}</article>)}
        </section>
      )}
    </div>
  );
}
