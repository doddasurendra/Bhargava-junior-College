import Link from 'next/link';
import { ptmSlotsAction, replyParentAction } from '@/app/crm/school-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { myMentees, mySlots, staffInbox, thread } from '@/lib/school/mentoring';

export const metadata = { title: 'Mentoring' };

export default async function MentorPage({ searchParams }: { searchParams: { thread?: string } }) {
  const user = await requireStaff('mentor.notes');
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
