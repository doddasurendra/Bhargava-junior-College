import Link from 'next/link';
import { allotRoomAction, nightRollAction, outpassDecisionAction, resolveComplaintAction, saveRoomAction, sickRoomAction, visitorAction, visitorOutAction } from '@/app/crm/school-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDateTime } from '@/lib/dates';
import { hostelBoard, visitorsToday } from '@/lib/school/operations';

export const metadata = { title: 'Hostel' };

export default async function HostelPage() {
  const user = await requireStaff('hostel.manage');
  const [d, visitors] = await Promise.all([hostelBoard(user), visitorsToday(user, 'hostel').catch(() => [])]);
  const name = new Map(d.students.map((s) => [s.id, s.fullName]));
  const roomOf = new Map(d.rooms.flatMap((r) => r.data.studentIds.map((sid) => [sid, `${r.data.block === 'girls' ? 'G' : 'B'} ${r.data.room}`] as const)));
  const studentOpts = d.students.map((s) => ({ value: s.id, label: `${s.fullName}${roomOf.has(s.id) ? ` (${roomOf.get(s.id)})` : ' (no room)'}` }));
  const blockResidents = (block: 'boys' | 'girls') => d.rooms.filter((r) => r.data.block === block).flatMap((r) => r.data.studentIds);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Hostel</h1>
        <p className="text-sm text-muted">{d.students.length} hostellers · {d.rooms.length} rooms. Biometric check-ins and parent alerts arrive automatically. Mess menu: <Link href="/crm/cms/messMenu" className="underline">edit</Link>.</p>
      </div>

      <Panel title={`Out-passes (${d.passes.length})`}>
        {d.passes.length === 0 ? <Empty>No open out-passes.</Empty> : (
          <ul className="-my-2 divide-y divide-line text-sm">
            {d.passes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-semibold text-heading">{name.get(p.data.studentId) ?? 'Student'}</span> · {formatDateTime(p.data.from)} → {formatDateTime(p.data.to)} · {p.data.reason} · <span className="font-semibold">{p.data.status === 'requested' ? 'waiting for parent' : p.data.status === 'parent_approved' ? 'parent approved' : 'out'}</span></span>
                <span className="flex gap-2">
                  {p.data.status === 'parent_approved' && <ActionButton action={outpassDecisionAction} label="Approve" hidden={{ id: p.id, decision: 'approve' }} />}
                  {p.data.status !== 'approved' && <ActionButton action={outpassDecisionAction} label="Decline" hidden={{ id: p.id, decision: 'reject' }} />}
                  {p.data.status === 'approved' && <ActionButton action={outpassDecisionAction} label="Mark returned" hidden={{ id: p.id, decision: 'returned' }} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        {(['boys', 'girls'] as const).map((block) => {
          const residents = blockResidents(block);
          const roll = d.roll.find((r) => r.data.block === block);
          return (
            <Panel key={block} title={`Night attendance · ${block === 'girls' ? 'girls’' : 'boys’'} block`}>
              {residents.length === 0 ? <Empty>No residents allotted yet.</Empty> : (
                <form action={async (fd) => { 'use server'; await nightRollAction({}, fd); }} className="space-y-2">
                  <input type="hidden" name="block" value={block} />
                  <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {residents.map((sid) => (
                      <li key={sid}>
                        <label className="flex items-center gap-2"><input type="checkbox" name="present" value={sid} defaultChecked={roll ? roll.data.present.includes(sid) : true} className="h-4 w-4 accent-maroon" />{name.get(sid) ?? 'Student'} <span className="text-xs text-muted">{roomOf.get(sid)}</span></label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between"><span className="text-xs text-muted">{roll ? `Taken today: ${roll.data.present.length} present, ${roll.data.absent.length} absent` : 'Not taken today'}</span><button className="btn-primary py-1.5 text-sm">Save night roll</button></div>
                </form>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Rooms">
          {d.rooms.length === 0 ? <Empty>No rooms yet.</Empty> : (
            <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
              {d.rooms.sort((a, b) => (a.data.block + a.data.room).localeCompare(b.data.block + b.data.room)).map((r) => (
                <li key={r.id} className="rounded-lg bg-bg px-3 py-1.5"><span className="font-semibold">{r.data.block === 'girls' ? 'G' : 'B'} {r.data.room}</span> · {r.data.ac ? 'AC' : 'non-AC'} · {r.data.studentIds.length}/{r.data.capacity}<span className="block text-xs text-muted">{r.data.studentIds.map((s) => name.get(s)).join(', ') || 'empty'}</span></li>
              ))}
            </ul>
          )}
          <QuickForm action={saveRoomAction} submit="Add room" cols={4} fields={[
            { name: 'block', label: 'Block', type: 'select', options: [{ value: 'boys', label: 'Boys' }, { value: 'girls', label: 'Girls' }] },
            { name: 'room', label: 'Room', type: 'text', required: true, maxLength: 10 },
            { name: 'capacity', label: 'Beds', type: 'number', defaultValue: '4', min: 1, max: 6 },
            { name: 'ac', label: 'AC', type: 'checkbox' },
          ]} />
          <div className="mt-4 border-t border-line pt-4">
            <QuickForm action={allotRoomAction} submit="Allot room" fields={[
              { name: 'studentId', label: 'Hosteller', type: 'select', required: true, options: studentOpts },
              { name: 'roomId', label: 'Room', type: 'select', options: [{ value: '', label: 'Remove from room' }, ...d.rooms.map((r) => ({ value: r.id, label: `${r.data.block === 'girls' ? 'G' : 'B'} ${r.data.room} (${r.data.studentIds.length}/${r.data.capacity})` }))] },
            ]} />
          </div>
        </Panel>
        <Panel title="Sick room log">
          {d.sick.length === 0 ? <Empty>No entries.</Empty> : (
            <ul className="mb-3 space-y-1 text-sm">{d.sick.slice(0, 10).map((x) => <li key={x.id}><span className="text-xs text-muted">{formatDateTime(x.data.at)}</span> · {name.get(x.data.studentId) ?? 'Student'}: {x.data.complaint} → {x.data.action}{x.data.doctorCalled ? ' · doctor called' : ''}{x.data.parentInformed ? ' · parent informed' : ''}</li>)}</ul>
          )}
          <QuickForm action={sickRoomAction} submit="Log" fields={[
            { name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOpts },
            { name: 'complaint', label: 'Complaint', type: 'text', required: true },
            { name: 'actionTaken', label: 'Action taken', type: 'text', required: true, wide: true },
            { name: 'doctor', label: 'Doctor called', type: 'checkbox' },
            { name: 'informParent', label: 'Parent informed', type: 'checkbox', defaultChecked: true },
          ]} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Complaints (${d.complaints.length} open)`}>
          {d.complaints.length === 0 ? <Empty>No open complaints.</Empty> : (
            <ul className="space-y-3 text-sm">
              {d.complaints.map((c) => (
                <li key={c.id}>
                  <p><span className="rounded bg-bg px-1.5 text-[11px] uppercase">{c.data.category}</span> {c.data.text}</p>
                  <QuickForm action={resolveComplaintAction} submit="Resolve" cols={1} fields={[{ name: 'id', type: 'hidden', value: c.id }, { name: 'resolution', label: 'Resolution', type: 'text', required: true }]} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Hostel visitor log (today)">
          {visitors.length === 0 ? <Empty>No visitors today.</Empty> : (
            <ul className="mb-3 space-y-1 text-sm">{visitors.map((v) => <li key={v.id} className="flex justify-between gap-2"><span>{v.name} · {v.purpose}{v.studentId ? ` · for ${name.get(v.studentId) ?? 'student'}` : ''}</span>{v.outAt ? <span className="text-xs text-muted">left</span> : <ActionButton action={visitorOutAction} label="Out" hidden={{ id: v.id }} className="text-xs underline" />}</li>)}</ul>
          )}
          <QuickForm action={visitorAction} submit="Log visitor" fields={[
            { name: 'place', type: 'hidden', value: 'hostel' },
            { name: 'name', label: 'Visitor', type: 'text', required: true },
            { name: 'phone', label: 'Phone', type: 'tel' },
            { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'visitor', label: 'Visitor' }, { value: 'parcel', label: 'Parcel' }] },
            { name: 'studentId', label: 'For student', type: 'select', options: [{ value: '', label: '—' }, ...d.students.map((s) => ({ value: s.id, label: s.fullName }))] },
            { name: 'purpose', label: 'Purpose', type: 'text', required: true, wide: true },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
