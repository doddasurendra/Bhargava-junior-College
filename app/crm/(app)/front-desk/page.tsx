import Link from 'next/link';
import { visitorAction, visitorOutAction, walkInAction } from '@/app/crm/school-actions';
import { CheckInButtons } from '@/components/crm/forms';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { programs } from '@/content/programs';
import { getContent } from '@/lib/cms';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { visitBoard } from '@/lib/crm/service';
import { formatDateTime, todayIST } from '@/lib/dates';
import { allStudents } from '@/lib/school/common';
import { visitorsToday } from '@/lib/school/operations';
import { slotLabel } from '@/lib/visits';

export const metadata = { title: 'Front desk' };

/** §9A.2 row 7: today's visits, Arrived / No-show, walk-in leads, visitor log and gate passes. */
export default async function FrontDeskPage() {
  const user = await requireStaff('visitor.log');
  const today = todayIST();
  const [{ visitSlots }, visits, visitors, students] = await Promise.all([getContent(), can(user, 'visit.view') ? visitBoard(user, today, today, false) : Promise.resolve([]), visitorsToday(user, 'front_desk'), allStudents()]);
  const name = new Map(students.map((s) => [s.id, s.fullName]));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Front desk</h1>
      <Panel title={`Today’s campus visits (${visits.length})`} actions={<Link href="/crm/visits" className="text-xs underline">All visits</Link>}>
        {visits.length === 0 ? <Empty>No visits booked for today.</Empty> : (
          <ul className="-my-2 divide-y divide-line text-sm">
            {visits.map((r) => (
              <li key={r.visit.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span><span className="font-mono">{slotLabel(r.visit.slot, visitSlots)}</span> · <Link href={`/crm/leads/${r.visit.leadId}`} className="font-semibold text-heading hover:underline">{r.lead?.contactName ?? 'Family'}</Link> · {r.visit.familySize} people · <span className="capitalize">{r.visit.status.replace('_', ' ')}</span></span>
                {r.visit.status === 'scheduled' && can(user, 'visit.checkin') && <CheckInButtons visitId={r.visit.id} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        {can(user, 'walkin.create') && (
          <Panel title="Walk-in enquiry">
            <QuickForm action={walkInAction} submit="Create lead" fields={[
              { name: 'name', label: 'Parent name', type: 'text', required: true },
              { name: 'phone', label: 'Mobile', type: 'tel', required: true },
              { name: 'studentName', label: 'Student name', type: 'text' },
              { name: 'program', label: 'Interested in', type: 'select', options: [{ value: '', label: 'Not sure yet' }, ...programs.map((p) => ({ value: p.slug, label: p.short }))] },
              { name: 'note', label: 'Note', type: 'text', wide: true },
            ]} />
          </Panel>
        )}
        <Panel title="Visitor log & gate passes (today)">
          {visitors.length === 0 ? <Empty>No entries today.</Empty> : (
            <ul className="mb-3 space-y-1 text-sm">{visitors.map((v) => <li key={v.id} className="flex justify-between gap-2"><span><span className="rounded bg-bg px-1.5 text-[11px] uppercase">{v.kind.replace('_', ' ')}</span> {v.name} · {v.purpose}{v.studentId ? ` · ${name.get(v.studentId) ?? ''}` : ''} · in {formatDateTime(v.inAt)}</span>{v.outAt ? <span className="text-xs text-muted">out</span> : <ActionButton action={visitorOutAction} label="Out" hidden={{ id: v.id }} className="text-xs underline" />}</li>)}</ul>
          )}
          <QuickForm action={visitorAction} submit="Log" fields={[
            { name: 'place', type: 'hidden', value: 'front_desk' },
            { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'visitor', label: 'Visitor' }, { value: 'gate_pass', label: 'Student gate pass' }, { value: 'parcel', label: 'Parcel' }] },
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'phone', label: 'Phone', type: 'tel' },
            { name: 'studentId', label: 'Student (gate pass / visiting)', type: 'select', options: [{ value: '', label: '—' }, ...students.map((s) => ({ value: s.id, label: s.fullName }))] },
            { name: 'purpose', label: 'Purpose', type: 'text', required: true, wide: true },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
