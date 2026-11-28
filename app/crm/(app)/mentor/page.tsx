import Link from 'next/link';
import { ptmSlotsAction, replyParentAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { myMentees, mySlots, staffInbox, thread } from '@/lib/school/mentoring';
import { myMeetings } from '@/lib/school/mentorMeetings';
import { closeMeetingAction, scheduleMeetingAction, setMeetingTimeAction } from '@/app/crm/mentor-actions';
import { MEETING_MODES } from '@/lib/records/collections';

export const metadata = { title: 'Mentoring' };

export default async function MentorPage({ searchParams }: { searchParams: { thread?: string } }) {
  const user = await requireStaff('mentor.notes');
  const meetings = await myMeetings(user);
  const [mentees, slots, inbox] = await Promise.all([myMentees(user), can(user, 'ptm.manage') ? mySlots(user) : Promise.resolve([]), can(user, 'messages.reply') ? staffInbox(user) : Promise.resolve([])]);
  const open = searchParams.thread && inbox.some((t) => t.studentId === searchParams.thread) ? searchParams.thread : null;
  const msgs = open ? await thread(open) : [];
  const warned = mentees.filter((m) => m.warnings.length);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Mentoring</h1>
        <p className="text-sm text-muted">Your mentees (1 : 20), early warnings, PTM slots and parent messages. Concerns go to the parent privately, never on a public list (§6.5).</p>
      </div>

      <Panel title={`My mentees (${mentees.length})${warned.length ? ` · ${warned.length} need attention` : ''}`}>
        {mentees.length === 0 ? <Empty>No mentees assigned yet. The academic coordinator assigns them.</Empty> : (
          <ul className="-my-2 divide-y divide-line">
            {mentees.map((m) => (
              <li key={m.student!.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/crm/students/${m.student!.id}`} className="font-semibold text-heading hover:underline">{m.student!.fullName}</Link>
                  <span className="text-muted"> · {m.batch ?? 'no batch'} · attendance {m.attendance.pct === null ? '–' : `${m.attendance.pct}%`} · last test {m.scorePcts.length ? `${Math.round(m.scorePcts[m.scorePcts.length - 1])}%` : '–'}</span>
                  {m.warnings.length > 0 && <ul className="mt-1 list-disc pl-5 text-maroon dark:text-gold">{m.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                </div>
                <Link href={`/crm/students/${m.student!.id}#mentor`} className="text-xs font-semibold underline">Notes & check-in</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Mentor meetings${meetings.requests.length ? ` · ${meetings.requests.length} request${meetings.requests.length > 1 ? 's' : ''} waiting` : ''}`}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Schedule a one-to-one</p>
            {mentees.length === 0 ? <Empty>No mentees yet.</Empty> : <QuickForm action={scheduleMeetingAction} submit="Schedule meeting" cols={2} fields={[
              { name: 'studentId', label: 'Mentee', type: 'select', required: true, options: mentees.map((m) => ({ value: m.student!.id, label: m.student!.fullName })) },
              { name: 'mode', label: 'How', type: 'select', options: MEETING_MODES.map((x) => ({ value: x, label: x.replace('_', ' ') })) },
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayIST() },
              { name: 'time', label: 'Time', type: 'time', required: true, defaultValue: '16:00' },
              { name: 'agenda', label: 'Agenda (the student sees this)', type: 'text', wide: true, maxLength: 300 },
            ]} />}
          </div>
          <div className="space-y-3 text-sm">
            {meetings.requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-gold/60 p-3">
                <p><b>{r.name}</b> asked for a meeting: <span className="text-muted">{r.agenda}</span></p>
                <QuickForm action={setMeetingTimeAction} submit="Set time" cols={3} fields={[{ name: 'id', type: 'hidden', value: r.id }, { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayIST() }, { name: 'time', label: 'Time', type: 'time', required: true, defaultValue: '16:00' }, { name: 'mode', label: 'How', type: 'select', options: MEETING_MODES.map((x) => ({ value: x, label: x.replace('_', ' ') })) }]} />
              </div>
            ))}
            {meetings.upcoming.length === 0 && meetings.requests.length === 0 && <Empty>No meetings scheduled.</Empty>}
            {meetings.upcoming.map((m) => (
              <details key={m.id} className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer"><b>{m.name}</b> · {m.date ? formatDate(m.date, { weekday: 'short', day: 'numeric', month: 'short' }) : ''} {m.time} · {m.mode.replace('_', ' ')}{m.agenda ? ` · ${m.agenda}` : ''}</summary>
                <div className="mt-2"><QuickForm action={closeMeetingAction} submit="Save outcome" cols={1} fields={[{ name: 'id', type: 'hidden', value: m.id }, { name: 'status', label: 'What happened', type: 'select', required: true, options: [{ value: 'held', label: 'Held' }, { value: 'missed', label: 'Student missed it' }, { value: 'cancelled', label: 'Cancelled' }] }, { name: 'outcome', label: 'Outcome (private unless shared)', type: 'textarea', rows: 2, maxLength: 1000 }, { name: 'share', label: 'Share the outcome with the student and parents', type: 'checkbox' }]} /></div>
              </details>
            ))}
            {meetings.past.length > 0 && <p className="text-xs text-muted">Recent: {meetings.past.slice(0, 6).map((m) => `${m.name} (${m.status}${m.date ? `, ${formatDate(m.date, { day: 'numeric', month: 'short' })}` : ''})`).join(' · ')}</p>}
          </div>
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Parent messages">
          {inbox.length === 0 ? <Empty>No messages.</Empty> : (
            <ul className="-my-2 divide-y divide-line text-sm">
              {inbox.map((t) => (
                <li key={t.studentId} className="py-2">
                  <Link href={`/crm/mentor?thread=${t.studentId}`} className={`font-medium ${t.unread ? 'text-maroon dark:text-gold' : 'text-heading'} hover:underline`}>{t.name}{t.unread ? ` (${t.unread} new)` : ''}</Link>
                  <p className="truncate text-xs text-muted">{t.lastText}</p>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <div className="mt-4 border-t border-line pt-4">
              <ul className="mb-3 space-y-2">
                {msgs.map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'staff' ? 'ml-auto bg-navy text-white dark:bg-gold dark:text-navy-950' : 'bg-bg'}`}>
                    <p className="whitespace-pre-line">{m.text}</p>
                    <p className="mt-0.5 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
                  </li>
                ))}
              </ul>
              <QuickForm action={replyParentAction} submit="Reply" cols={1} fields={[{ name: 'studentId', type: 'hidden', value: open }, { name: 'text', label: 'Reply', type: 'textarea', required: true }]} />
            </div>
          )}
        </Panel>
        {can(user, 'ptm.manage') && (
          <Panel title="PTM slots">
            {slots.length === 0 ? <Empty>No upcoming slots.</Empty> : (
              <ul className="mb-3 space-y-1 text-sm">{slots.map((s) => <li key={s.id} className="flex justify-between"><span className="font-mono">{formatDate(s.date, { day: 'numeric', month: 'short' })} {s.time}</span><span className={s.studentName ? 'text-heading' : 'text-muted'}>{s.studentName ?? 'open'}</span></li>)}</ul>
            )}
            <QuickForm action={ptmSlotsAction} submit="Add slots" cols={3} fields={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayIST() },
              { name: 'times', label: 'Times (e.g. 10:00 10:15 10:30)', type: 'text', required: true },
              { name: 'minutes', label: 'Minutes each', type: 'number', defaultValue: '15', min: 5, max: 60 },
            ]} />
          </Panel>
        )}
      </div>
    </div>
  );
}
