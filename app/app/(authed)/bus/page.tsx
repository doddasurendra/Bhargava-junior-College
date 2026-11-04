import { requireEnrolled } from '@/lib/app/portal';
import { formatDateTime } from '@/lib/dates';
import { busFor } from '@/lib/school/operations';

export const metadata = { title: 'Bus' };

/** Route, driver and the last GPS position of the student's bus (§9 parent login: live bus location). */
export default async function BusPage() {
  const { p } = await requireEnrolled();
  const b = await busFor(p.studentId);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Bus</h1>
      {!b ? <p className="card p-4 text-sm text-muted">Not on college transport.</p> : (
        <section className="card space-y-1 p-4 text-sm">
          <p className="font-semibold text-heading">{b.data.busNo} · {b.data.route}</p>
          <p>Driver: {b.data.driverName}{b.data.driverPhone ? <> · <a href={`tel:${b.data.driverPhone}`} className="underline">call</a></> : null}</p>
          {b.data.location ? (
            <p>Last seen {formatDateTime(b.data.location.at)} · <a className="font-semibold underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${b.data.location.lat},${b.data.location.lng}`}>Open on map</a></p>
          ) : (
            <p className="text-muted">Live location appears once the bus’s GPS device is connected.</p>
          )}
        </section>
      )}
    </div>
  );
}
