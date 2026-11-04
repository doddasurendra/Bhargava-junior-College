import { bookPtmAction } from '@/app/app/portal-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { requireParent } from '@/lib/app/portal';
import { getContent } from '@/lib/cms';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDate } from '@/lib/dates';
import { openSlotsFor } from '@/lib/school/mentoring';

export const metadata = { title: 'Book a PTM' };

export default async function PtmPage() {
  const { u, p } = await requireParent();
  const [slots, staff, { parentCorner }] = await Promise.all([openSlotsFor(p.studentId), getCrmRepo().listStaff(), getContent()]);
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const mine = slots.filter((s) => s.bookedBy === u.phone);
  const open = slots.filter((s) => !s.bookedBy);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Parent–teacher meeting</h1>
      <p className="text-sm text-muted">{parentCorner.ptm}</p>
      {mine.length > 0 && <section className="card p-4 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Booked</p>{mine.map((s) => <p key={s.id} className="font-medium text-heading">{formatDate(s.date)}, {s.time} with {names.get(s.staffId) ?? 'teacher'}</p>)}</section>}
      {open.length === 0 ? <p className="card p-4 text-sm text-muted">No open slots right now. The class teacher will add more.</p> : (
        <ul className="space-y-2">
          {open.map((s) => (
            <li key={s.id} className="card flex items-center justify-between p-3 text-sm">
              <span>{formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}, <span className="font-mono">{s.time}</span> · {names.get(s.staffId) ?? 'teacher'} · {s.minutes} min</span>
              <ActionButton action={bookPtmAction} label="Book" hidden={{ slotId: s.id }} className="btn-primary py-1.5 text-sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
