import { feedbackAction, registerSessionForm } from '@/app/app/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { portalSessions, typeLabel } from '@/lib/studentLife/sessions';

export const metadata = { title: 'Speaker sessions' };

export default async function SessionsPage() {
  const { u, p } = await requireEnrolled();
  const list = await portalSessions(p.kind === 'student' ? { kind: 'student', studentId: p.studentId } : { kind: 'parent', phone: u.phone, studentId: p.studentId });
  const upcoming = list.filter((s) => !s.past);
  const past = list.filter((s) => s.past).reverse();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">{p.kind === 'parent' ? 'Parent seminars' : 'Speaker sessions'}</h1>
      <p className="text-sm text-muted">{p.kind === 'parent' ? 'Seminars for parents on exam stress, careers and supporting your child.' : 'Motivational talks, toppers’ and alumni interactions, career guidance and study-skills workshops.'}</p>

      <section className="space-y-2">
        <p className="font-semibold text-heading">Coming up</p>
        {upcoming.length === 0 && <p className="card p-3 text-sm text-muted">No sessions scheduled yet.</p>}
        {upcoming.map((s) => (
          <article key={s.id} className="card p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-muted">{typeLabel(s.type)}</p>
            <p className="font-semibold text-heading">{s.title}</p>
            <p className="text-muted">{formatDate(s.date)} · {s.time} · {s.venue ?? (s.onlineUrl ? 'Online' : 'Campus')}</p>
            {s.speaker && <p className="mt-1">{s.speaker.name}: <span className="text-muted">{s.speaker.background}</span></p>}
            {s.summary && <p className="mt-1 whitespace-pre-line">{s.summary}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted">{s.seatsLeft} seats left</span>
              <form action={registerSessionForm}>
                <input type="hidden" name="sessionId" value={s.id} />
                {s.registered ? <button className="text-xs font-semibold text-maroon underline dark:text-gold">✓ Registered, cancel</button> : s.seatsLeft > 0 ? <button className="btn-primary px-3 py-1 text-xs">Register</button> : <span className="text-xs text-muted">Full</span>}
              </form>
            </div>
            {s.registered && s.onlineUrl && <a href={s.onlineUrl} className="mt-1 block text-xs underline" rel="noopener noreferrer" target="_blank">Join link</a>}
          </article>
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <p className="font-semibold text-heading">Past sessions</p>
          {past.map((s) => (
            <article key={s.id} className="card p-4 text-sm">
              <p className="font-medium">{s.title} <span className="text-[11px] text-muted">· {formatDate(s.date)}</span></p>
              {s.attended ? (
                s.feedback ? <p className="mt-1 text-xs text-muted">Your rating: {'★'.repeat(s.feedback.rating)}{'☆'.repeat(5 - s.feedback.rating)}{s.feedback.comment ? ` · “${s.feedback.comment}”` : ''}</p> : (
                  <div className="mt-2">
                    <QuickForm action={feedbackAction} submit="Send feedback" cols={1} fields={[
                      { name: 'sessionId', type: 'hidden', value: s.id },
                      { name: 'rating', label: 'How useful was it?', type: 'select', required: true, options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${'★'.repeat(n)} (${n})` })) },
                      { name: 'comment', label: 'One thing you will use (optional)', type: 'textarea', rows: 2, maxLength: 500 },
                    ]} />
                  </div>
                )
              ) : <p className="text-[11px] text-muted">{s.registered ? 'Registered, not marked present' : 'Not registered'}</p>}
              {s.recordingPath && <p className="mt-1 text-xs">Recording available in Notes &amp; recordings.</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
