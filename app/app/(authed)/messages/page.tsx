import { messageTeacherAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireParent } from '@/lib/app/portal';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDateTime } from '@/lib/dates';
import { teachersFor, thread } from '@/lib/school/mentoring';

export const metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const { p } = await requireParent();
  const [msgs, t, staff] = await Promise.all([thread(p.studentId), teachersFor(p.studentId), getCrmRepo().listStaff()]);
  const to = t.mentorId ?? t.classTeacherId;
  const name = to ? staff.find((s) => s.id === to)?.fullName ?? 'the class teacher' : null;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Message {name ?? 'the teacher'}</h1>
      {!to ? <p className="card p-4 text-sm text-muted">No class teacher or mentor is assigned yet. Please call the college office.</p> : (
        <>
          <ul className="space-y-2">
            {msgs.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'parent' ? 'ml-auto bg-navy text-white dark:bg-gold dark:text-navy-950' : 'card'}`}>
                <p className="whitespace-pre-line">{m.text}</p>
                <p className="mt-0.5 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
              </li>
            ))}
          </ul>
          <section className="card p-4">
            <QuickForm action={messageTeacherAction} submit="Send" cols={1} fields={[{ name: 'text', label: 'Message', type: 'textarea', required: true }]} />
          </section>
        </>
      )}
    </div>
  );
}
