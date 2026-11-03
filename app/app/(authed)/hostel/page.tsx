import { redirect } from 'next/navigation';
import { SampleBadge } from '@/components/ui';
import { college } from '@/content/college';
import { getContent } from '@/lib/cms';
import { profileData, requireAppUser } from '@/lib/app/service';
import { formatDate, formatDateTime, todayIST, weekday } from '@/lib/dates';

export const metadata = { title: 'Hostel' };

export default async function AppHostel() {
  const { hostel, messMenu } = await getContent();
  const u = await requireAppUser();
  if (!u.active || u.active.kind === 'applicant') redirect('/app');
  const d = await profileData(u.active);
  const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(todayIST())];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Hostel</h1>

      {d.hostel ? (
        <section className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Check-in and check-out</p>
          {d.hostel.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No movements recorded yet. Every biometric check-in and check-out appears here and is sent to you on WhatsApp.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line text-sm">
              {d.hostel.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${e.direction === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-gold-100 text-navy'}`}>
                      {e.direction === 'in' ? '↓' : '↑'}
                    </span>
                    {e.direction === 'in' ? 'Checked in' : 'Checked out'}
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : (
        <p className="card p-4 text-sm text-muted">Your child is a day scholar. The hostel menu and schedule are shown for reference.</p>
      )}

      <section className="card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Mess menu · week of {formatDate(messMenu.weekOf, { day: 'numeric', month: 'short' })} <SampleBadge show={messMenu.sample} />
        </p>
        <p className="mt-1 text-xs text-muted">{hostel.food.replace(/\s*The weekly mess menu is published in the parent app\.?/, '')}</p>
        <ul className="mt-3 space-y-3 text-sm">
          {messMenu.days.map((m) => (
            <li key={m.day} className={`rounded-xl p-3 ${m.day === today ? 'bg-gold-100/60 ring-1 ring-gold dark:bg-gold/10' : 'bg-bg'}`}>
              <p className="font-semibold text-heading">
                {m.day}
                {m.day === today && <span className="ml-1.5 text-xs font-normal text-muted">today</span>}
              </p>
              <dl className="mt-1 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
                <dt className="text-muted">Breakfast</dt>
                <dd>{m.breakfast}</dd>
                <dt className="text-muted">Lunch</dt>
                <dd>{m.lunch}</dd>
                <dt className="text-muted">Snacks</dt>
                <dd>{m.snacks}</dd>
                <dt className="text-muted">Dinner</dt>
                <dd>{m.dinner}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Daily schedule <SampleBadge show={hostel.sample} />
        </p>
        <ol className="mt-2 text-sm">
          {hostel.schedule.map((s) => (
            <li key={s.time} className="flex gap-3 border-b border-line py-1.5 last:border-0">
              <span className="w-12 font-mono text-maroon dark:text-gold">{s.time}</span>
              {s.activity}
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-4 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Safety and care</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
          {[...hostel.safety, ...hostel.health].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Warden contacts will be listed here by the hostel office. Until then, call the college on{' '}
          <a href={`tel:${college.phones[0].tel}`} className="font-mono font-semibold text-ink">
            {college.phones[0].display}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
