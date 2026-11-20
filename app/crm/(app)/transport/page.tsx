import { assignBusAction, busAttendanceAction, busNoticeAction, saveBusAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { phoneFor } from '@/lib/crm/mask';
import { formatDateTime, todayIST } from '@/lib/dates';
import { busAttendance, buses } from '@/lib/records/collections';
import { allStudents, store } from '@/lib/school/common';

export const metadata = { title: 'Transport' };

export default async function TransportPage() {
  const user = await requireStaff('transport.view');
  const manage = can(user, 'transport.manage');
  const [list, students] = await Promise.all([buses.list(store()), allStudents()]);
  const day = students.filter((s) => s.stay === 'day');
  const name = new Map(students.map((s) => [s.id, s.fullName]));
  const busOf = new Map(list.flatMap((b) => b.data.studentIds.map((sid) => [sid, b.data.busNo] as const)));
  const today = todayIST();
  const att = await Promise.all(list.map((b) => busAttendance.list(store(), { k1: b.id, k2: today })));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Transport</h1>
        <p className="text-sm text-muted">{list.length} buses · {day.length} day scholars · {day.filter((s) => busOf.has(s.id)).length} on college transport. {manage ? <>GPS devices post positions to <span className="font-mono">/api/transport/location</span>.</> : <b>Read-only view.</b>}</p>
      </div>
      {list.length === 0 ? <Empty>No buses yet.</Empty> : (
        <div className="grid gap-5 xl:grid-cols-2">
          {list.map((b, i) => {
            const taken = att[i];
            return (
              <Panel key={b.id} title={`${b.data.busNo} · ${b.data.route}`}>
                <p className="text-sm text-muted">Driver {b.data.driverName} {b.data.driverPhone ? `· ${phoneFor(user, b.data.driverPhone)}` : ''} · {b.data.studentIds.length} students</p>
                <p className="text-xs text-muted">{b.data.location ? <>Last position {formatDateTime(b.data.location.at)} · <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${b.data.location.lat},${b.data.location.lng}`}>map</a></> : 'No GPS position yet.'}</p>
                {!manage && <p className="mt-2 text-sm">{b.data.studentIds.map((sid) => name.get(sid) ?? 'Student').join(', ') || 'No students'}{taken.length ? ` · today: ${taken.map((x) => `${x.data.trip} ${x.data.present.length} on board`).join(', ')}` : ''}</p>}
                {manage && b.data.studentIds.length > 0 && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {(['pickup', 'drop'] as const).map((trip) => {
                      const r = taken.find((x) => x.data.trip === trip);
                      return (
                        <form key={trip} action={async (fd) => { 'use server'; await busAttendanceAction({}, fd); }} className="space-y-1">
                          <input type="hidden" name="busId" value={b.id} />
                          <input type="hidden" name="trip" value={trip} />
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{trip}{r ? ` · ${r.data.present.length} on board` : ''}</p>
                          {b.data.studentIds.map((sid) => (
                            <label key={sid} className="flex items-center gap-2 text-sm"><input type="checkbox" name="present" value={sid} defaultChecked={r ? r.data.present.includes(sid) : false} className="h-4 w-4 accent-maroon" />{name.get(sid) ?? 'Student'}</label>
                          ))}
                          <button className="btn-outline py-1 text-xs">Save {trip}</button>
                        </form>
                      );
                    })}
                  </div>
                )}
                {manage && b.data.studentIds.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Message the parents on this bus (WhatsApp)</p>
                    <QuickForm action={busNoticeAction} submit="Send to parents" cols={1} fields={[{ name: 'busId', type: 'hidden', value: b.id }, { name: 'message', label: 'Message', type: 'text', required: true, maxLength: 300, placeholder: 'Bus is running 20 minutes late this evening' }]} />
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      {manage && <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Add a bus">
          <QuickForm action={saveBusAction} submit="Add bus" fields={[
            { name: 'busNo', label: 'Bus number', type: 'text', required: true },
            { name: 'route', label: 'Route', type: 'text', required: true },
            { name: 'driverName', label: 'Driver', type: 'text', required: true },
            { name: 'driverPhone', label: 'Driver phone', type: 'tel' },
          ]} />
        </Panel>
        <Panel title="Assign a day scholar to a bus">
          <QuickForm action={assignBusAction} submit="Assign" fields={[
            { name: 'studentId', label: 'Student', type: 'select', required: true, options: day.map((s) => ({ value: s.id, label: `${s.fullName}${busOf.has(s.id) ? ` (${busOf.get(s.id)})` : ''}` })) },
            { name: 'busId', label: 'Bus', type: 'select', options: [{ value: '', label: 'No college transport' }, ...list.map((b) => ({ value: b.id, label: `${b.data.busNo} · ${b.data.route}` }))] },
          ]} />
        </Panel>
      </div>}
    </div>
  );
}
