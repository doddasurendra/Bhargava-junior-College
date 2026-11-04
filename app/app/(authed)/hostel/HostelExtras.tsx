import { getContent } from '@/lib/cms';
import { formatDateTime } from '@/lib/dates';
import { sickRoom } from '@/lib/records/collections';
import { roomOf, store } from '@/lib/school/common';

/** §6.4 hostel transparency: warden contacts, CCTV policy, room, and the child's sick-room log. */
export async function HostelExtras({ studentId }: { studentId: string }) {
  const [{ hostel }, room, sick] = await Promise.all([getContent(), roomOf(studentId), sickRoom.list(store(), { k1: studentId, limit: 10 })]);
  return (
    <div className="space-y-3">
      {room && <section className="card p-4 text-sm"><p className="text-[11px] uppercase tracking-wider text-muted">Room</p><p className="font-medium text-heading">{room.data.block === 'girls' ? 'Girls’ block' : 'Boys’ block'} · {room.data.room} · {room.data.ac ? 'AC' : 'non-AC'}</p></section>}
      {hostel.wardens.length > 0 && (
        <section className="card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted">Wardens</p>
          <ul className="mt-1 space-y-1">{hostel.wardens.map((w) => <li key={w.name} className="flex justify-between"><span>{w.name} · {w.block}</span>{w.phone && <a href={`tel:${w.phone}`} className="font-mono underline">{w.phone}</a>}</li>)}</ul>
        </section>
      )}
      {sick.length > 0 && (
        <section className="card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted">Sick room</p>
          <ul className="mt-1 space-y-1">{sick.map((x) => <li key={x.id}><span className="text-[11px] text-muted">{formatDateTime(x.data.at)}</span> {x.data.complaint} → {x.data.action}{x.data.doctorCalled ? ' · doctor called' : ''}</li>)}</ul>
        </section>
      )}
      {hostel.cctvPolicy && <section className="card p-4 text-xs text-muted"><p className="mb-1 font-semibold text-heading">CCTV policy</p>{hostel.cctvPolicy}</section>}
    </div>
  );
}
