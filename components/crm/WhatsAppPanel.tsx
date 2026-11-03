import type { Staff } from '@/lib/crm/types';
import { formatDateTime } from '@/lib/dates';
import type { whatsappForLead } from '@/lib/whatsapp/crm';
import { Panel } from './ui';
import { WaOptInForm, WaSendForm } from './waForms';

type Data = Awaited<ReturnType<typeof whatsappForLead>>;

const TICK: Record<string, string> = { queued: '…', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '!', skipped: '–' };

export function WhatsAppPanel({ leadId, data, names }: { leadId: string; data: Data; user: Staff; names: (id: string | null) => string }) {
  const disabled = data.optedOut ? 'This number replied STOP. Messages cannot be sent until the family replies START.' : !data.consent ? 'No WhatsApp consent on record. Record the opt-in first.' : null;
  return (
    <Panel
      title="WhatsApp"
      actions={
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${data.optedOut ? 'bg-red-100 text-red-800' : data.consent ? 'bg-emerald-100 text-emerald-900' : 'bg-bg text-muted'}`}>
          {data.optedOut ? 'Opted out (STOP)' : data.consent ? 'Consent on record' : 'No consent'}
        </span>
      }
    >
      <div className="space-y-4">
        {data.mode === 'dev' && <p className="rounded-lg border border-dashed border-gold bg-gold-100 px-3 py-1.5 text-[11px] text-navy">Development: messages are logged, not sent.</p>}
        {data.mode === 'off' && <p className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-800">WhatsApp is not configured. Messages are recorded as skipped.</p>}

        {data.thread.length > 0 && (
          <ol className="max-h-80 space-y-2 overflow-y-auto rounded-xl bg-[#EFEAE2] p-3 dark:bg-[#0B141A]">
            {data.thread.map((m, i) => (
              <li key={i} className={`flex ${m.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] shadow-sm ${m.dir === 'out' ? 'bg-[#D9FDD3] text-[#111B21] dark:bg-[#005C4B] dark:text-white' : 'bg-white text-[#111B21] dark:bg-[#202C33] dark:text-white'}`}>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
                  <p className="mt-1 text-right text-[10px] opacity-60">
                    {m.template && `${m.template} · `}
                    {m.by && `${names(m.by)} · `}
                    {formatDateTime(m.at)}
                    {m.status && <span className={`ml-1 ${m.status === 'read' ? 'text-sky-600' : ''}`}>{TICK[m.status]}</span>}
                  </p>
                  {m.error && <p className="mt-0.5 text-[10px] text-red-700 dark:text-red-300">{m.status === 'skipped' ? 'Not sent: ' : 'Failed: '}{m.error}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}

        {!data.consent && !data.optedOut && data.canSend && (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs text-muted">Website enquiries opt in when they submit a form. For imported or phone-in leads, record consent once the family agrees.</p>
            <WaOptInForm leadId={leadId} />
          </div>
        )}

        {data.canSend && <WaSendForm leadId={leadId} options={data.options} disabled={disabled} />}
        <p className="text-[11px] text-muted">Replies appear here. Free-text replies from staff come with the chat inbox; until then, call the family back.</p>
      </div>
    </Panel>
  );
}
