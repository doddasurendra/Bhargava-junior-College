import { ruleAction, testRuleAction } from '@/app/crm/kb-actions';
import { ActionButton, QuickForm, type QField } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDateTime } from '@/lib/dates';
import { NOTIFY_CHANNELS, NOTIFY_TRIGGERS } from '@/lib/kb/collections';
import { channelStatus, inQuietHours, listRules, messageLog, TRIGGER_LABEL } from '@/lib/kb/notify';

export const metadata = { title: 'Notifications' };

const AUD = [{ value: 'parents', label: 'Parents' }, { value: 'students', label: 'Students' }, { value: 'faculty', label: 'Faculty' }, { value: 'staff', label: 'All staff' }, { value: 'approvers', label: 'KB approvers' }, { value: 'owners', label: 'Content owners' }];
const SCHED = [{ value: 'immediate', label: 'Immediately (held in quiet hours)' }, { value: 'daily_8am', label: 'Daily 8 AM digest' }, { value: 'daily_7pm', label: 'Daily 7 PM digest' }, { value: 'weekly_sun', label: 'Weekly, Sunday' }];
const STATUS_TONE: Record<string, string> = { sent: 'text-emerald-700 dark:text-emerald-300', not_delivered: 'text-maroon dark:text-gold', failed: 'text-red-700', held_quiet_hours: 'text-sky-700', opted_out: 'text-muted', logged: 'text-muted' };

function ruleFields(r?: { id: string; data: { name: string; trigger: string; audience: string; channels: string[]; template: { en: string; te?: string | null; hi?: string | null }; schedule: string; active: boolean } }): QField[] {
  return [
    ...(r ? [{ name: 'id', type: 'hidden' as const, value: r.id }] : []),
    { name: 'name', label: 'Rule name', type: 'text', required: true, defaultValue: r?.data.name },
    { name: 'trigger', label: 'Trigger', type: 'select', required: true, defaultValue: r?.data.trigger, options: NOTIFY_TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABEL[t] })) },
    { name: 'audience', label: 'Audience', type: 'select', required: true, defaultValue: r?.data.audience, options: AUD },
    { name: 'schedule', label: 'Schedule', type: 'select', required: true, defaultValue: r?.data.schedule, options: SCHED },
    ...NOTIFY_CHANNELS.map((c): QField => ({ name: `n_${c}`, label: c === 'push' ? 'Push' : c === 'sms' ? 'SMS' : c === 'email' ? 'Email' : 'WhatsApp', type: 'checkbox', defaultChecked: r ? r.data.channels.includes(c) : c === 'whatsapp' })),
    { name: 'active', label: 'Active', type: 'checkbox', defaultChecked: r?.data.active ?? true },
    { name: 'templateEn', label: 'Message (English) — {name}, {title}, {date}, {items}, {count}', type: 'textarea', required: true, rows: 2, defaultValue: r?.data.template.en, wide: true },
    { name: 'templateTe', label: 'సందేశం (తెలుగు)', type: 'textarea', rows: 2, defaultValue: r?.data.template.te ?? '', wide: true },
    { name: 'templateHi', label: 'संदेश (हिंदी)', type: 'textarea', rows: 2, defaultValue: r?.data.template.hi ?? '', wide: true },
  ];
}

export default async function NotificationsPage() {
  await requireStaff('notify.manage');
  const [rules, log] = await Promise.all([listRules(), messageLog(150)]);
  const ch = channelStatus();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Notification & automation centre</h1>
      <Panel title="Channels">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(ch).map(([k, s]) => <li key={k}>{s.ready ? '✅' : '⛔'} <b className="capitalize">{k}</b>: {s.note}</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">Quiet hours 9 PM – 7 AM IST (now: {inQuietHours() ? 'quiet hours' : 'sending'}). Opt-outs are honoured per channel. Every attempt is logged below with its real status: nothing is shown as delivered unless the provider accepted it.</p>
      </Panel>
      <Panel title="New rule: trigger → audience → channel → template → schedule">
        <QuickForm action={ruleAction} submit="Save rule" cols={4} fields={ruleFields()} />
      </Panel>
      <Panel title={`Rules (${rules.length})`}>
        {rules.length === 0 ? <Empty>No rules yet. Review-date and approval reminders still go out with built-in defaults.</Empty> : (
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm"><b>{r.data.name}</b> <span className="text-xs text-muted">· {TRIGGER_LABEL[r.data.trigger]} → {r.data.audience} → {r.data.channels.join(', ')} · {r.data.schedule}{r.data.active ? '' : ' · paused'}</span></p>
                  <ActionButton action={testRuleAction} label="Send test to me" hidden={{ id: r.id }} />
                </div>
                <details className="mt-2"><summary className="cursor-pointer text-xs underline">Edit</summary><div className="mt-2"><QuickForm action={ruleAction} submit="Save" cols={4} reset={false} fields={ruleFields(r)} /></div></details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Message log (latest ${log.length})`}>
        {log.length === 0 ? <Empty>No messages yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted"><th className="py-1">When</th><th>Trigger</th><th>Channel</th><th>To</th><th>Status</th><th>Message</th></tr></thead>
              <tbody>{log.map((m) => <tr key={m.id} className="border-t border-line align-top"><td className="py-1 pr-2 font-mono">{formatDateTime(m.at)}</td><td className="pr-2">{m.trigger}</td><td className="pr-2">{m.channel}</td><td className="pr-2 font-mono">{m.to}</td><td className={`pr-2 font-semibold ${STATUS_TONE[m.status] ?? ''}`}>{m.status.replace(/_/g, ' ')}{m.error ? <span className="block font-normal text-muted">{m.error}</span> : null}</td><td className="max-w-xs truncate" title={m.text}>{m.text}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
