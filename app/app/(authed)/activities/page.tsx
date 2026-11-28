import { registerProgramAction } from '@/app/app/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { formatDate } from '@/lib/dates';
import { kindLabel, portalPrograms } from '@/lib/studentLife/activities';

export const metadata = { title: 'Yoga & wellness' };
export const dynamic = 'force-dynamic';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export default async function ActivitiesPage() {
  const { p } = await requireEnrolled();
  const list = await portalPrograms(p.studentId);
  const student = p.kind === 'student';
  const mine = list.filter((x) => x.registered);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Yoga, wellness & practice</h1>
      <p className="text-sm text-muted">{student ? 'Weekly yoga, meditation, breathing, stress-relief, fitness and sports-practice classes. Register for the ones you want; your attendance is shown only to you, your parents and the instructor.' : 'Classes your child has registered for, and the ones open to them.'}</p>
      {mine.length > 0 && (
        <section className="card p-4 text-sm">
          <p className="font-semibold text-heading">{student ? 'My classes' : 'Registered classes'}</p>
          <ul className="mt-1 space-y-1">{mine.map((x) => <li key={x.id}>{x.title}: attended <b>{x.attended}</b> of {x.classesHeld} classes held{x.next[0] ? ` · next ${formatDate(x.next[0], { weekday: 'short', day: 'numeric', month: 'short' })} ${x.time}` : ''}</li>)}</ul>
        </section>
      )}
      {list.length === 0 && <p className="card p-3 text-sm text-muted">No classes are open right now.</p>}
      {list.map((x) => (
        <article key={x.id} className="card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted">{kindLabel(x.kind)}{x.sport ? ` · ${x.sport}` : ''}</p>
          <p className="font-semibold text-heading">{x.title}</p>
          <p className="text-muted">{x.days.map(cap).join(', ')} · {x.time} ({x.durationMin} min) · {x.venue ?? 'Campus'} · {x.instructor}</p>
          {x.description && <p className="mt-1 whitespace-pre-line">{x.description}</p>}
          {x.videoUrl && <a href={x.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs underline">Practice video</a>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{x.seatsLeft} seats left</span>
            {student ? (x.registered || x.seatsLeft > 0 ? <QuickForm action={registerProgramAction} submit={x.registered ? 'Cancel registration' : 'Register'} cols={1} fields={[{ name: 'programId', type: 'hidden', value: x.id }]} /> : <span className="text-xs text-muted">Full</span>) : <span className="text-xs">{x.registered ? '✓ Registered' : 'Not registered'}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
